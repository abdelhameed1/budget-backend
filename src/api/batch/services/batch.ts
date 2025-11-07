/**
 * batch service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::batch.batch', ({ strapi }) => ({
  /**
   * Calculate total costs for a batch
   */
  async calculateBatchCosts(batchId: number) {
    const batch: any = await strapi.entityService.findOne('api::batch.batch', batchId, {
      populate: ['directCosts', 'product'],
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    // Calculate total material costs
    const materialCosts = batch.directCosts
      ?.filter((cost: any) => cost.costType === 'material')
      .reduce((sum: number, cost: any) => sum + Number(cost.totalCost || 0), 0) || 0;

    // Calculate total labor costs
    const laborCosts = batch.directCosts
      ?.filter((cost: any) => cost.costType === 'labor')
      .reduce((sum: number, cost: any) => sum + Number(cost.totalCost || 0), 0) || 0;

    // Get applicable overhead rate
    const overheadRate = await this.getApplicableOverheadRate(batch);
    
    // Calculate overhead cost
    let overheadCost = 0;
    if (overheadRate) {
      // Unit-based overhead
      const quantity = batch.actualQuantity || batch.plannedQuantity;
      overheadCost = Number(overheadRate.ratePerUnit || 0) * quantity;

      // Add time-based overhead if production hours are tracked
      if (batch.productionHours && overheadRate.ratePerHour) {
        overheadCost += Number(overheadRate.ratePerHour) * Number(batch.productionHours);
      }
    }

    // Calculate totals
    const totalCost = materialCosts + laborCosts + overheadCost;
    const quantity = batch.actualQuantity || batch.plannedQuantity;
    const costPerUnit = quantity > 0 ? totalCost / quantity : 0;

    // Update batch with calculated costs
    await strapi.entityService.update('api::batch.batch', batchId, {
      data: {
        totalMaterialCost: materialCosts,
        totalLaborCost: laborCosts,
        totalOverheadCost: overheadCost,
        totalCost: totalCost,
        costPerUnit: costPerUnit,
      },
    });

    return {
      materialCosts,
      laborCosts,
      overheadCost,
      totalCost,
      costPerUnit,
    };
  },

  /**
   * Get applicable overhead rate based on batch and product lifecycle
   */
  async getApplicableOverheadRate(batch: any) {
    const product = batch.product;
    const lifecycleStage = product?.lifecycleStage || 'growth';
    const currentDate = new Date();

    // Find active overhead rate matching the lifecycle stage
    const rates = await strapi.entityService.findMany('api::overhead-rate.overhead-rate', {
      filters: {
        isActive: true,
        effectiveFrom: { $lte: currentDate },
        $and: [
          {
            $or: [
              { effectiveTo: { $gte: currentDate } },
              { effectiveTo: null },
            ],
          },
          {
            $or: [
              { applicableStage: lifecycleStage },
              { applicableStage: 'all' },
            ],
          },
        ],
      },
      sort: { ratePerUnit: 'desc' }, // Get highest rate if multiple match
      limit: 1,
    });

    return rates[0] || null;
  },

  /**
   * Update inventory when batch is completed
   */
  async completeBatch(batchId: number) {
    const batch: any = await strapi.entityService.findOne('api::batch.batch', batchId, {
      populate: ['product'],
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'quality_check') {
      throw new Error('Batch must be in quality_check status to complete');
    }

    // Calculate final costs
    await this.calculateBatchCosts(batchId);

    // Update batch status
    await strapi.entityService.update('api::batch.batch', batchId, {
      data: {
        status: 'completed',
        completionDate: new Date(),
      },
    });

    // Create or update inventory record
    const existingInventory: any = await strapi.entityService.findMany('api::inventory.inventory', {
      filters: {
        batch: { id: batchId },
      },
      limit: 1,
    });

    const inventoryData = {
      product: batch.product.id,
      batch: batchId,
      quantityOnHand: batch.actualQuantity,
      unitCost: batch.costPerUnit,
      totalValue: batch.totalCost,
      lastUpdated: new Date(),
    };

    if (existingInventory.length > 0) {
      await strapi.entityService.update('api::inventory.inventory', existingInventory[0].id, {
        data: inventoryData,
      });
    } else {
      await strapi.entityService.create('api::inventory.inventory', {
        data: inventoryData,
      });
    }

    return batch;
  },
}));
