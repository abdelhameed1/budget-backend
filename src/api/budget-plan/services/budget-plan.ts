/**
 * budget-plan service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::budget-plan.budget-plan', ({ strapi }) => ({
  /**
   * Calculate variance analysis for a budget period
   */
  async calculateVariances(budgetId: number) {
    const budget: any = await strapi.entityService.findOne('api::budget-plan.budget-plan', budgetId);

    if (!budget) {
      throw new Error('Budget not found');
    }

    const variances = {
      // Revenue variance
      revenueVariance: Number(budget.actualRevenue || 0) - Number(budget.budgetedRevenue || 0),
      revenueVariancePercent: this.calculateVariancePercent(
        budget.actualRevenue,
        budget.budgetedRevenue
      ),

      // Direct Material variance
      materialVariance: Number(budget.actualDirectMaterial || 0) - Number(budget.budgetedDirectMaterial || 0),
      materialVariancePercent: this.calculateVariancePercent(
        budget.actualDirectMaterial,
        budget.budgetedDirectMaterial
      ),

      // Direct Labor variance
      laborVariance: Number(budget.actualDirectLabor || 0) - Number(budget.budgetedDirectLabor || 0),
      laborVariancePercent: this.calculateVariancePercent(
        budget.actualDirectLabor,
        budget.budgetedDirectLabor
      ),

      // Fixed Overhead variance
      fixedOverheadVariance: Number(budget.actualFixedOverhead || 0) - Number(budget.budgetedFixedOverhead || 0),
      fixedOverheadVariancePercent: this.calculateVariancePercent(
        budget.actualFixedOverhead,
        budget.budgetedFixedOverhead
      ),

      // Variable Overhead variance
      variableOverheadVariance: Number(budget.actualVariableOverhead || 0) - Number(budget.budgetedVariableOverhead || 0),
      variableOverheadVariancePercent: this.calculateVariancePercent(
        budget.actualVariableOverhead,
        budget.budgetedVariableOverhead
      ),

      // Volume variance
      volumeVariance: Number(budget.actualUnits || 0) - Number(budget.budgetedUnits || 0),
      volumeVariancePercent: this.calculateVariancePercent(
        budget.actualUnits,
        budget.budgetedUnits
      ),

      // Total costs
      budgetedTotalCost: Number(budget.budgetedDirectMaterial || 0) +
        Number(budget.budgetedDirectLabor || 0) +
        Number(budget.budgetedFixedOverhead || 0) +
        Number(budget.budgetedVariableOverhead || 0),

      actualTotalCost: Number(budget.actualDirectMaterial || 0) +
        Number(budget.actualDirectLabor || 0) +
        Number(budget.actualFixedOverhead || 0) +
        Number(budget.actualVariableOverhead || 0),

      // Profit metrics
      budgetedGrossProfit: 0,
      actualGrossProfit: 0,
      profitVariance: 0,
    };

    variances.budgetedGrossProfit = Number(budget.budgetedRevenue || 0) - variances.budgetedTotalCost;
    variances.actualGrossProfit = Number(budget.actualRevenue || 0) - variances.actualTotalCost;
    variances.profitVariance = variances.actualGrossProfit - variances.budgetedGrossProfit;

    return variances;
  },

  /**
   * Calculate variance percentage
   */
  calculateVariancePercent(actual: any, budgeted: any): number {
    const actualNum = Number(actual || 0);
    const budgetedNum = Number(budgeted || 0);

    if (budgetedNum === 0) return 0;

    return ((actualNum - budgetedNum) / budgetedNum) * 100;
  },

  /**
   * Update actual values from transactions
   */
  async updateActuals(budgetId: number) {
    const budget = await strapi.entityService.findOne('api::budget-plan.budget-plan', budgetId);

    if (!budget) {
      throw new Error('Budget not found');
    }

    const startDate = new Date(budget.startDate);
    const endDate = new Date(budget.endDate);

    // Get all transactions in the period
    const transactions = await strapi.entityService.findMany('api::cashflow.cashflow', {
      filters: {
        transactionDate: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    });

    // Calculate actuals from transactions
    let actualRevenue = 0;
    let actualDirectMaterial = 0;
    let actualDirectLabor = 0;
    let actualFixedOverhead = 0;
    let actualVariableOverhead = 0;

    transactions.forEach((txn: any) => {
      const amount = parseFloat(txn.amount || 0);

      if (txn.type === 'revenue' && txn.category === 'sales') {
        actualRevenue += amount;
      } else if (txn.type === 'expense') {
        switch (txn.category) {
          case 'material_purchase':
            actualDirectMaterial += amount;
            break;
          case 'labor_payment':
            actualDirectLabor += amount;
            break;
          case 'overhead_fixed':
            actualFixedOverhead += amount;
            break;
          case 'overhead_variable':
            actualVariableOverhead += amount;
            break;
        }
      }
    });

    // Get actual units from batches
    const batches = await strapi.entityService.findMany('api::batch.batch', {
      filters: {
        completionDate: {
          $gte: startDate,
          $lte: endDate,
        },
        status: 'completed',
      },
    });

    const actualUnits = batches.reduce((sum: number, batch: any) => {
      return sum + parseInt(batch.actualQuantity || 0);
    }, 0);

    // Update budget with actuals
    await strapi.entityService.update('api::budget-plan.budget-plan', budgetId, {
      data: {
        actualRevenue,
        actualDirectMaterial,
        actualDirectLabor,
        actualFixedOverhead,
        actualVariableOverhead,
        actualUnits,
      },
    });

    return await this.calculateVariances(budgetId);
  },

  /**
   * Calculate break-even analysis
   */
  async calculateBreakEven(budgetId: number) {
    const budget = await strapi.entityService.findOne('api::budget-plan.budget-plan', budgetId);

    if (!budget) {
      throw new Error('Budget not found');
    }

    const budgetedUnits = Number(budget.budgetedUnits || 0);
    const budgetedRevenue = Number(budget.budgetedRevenue || 0);
    const budgetedVariableCost = Number(budget.budgetedDirectMaterial || 0) +
      Number(budget.budgetedDirectLabor || 0) +
      Number(budget.budgetedVariableOverhead || 0);
    const budgetedFixedCost = Number(budget.budgetedFixedOverhead || 0);

    if (budgetedUnits === 0) {
      return {
        error: 'Cannot calculate break-even with zero units',
      };
    }

    const pricePerUnit = budgetedRevenue / budgetedUnits;
    const variableCostPerUnit = budgetedVariableCost / budgetedUnits;
    const contributionMarginPerUnit = pricePerUnit - variableCostPerUnit;

    if (contributionMarginPerUnit <= 0) {
      return {
        error: 'Contribution margin is negative or zero',
      };
    }

    const breakEvenUnits = Math.ceil(budgetedFixedCost / contributionMarginPerUnit);
    const breakEvenRevenue = breakEvenUnits * pricePerUnit;
    const contributionMarginRatio = (contributionMarginPerUnit / pricePerUnit) * 100;
    const safetyMargin = budgetedUnits - breakEvenUnits;
    const safetyMarginPercent = (safetyMargin / budgetedUnits) * 100;

    return {
      pricePerUnit,
      variableCostPerUnit,
      contributionMarginPerUnit,
      contributionMarginRatio,
      fixedCosts: budgetedFixedCost,
      breakEvenUnits,
      breakEvenRevenue,
      budgetedUnits,
      safetyMargin,
      safetyMarginPercent,
    };
  },
}));
