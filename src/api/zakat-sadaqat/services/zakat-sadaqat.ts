/**
 * zakat-sadaqat service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::zakat-sadaqat.zakat-sadaqat', ({ strapi }) => ({
  /**
   * Calculate Zakat based on net zakatable assets
   */
  async calculateZakat(calculationDate: Date) {
    // Get all cash/bank transactions
    const transactions = await strapi.entityService.findMany('api::cashflow.cashflow', {
      filters: {
        transactionDate: { $lte: calculationDate },
      },
    });

    // Calculate cash balance
    let cash = 0;
    transactions.forEach((txn: any) => {
      if (txn.type === 'revenue') {
        cash += parseFloat(txn.amount || 0);
      } else if (txn.type === 'expense') {
        cash -= parseFloat(txn.amount || 0);
      }
    });

    // Get receivables (unpaid sales)
    const unpaidSales = await strapi.entityService.findMany('api::sale.sale', {
      filters: {
        paymentStatus: { $in: ['pending', 'partial'] },
        saleDate: { $lte: calculationDate },
      },
    });

    const receivables = unpaidSales.reduce((sum: number, sale: any) => {
      return sum + parseFloat(sale.amountDue || 0);
    }, 0);

    // Get inventory value
    const inventories = await strapi.entityService.findMany('api::inventory.inventory', {});
    const inventoryValue = inventories.reduce((sum: number, inv: any) => {
      return sum + parseFloat(inv.totalValue || 0);
    }, 0);

    // Get liabilities (unpaid expenses)
    const unpaidExpenses = await strapi.entityService.findMany('api::cashflow.cashflow', {
      filters: {
        type: 'expense',
        isPaid: false,
        transactionDate: { $lte: calculationDate },
      },
    });

    const liabilities = unpaidExpenses.reduce((sum: number, exp: any) => {
      return sum + parseFloat(exp.amount || 0);
    }, 0);

    // Calculate net zakatable assets
    const zakatableAssets = cash + receivables + inventoryValue;
    const netZakatableAssets = zakatableAssets - liabilities;

    // Nisab threshold (approximately 85 grams of gold - adjust based on current gold price)
    // Example: 85g × 3000 EGP/g = 255,000 EGP (update this value)
    const nisabThreshold = 255000; // Update this based on current gold prices

    const isAboveNisab = netZakatableAssets >= nisabThreshold;
    const zakatRate = 2.5; // 2.5% for wealth
    const calculatedAmount = isAboveNisab ? (netZakatableAssets * zakatRate) / 100 : 0;

    // Create Zakat record
    const zakatRecord = await strapi.entityService.create('api::zakat-sadaqat.zakat-sadaqat', {
      data: {
        type: 'zakat',
        calculationMethod: 'net_assets',
        calculationDate,
        gregorianYear: calculationDate.getFullYear(),
        cash,
        receivables,
        inventory: inventoryValue,
        liabilities,
        zakatableAssets,
        netZakatableAssets,
        nisabThreshold,
        isAboveNisab,
        zakatRate,
        calculatedAmount,
        remainingAmount: calculatedAmount,
        status: 'calculated',
      },
    });

    return zakatRecord;
  },

  /**
   * Record Zakat payment
   */
  async recordPayment(zakatId: number, amount: number, paymentDate: Date) {
    const zakatRecord: any = await strapi.entityService.findOne('api::zakat-sadaqat.zakat-sadaqat', zakatId);

    if (!zakatRecord) {
      throw new Error('Zakat record not found');
    }

    const newPaidAmount = Number(zakatRecord.paidAmount || 0) + amount;
    const remainingAmount = Number(zakatRecord.calculatedAmount) - newPaidAmount;

    let status: 'calculated' | 'partially_paid' | 'fully_paid' = 'calculated';
    if (remainingAmount <= 0) {
      status = 'fully_paid';
    } else if (newPaidAmount > 0) {
      status = 'partially_paid';
    }

    // Update Zakat record
    await strapi.entityService.update('api::zakat-sadaqat.zakat-sadaqat', zakatId, {
      data: {
        paidAmount: newPaidAmount,
        remainingAmount: Math.max(0, remainingAmount),
        paymentDate,
        status,
      },
    });

    // // Create financial transaction
    // await strapi.entityService.create('api::cashflow.cashflow', {
    //   data: {
    //     transactionDate: paymentDate,
    //     type: 'expense',
    //     category: zakatRecord.type === 'zakat' ? 'zakat' : 'sadaqat',
    //     description: `${zakatRecord.type === 'zakat' ? 'Zakat' : 'Sadaqat'} Payment`,
    //     amount,
    //     paymentMethod: 'cash',
    //     isPaid: true,
    //   },
    // });

    return await strapi.entityService.findOne('api::zakat-sadaqat.zakat-sadaqat', zakatId);
  },
}));
