/**
 * batch controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::batch.batch', ({ strapi }) => ({
  /**
   * Custom action to calculate batch costs
   */
  async calculateCosts(ctx) {
    const { id } = ctx.params;

    try {
      const costs = await strapi.service('api::batch.batch').calculateBatchCosts(parseInt(id));
      return ctx.send({ data: costs });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  /**
   * Custom action to complete a batch
   */
  async complete(ctx) {
    const { id } = ctx.params;

    try {
      const batch = await strapi.service('api::batch.batch').completeBatch(parseInt(id));
      return ctx.send({ data: batch });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },
}));
