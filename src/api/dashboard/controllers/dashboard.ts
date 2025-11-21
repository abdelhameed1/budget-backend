export default {
    async getStats(ctx) {
        try {
            const data = await strapi.service('api::dashboard.dashboard').getStats();
            ctx.body = data;
        } catch (err) {
            ctx.badRequest('Dashboard stats error', { moreDetails: err });
        }
    },
};
