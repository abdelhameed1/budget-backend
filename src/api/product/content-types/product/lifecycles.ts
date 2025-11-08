/**
 * Product lifecycle hooks
 */

export default {
  async beforeCreate(event: any) {
    const { data } = event.params;

    // Auto-generate SKU if not provided
    if (!data.sku) {
      const sku = await generateSKU(event);
      data.sku = sku;
    }
  },
};

/**
 * Generate unique SKU
 * Format: CAT-XXXXX
 * CAT = Category code (3 letters)
 * XXXXX = 5-digit random number (10000-99999)
 */
async function generateSKU(event: any) {
  const { data } = event.params;
  
  // Get category code
  let categoryCode = 'PRD'; // Default
  
  console.log('SKU Generation - Category data:', data.category);
  
  if (data.category) {
    try {
      // Extract category ID from relation object
      let categoryId = data.category;
      
      // Handle relation format: { set: [ { id: 1 } ] } or { id: 1 } or just 1
      if (typeof data.category === 'object') {
        if (data.category.set && Array.isArray(data.category.set) && data.category.set.length > 0) {
          categoryId = data.category.set[0].id;
        } else if (data.category.id) {
          categoryId = data.category.id;
        }
      }
      
      console.log('SKU Generation - Extracted Category ID:', categoryId);
      
      if (categoryId) {
        // Use entityService.findOne with just the ID (no where clause needed)
        const category = await strapi.entityService.findOne(
          'api::category.category',
          categoryId,
          {
            fields: ['code']
          }
        );
        
        console.log('SKU Generation - Category found:', category);
        
        if (category && category.code) {
          categoryCode = category.code.toUpperCase();
        }
      }
    } catch (error) {
      console.error('SKU Generation - Error fetching category:', error);
      categoryCode = 'PRD';
    }
  }

  // Generate a 5-digit random number
  const randomNumber = Math.floor(10000 + Math.random() * 90000);
  
  const sku = `${categoryCode}-${randomNumber}`;
  console.log('SKU Generation - Generated SKU:', sku);
  
  // Format: CAT-XXXXX
  return sku;
}
