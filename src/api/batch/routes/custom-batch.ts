export default {
  routes: [
    {
      method: 'POST',
      path: '/batches/:id/calculate-costs',
      handler: 'batch.calculateCosts',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/batches/:id/complete',
      handler: 'batch.complete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
