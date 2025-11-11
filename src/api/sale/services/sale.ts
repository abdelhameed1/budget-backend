/**
 * sale service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::sale.sale', ({ strapi }) => ({
  /**
   * Process a sale and update inventory/COGS
   */
  async processSale(saleData: any) {
    const { product, batch, quantity, sellingPricePerUnit } = saleData;

    // Get batch cost information
    const batchRecord = await strapi.entityService.findOne('api::batch.batch', batch, {
      populate: ['product'],
    });

    if (!batchRecord) {
      throw new Error('Batch not found');
    }

    // Get inventory
    const inventory = await strapi.entityService.findMany('api::inventory.inventory', {
      filters: {
        batch: batch,
      },
      limit: 1,
    });

    if (!inventory.length || inventory[0].quantityOnHand < quantity) {
      throw new Error('Insufficient inventory');
    }

    // Calculate sale financials
    const totalRevenue = quantity * sellingPricePerUnit;
    const costPerUnit = batchRecord.costPerUnit || 0;
    const totalCOGS = quantity * costPerUnit;
    const grossProfit = totalRevenue - totalCOGS;
    const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Create sale record
    const sale = await strapi.entityService.create('api::sale.sale', {
      data: {
        ...saleData,
        totalRevenue,
        costPerUnit,
        totalCOGS,
        grossProfit,
        grossMarginPercent,
        amountPaid: saleData.amountPaid || totalRevenue,
        amountDue: totalRevenue - (saleData.amountPaid || totalRevenue),
      },
    });

    // Update inventory
    const newQuantity = inventory[0].quantityOnHand - quantity;
    const newSoldQuantity = (inventory[0].quantitySold || 0) + quantity;
    
    await strapi.entityService.update('api::inventory.inventory', inventory[0].id, {
      data: {
        quantityOnHand: newQuantity,
        quantitySold: newSoldQuantity,
        totalValue: newQuantity * costPerUnit,
        lastUpdated: new Date(),
      },
    });

    // Create financial transaction for revenue
    await strapi.entityService.create('api::cashflow.cashflow', {
      data: {
        transactionDate: saleData.saleDate,
        type: 'revenue',
        category: 'sales',
        description: `Sale - Invoice ${saleData.invoiceNumber}`,
        amount: totalRevenue,
        paymentMethod: saleData.paymentMethod || 'cash',
        customer: saleData.customer,
        invoiceNumber: saleData.invoiceNumber,
        isPaid: saleData.paymentStatus === 'paid',
      },
    });

    return sale;
  },

  /**
   * Calculate total sales for a period
   */
  async getSalesSummary(startDate: Date, endDate: Date) {
    const sales = await strapi.entityService.findMany('api::sale.sale', {
      filters: {
        saleDate: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    });

    const summary = {
      totalRevenue: 0,
      totalCOGS: 0,
      totalGrossProfit: 0,
      totalQuantitySold: 0,
      averageMargin: 0,
      salesCount: sales.length,
    };

    sales.forEach((sale: any) => {
      summary.totalRevenue += parseFloat(sale.totalRevenue || 0);
      summary.totalCOGS += parseFloat(sale.totalCOGS || 0);
      summary.totalGrossProfit += parseFloat(sale.grossProfit || 0);
      summary.totalQuantitySold += parseInt(sale.quantity || 0);
    });

    summary.averageMargin = summary.totalRevenue > 0 
      ? (summary.totalGrossProfit / summary.totalRevenue) * 100 
      : 0;

    return summary;
  },
}));
