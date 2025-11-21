/**
 * Batch lifecycle hooks
 */

export default {
    async beforeUpdate(event) {
        const { data, where } = event.params;

        // Check if status is being updated to 'completed'
        if (data.status === 'completed') {
            // Get the batch ID
            const batchId = where.id;

            // Fetch the current batch to check previous status
            const batch = await strapi.entityService.findOne('api::batch.batch', batchId, {
                populate: ['directCosts', 'product'],
            });

            // Only calculate costs if status is actually changing to completed
            if (batch && batch.status !== 'completed') {
                // Calculate batch costs
                await strapi.service('api::batch.batch').calculateBatchCosts(batchId);

                // Set completion date if not already set
                if (!data.completionDate) {
                    data.completionDate = new Date();
                }
            }
        }
    },
};
