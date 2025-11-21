import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::cashflow.cashflow', ({ strapi }) => ({
  /**
   * Get total investments by owner
   */
  async getOwnerInvestments() {
    const investments = await strapi.entityService.findMany('api::cashflow.cashflow', {
      filters: {
        type: 'owner_investment',
        category: 'owner_investment',
      },
      populate: {
        owner: true,
      },
    });

    const ownerTotals: Record<string, number> = {};
    
    investments.forEach((inv: any) => {
      const ownerName = inv.owner?.ownerName || inv.owner?.owner_name || inv.owner || 'Unknown';
      const owner = String(ownerName);
      ownerTotals[owner] = (ownerTotals[owner] || 0) + parseFloat(inv.amount || 0);
    });

    return ownerTotals;
  },

  /**
   * Get total expenses by category
   */
  async getTotalExpenses(startDate?: Date, endDate?: Date) {
    const filters: any = {
      type: 'expense',
    };

    if (startDate || endDate) {
      filters.transactionDate = {};
      if (startDate) filters.transactionDate.$gte = startDate;
      if (endDate) filters.transactionDate.$lte = endDate;
    }

    const expenses = await strapi.entityService.findMany('api::cashflow.cashflow', {
      filters,
    });

    let totalMaterial = 0;
    let totalLabor = 0;
    let totalFixedOverhead = 0;
    let totalVariableOverhead = 0;
    let totalOther = 0;

    expenses.forEach((exp: any) => {
      const amount = parseFloat(exp.amount || 0);
      
      switch (exp.category) {
        case 'material_purchase':
          totalMaterial += amount;
          break;
        case 'labor_payment':
          totalLabor += amount;
          break;
        case 'overhead_fixed':
          totalFixedOverhead += amount;
          break;
        case 'overhead_variable':
          totalVariableOverhead += amount;
          break;
        default:
          totalOther += amount;
      }
    });

    const totalExpenses = totalMaterial + totalLabor + totalFixedOverhead + totalVariableOverhead + totalOther;

    return {
      totalMaterial,
      totalLabor,
      totalFixedOverhead,
      totalVariableOverhead,
      totalOther,
      totalExpenses,
    };
  },

  /**
   * Calculate budget status: owner investments vs expenses
   */
  async getBudgetStatus(startDate?: Date, endDate?: Date) {
    const ownerInvestments = await this.getOwnerInvestments();
    const expenses = await this.getTotalExpenses(startDate, endDate);

    const totalInvestment = Object.values(ownerInvestments).reduce((sum, amount) => sum + amount, 0);
    const remainingBudget = totalInvestment - expenses.totalExpenses;
    const spentPercentage = totalInvestment > 0 ? (expenses.totalExpenses / totalInvestment) * 100 : 0;

    return {
      ownerInvestments,
      totalInvestment,
      expenses,
      remainingBudget,
      spentPercentage,
    };
  },
}));
