export default ({ strapi }) => ({
    async getStats() {
        // 1. Fetch necessary data (lightweight)
        // Fetch all cashflows with only needed fields
        const allCashflows = await strapi.entityService.findMany('api::cashflow.cashflow', {
            fields: ['amount', 'type', 'category'],
            limit: -1,
        });

        // Fetch all batches with only needed fields
        const allBatches = await strapi.entityService.findMany('api::batch.batch', {
            fields: ['totalCost', 'totalMaterialCost', 'totalLaborCost', 'totalOverheadCost'],
            limit: -1,
        });

        // Fetch recent batches (full data for display)
        const recentBatches = await strapi.entityService.findMany('api::batch.batch', {
            sort: { startDate: 'desc' },
            limit: 5,
            populate: ['product'],
        });

        // 2. Calculate Metrics

        // Total Capital (Owner Investments)
        const totalCapital = allCashflows
            .filter((c) => c.type === 'owner_investment')
            .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

        // Total Expenses (for Utilization)
        const totalExpenses = allCashflows
            .filter((c) => c.type === 'expense')
            .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

        // Total Production Costs
        const totalProductionCosts = allBatches.reduce(
            (sum, b) => sum + (Number(b.totalCost) || 0),
            0
        );

        // Production Cost Breakdown
        const productionCostBreakdown = allBatches.reduce(
            (acc, b) => ({
                material: acc.material + (Number(b.totalMaterialCost) || 0),
                labor: acc.labor + (Number(b.totalLaborCost) || 0),
                overhead: acc.overhead + (Number(b.totalOverheadCost) || 0),
            }),
            { material: 0, labor: 0, overhead: 0 }
        );

        // Cashflow Direct Costs (Material & Labor expenses)
        const materialExpenses = allCashflows
            .filter((c) => c.type === 'expense' && c.category === 'material_purchase')
            .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

        const laborExpenses = allCashflows
            .filter((c) => c.type === 'expense' && c.category === 'labor_payment')
            .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

        const totalCashflowDirectCosts = materialExpenses + laborExpenses;

        const cashflowDirectCostSplit = {
            material: materialExpenses,
            labor: laborExpenses,
        };

        // Utilization
        const capitalUtilization =
            totalCapital > 0 ? (totalExpenses / totalCapital) * 100 : 0;

        return {
            totalCapital,
            totalProductionCosts,
            totalCashflowDirectCosts,
            capitalUtilization,
            productionCostBreakdown,
            cashflowDirectCostSplit,
            recentBatches,
        };
    },
});
