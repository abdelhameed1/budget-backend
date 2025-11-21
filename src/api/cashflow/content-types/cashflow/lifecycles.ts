// Helper to safely parse decimal/number-like values
const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
};

// Recalculate totalInvestment for a given owner based on all their
// cashflows of type "owner_investment".
const recalcOwnerTotalInvestment = async (ownerId: number) => {
  if (!ownerId) return;

  const cashflows = await strapi.entityService.findMany('api::cashflow.cashflow', {
    // Cast filters to any to avoid tight coupling to generated Strapi types
    filters: {
      owner: { id: ownerId },
      type: 'owner_investment',
    } as any,
    fields: ['amount'],
  });

  const totalInvestment = (cashflows as Array<{ amount?: unknown }>).reduce(
    (sum, cf) => sum + toNumber(cf.amount),
    0
  );

  await strapi.entityService.update('api::owner.owner', ownerId, {
    data: { totalInvestment },
  });
};

const lifecycle = {
  // Store previous owner id before update so we can handle owner changes
  async beforeUpdate(event: any) {
    const id = event.params?.where?.id;
    if (!id) return;

    const existing = (await strapi.entityService.findOne('api::cashflow.cashflow', id, {
      populate: ['owner'],
    })) as any;

    const prevOwnerId = existing?.owner?.id ?? null;
    event.state = { ...(event.state || {}), prevOwnerId };
  },

  async afterCreate(event: any) {
    const cashflow = event.result;
    if (!cashflow) return;

    if (cashflow.type === 'owner_investment' && cashflow.owner?.id) {
      await recalcOwnerTotalInvestment(cashflow.owner.id);
    }
  },

  async afterUpdate(event: any) {
    const cashflow = event.result;
    if (!cashflow) return;

    const prevOwnerId: number | null | undefined = event.state?.prevOwnerId;
    const newOwnerId: number | undefined = cashflow.owner?.id;

    const affectedOwnerIds = new Set<number>();

    if (typeof prevOwnerId === 'number') {
      affectedOwnerIds.add(prevOwnerId);
    }
    if (typeof newOwnerId === 'number') {
      affectedOwnerIds.add(newOwnerId);
    }

    for (const ownerId of affectedOwnerIds) {
      await recalcOwnerTotalInvestment(ownerId);
    }
  },

  async afterDelete(event: any) {
    const cashflow = event.result;
    if (!cashflow) return;

    const ownerId: number | undefined = cashflow.owner?.id;
    if (ownerId) {
      await recalcOwnerTotalInvestment(ownerId);
    }
  },
};

export default lifecycle;
