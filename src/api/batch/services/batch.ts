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

    // Overhead calculation disabled for now
    const overheadCost = 0;

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
   * Update batch status to completed
   * Note: Cost calculation happens automatically via lifecycle hook
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

    // Update batch status to completed
    // Cost calculation will be triggered automatically by the lifecycle hook
    const updatedBatch = await strapi.entityService.update('api::batch.batch', batchId, {
      data: {
        status: 'completed',
        completionDate: new Date(),
      },
    });

    // Inventory creation is disabled for now
    // TODO: Re-enable inventory creation when needed

    return updatedBatch;
  },
}));
