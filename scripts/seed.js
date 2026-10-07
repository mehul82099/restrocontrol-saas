const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') throw new Error('Refusing to seed production without ALLOW_DEMO_SEED=true');
  console.log('Seeding RestroControl demo database...');

  // 1. Seed Plans
  const plans = [
    {
      code: 'STARTER',
      name: 'Starter Plan',
      priceMonthly: 1499,
      priceYearly: 14990,
      maxOutlets: 1,
      maxUsers: 3,
      maxOrdersPerMonth: 1000,
      hasAdvancedReports: false,
      hasAiFeatures: false,
      features: JSON.stringify(['1 Outlet', 'Up to 3 Users', '1,000 Orders/mo', 'POS & KOT', 'Recipe Engine', 'Basic Inventory']),
    },
    {
      code: 'GROWTH',
      name: 'Growth Plan',
      priceMonthly: 2999,
      priceYearly: 29990,
      maxOutlets: 2,
      maxUsers: 8,
      maxOrdersPerMonth: 5000,
      hasAdvancedReports: true,
      hasAiFeatures: false,
      features: JSON.stringify(['2 Outlets', 'Up to 8 Users', '5,000 Orders/mo', 'Full Inventory Ledger', 'Wastage Tracking', 'Variance Analytics']),
    },
    {
      code: 'PRO',
      name: 'Pro Kitchen',
      priceMonthly: 4999,
      priceYearly: 49990,
      maxOutlets: 5,
      maxUsers: 20,
      maxOrdersPerMonth: 20000,
      hasAdvancedReports: true,
      hasAiFeatures: true,
      features: JSON.stringify(['5 Outlets', 'Up to 20 Users', '20,000 Orders/mo', 'Purchase Orders', 'Stock Audits', 'Recipe Food Costing', 'All 20 Reports']),
    },
    {
      code: 'MULTI_OUTLET',
      name: 'Multi-Outlet Enterprise',
      priceMonthly: 9999,
      priceYearly: 99990,
      maxOutlets: 25,
      maxUsers: 100,
      maxOrdersPerMonth: 100000,
      hasAdvancedReports: true,
      hasAiFeatures: true,
      features: JSON.stringify(['25 Outlets', 'Unlimited Staff', '100,000 Orders/mo', 'Central Kitchen Transfers', 'Priority 24/7 SLA', 'Custom Integrations']),
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      create: plan,
      update: plan,
    });
  }
  const proPlan = await prisma.plan.findUnique({ where: { code: 'PRO' } });

  // 2. Seed Restaurant "Demo Kitchen"
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'demo-kitchen' },
    create: {
      name: 'Demo Kitchen',
      slug: 'demo-kitchen',
      email: 'owner@demokitchen.com',
      phone: '+91 98765 43210',
      currency: 'INR',
      currencySymbol: '₹',
      timezone: 'Asia/Kolkata',
      taxNumber: 'GSTIN27AAAAA0000A1Z5',
      address: '100 Feet Road, Indiranagar, Bangalore, Karnataka 560038',
      subscription: {
        create: {
          planId: proPlan.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      },
    },
    update: {},
  });

  console.log(`Restaurant created: ${restaurant.name} (${restaurant.id})`);

  // 3. Seed Outlets
  const outlet1 = await prisma.outlet.upsert({
    where: {
      restaurantId_code: {
        restaurantId: restaurant.id,
        code: 'MAIN',
      },
    },
    create: {
      restaurantId: restaurant.id,
      name: 'Main Branch - Indiranagar',
      code: 'MAIN',
      address: '100 Feet Road, Indiranagar, Bangalore',
      phone: '+91 98765 43211',
      isDefault: true,
      isActive: true,
    },
    update: {},
  });

  const outlet2 = await prisma.outlet.upsert({
    where: {
      restaurantId_code: {
        restaurantId: restaurant.id,
        code: 'EXPRESS',
      },
    },
    create: {
      restaurantId: restaurant.id,
      name: 'Express Kiosk - Cyber City',
      code: 'EXPRESS',
      address: 'DLF Cyber City, Tower B, Ground Floor',
      phone: '+91 98765 43212',
      isDefault: false,
      isActive: true,
    },
    update: {},
  });

  // 4. Seed Users (All 5 Roles)
  const passwordHash = await bcrypt.hash('password123', 10);
  const usersData = [
    { email: 'owner@demokitchen.com', name: 'Arjun Mehta (Owner)', role: 'OWNER' },
    { email: 'manager@demokitchen.com', name: 'Vikram Singh (Manager)', role: 'MANAGER' },
    { email: 'cashier@demokitchen.com', name: 'Neha Sharma (Cashier)', role: 'CASHIER' },
    { email: 'kitchen@demokitchen.com', name: 'Chef Suresh (Kitchen)', role: 'KITCHEN_STAFF' },
    { email: 'inventory@demokitchen.com', name: 'Rohan Gupta (Inventory)', role: 'INVENTORY_MANAGER' },
  ];

  const createdUsers = {};
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: {
        restaurantId_email: {
          restaurantId: restaurant.id,
          email: u.email,
        },
      },
      create: {
        restaurantId: restaurant.id,
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
      },
      update: { role: u.role, passwordHash },
    });
    createdUsers[u.role] = user;

    // Link user to outlet1
    await prisma.userOutlet.upsert({
      where: {
        userId_outletId: {
          userId: user.id,
          outletId: outlet1.id,
        },
      },
      create: {
        userId: user.id,
        outletId: outlet1.id,
      },
      update: {},
    });
  }

  // 5. Seed Dining Tables
  const tableData = [
    { tableNumber: 'T-01', capacity: 2, section: 'Indoor Front' },
    { tableNumber: 'T-02', capacity: 2, section: 'Indoor Front' },
    { tableNumber: 'T-03', capacity: 4, section: 'Main Hall' },
    { tableNumber: 'T-04', capacity: 4, section: 'Main Hall' },
    { tableNumber: 'T-05', capacity: 6, section: 'Family Corner' },
    { tableNumber: 'T-06', capacity: 6, section: 'Family Corner' },
    { tableNumber: 'T-07', capacity: 8, section: 'Private Dining' },
    { tableNumber: 'T-08', capacity: 4, section: 'Outdoor Terrace' },
  ];

  for (const t of tableData) {
    await prisma.diningTable.upsert({
      where: {
        outletId_tableNumber: {
          outletId: outlet1.id,
          tableNumber: t.tableNumber,
        },
      },
      create: {
        restaurantId: restaurant.id,
        outletId: outlet1.id,
        tableNumber: t.tableNumber,
        capacity: t.capacity,
        section: t.section,
        status: 'AVAILABLE',
      },
      update: {},
    });
  }

  // 6. Seed Suppliers
  const suppliersData = [
    { name: 'Royal Poultry Farms', contactPerson: 'Mohd. Salim', phone: '+91 98111 22334', email: 'sales@royalpoultry.in', address: 'Market Yard, Gate 2' },
    { name: 'Heritage Dairy Products', contactPerson: 'Karan Patel', phone: '+91 98222 33445', email: 'orders@heritagedairy.com', address: 'Industrial Area, Phase 1' },
    { name: 'Maharaja Spices & Grains', contactPerson: 'Dinesh Agarwal', phone: '+91 98333 44556', email: 'info@maharajaspices.com', address: 'Grain Mandi, Shop 42' },
    { name: 'Farm Fresh Agro Veg', contactPerson: 'Ramesh Patil', phone: '+91 98444 55667', email: 'farmfresh@agromarket.in', address: 'APMC Market Yard' },
  ];

  const createdSuppliers = {};
  for (const s of suppliersData) {
    const supplier = await prisma.supplier.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name: s.name,
        },
      },
      create: {
        restaurantId: restaurant.id,
        name: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: s.email,
        address: s.address,
      },
      update: {},
    });
    createdSuppliers[s.name] = supplier;
  }

  // 7. Seed Ingredient Categories & Ingredients
  const ingCategoryRaw = await prisma.ingredientCategory.upsert({
    where: { restaurantId_name: { restaurantId: restaurant.id, name: 'Meat & Poultry' } },
    create: { restaurantId: restaurant.id, name: 'Meat & Poultry' },
    update: {},
  });
  const ingCategoryDairy = await prisma.ingredientCategory.upsert({
    where: { restaurantId_name: { restaurantId: restaurant.id, name: 'Dairy' } },
    create: { restaurantId: restaurant.id, name: 'Dairy' },
    update: {},
  });
  const ingCategoryGrains = await prisma.ingredientCategory.upsert({
    where: { restaurantId_name: { restaurantId: restaurant.id, name: 'Grains & Staples' } },
    create: { restaurantId: restaurant.id, name: 'Grains & Staples' },
    update: {},
  });
  const ingCategoryVeg = await prisma.ingredientCategory.upsert({
    where: { restaurantId_name: { restaurantId: restaurant.id, name: 'Vegetables' } },
    create: { restaurantId: restaurant.id, name: 'Vegetables' },
    update: {},
  });
  const ingCategorySpices = await prisma.ingredientCategory.upsert({
    where: { restaurantId_name: { restaurantId: restaurant.id, name: 'Spices & Oils' } },
    create: { restaurantId: restaurant.id, name: 'Spices & Oils' },
    update: {},
  });

  const ingredientsData = [
    { name: 'Chicken', unit: 'KG', cost: 180, min: 10, reorder: 15, stock: 50, cat: ingCategoryRaw.id, sup: 'Royal Poultry Farms' },
    { name: 'Paneer', unit: 'KG', cost: 280, min: 5, reorder: 8, stock: 20, cat: ingCategoryDairy.id, sup: 'Heritage Dairy Products' },
    { name: 'Rice', unit: 'KG', cost: 70, min: 20, reorder: 30, stock: 80, cat: ingCategoryGrains.id, sup: 'Maharaja Spices & Grains' },
    { name: 'Tomato', unit: 'KG', cost: 30, min: 5, reorder: 10, stock: 25, cat: ingCategoryVeg.id, sup: 'Farm Fresh Agro Veg' },
    { name: 'Onion', unit: 'KG', cost: 25, min: 8, reorder: 12, stock: 35, cat: ingCategoryVeg.id, sup: 'Farm Fresh Agro Veg' },
    { name: 'Butter', unit: 'KG', cost: 450, min: 3, reorder: 5, stock: 15, cat: ingCategoryDairy.id, sup: 'Heritage Dairy Products' },
    { name: 'Oil', unit: 'L', cost: 130, min: 5, reorder: 10, stock: 30, cat: ingCategorySpices.id, sup: 'Maharaja Spices & Grains' },
    { name: 'Cream', unit: 'L', cost: 220, min: 2, reorder: 4, stock: 10, cat: ingCategoryDairy.id, sup: 'Heritage Dairy Products' },
    { name: 'Curd', unit: 'KG', cost: 60, min: 4, reorder: 6, stock: 18, cat: ingCategoryDairy.id, sup: 'Heritage Dairy Products' },
    { name: 'Spices', unit: 'KG', cost: 600, min: 2, reorder: 3, stock: 10, cat: ingCategorySpices.id, sup: 'Maharaja Spices & Grains' },
  ];

  const createdIngredients = {};
  for (const ing of ingredientsData) {
    const created = await prisma.ingredient.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name: ing.name,
        },
      },
      create: {
        restaurantId: restaurant.id,
        categoryId: ing.cat,
        name: ing.name,
        unit: ing.unit,
        costPerUnit: ing.cost,
        minimumStock: ing.min,
        reorderLevel: ing.reorder,
        currentStock: ing.stock,
        preferredSupplierId: createdSuppliers[ing.sup]?.id,
      },
      update: {
        costPerUnit: ing.cost,
        minimumStock: ing.min,
        reorderLevel: ing.reorder,
      },
    });
    createdIngredients[ing.name] = created;

    // Seed initial stock in OutletInventory for outlet1
    await prisma.outletInventory.upsert({
      where: {
        outletId_ingredientId: {
          outletId: outlet1.id,
          ingredientId: created.id,
        },
      },
      create: {
        restaurantId: restaurant.id,
        outletId: outlet1.id,
        ingredientId: created.id,
        currentStock: ing.stock,
        minimumStock: ing.min,
        reorderLevel: ing.reorder,
      },
      update: {
        currentStock: ing.stock,
      },
    });

    // Seed initial OPENING movement in the immutable ledger
    const existingMovement = await prisma.inventoryMovement.findFirst({
      where: {
        restaurantId: restaurant.id,
        outletId: outlet1.id,
        ingredientId: created.id,
        movementType: 'OPENING',
      },
    });

    if (!existingMovement) {
      await prisma.inventoryMovement.create({
        data: {
          restaurantId: restaurant.id,
          outletId: outlet1.id,
          ingredientId: created.id,
          movementType: 'OPENING',
          quantity: ing.stock,
          unit: ing.unit,
          costPerUnit: ing.cost,
          totalCost: ing.stock * ing.cost,
          reason: 'Initial opening stock setup',
          userId: createdUsers['OWNER']?.id,
        },
      });
    }
  }

  // 8. Seed Menu Categories
  const categoryNames = [
    'Biryani',
    'North Indian',
    'Chinese',
    'Starters',
    'Breads',
    'Beverages',
  ];

  const createdCategories = {};
  for (let i = 0; i < categoryNames.length; i++) {
    const cat = await prisma.category.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name: categoryNames[i],
        },
      },
      create: {
        restaurantId: restaurant.id,
        name: categoryNames[i],
        sortOrder: i + 1,
        color: ['#f59e0b', '#ef4444', '#10b981', '#6366f1', '#ec4899', '#06b6d4'][i % 6],
      },
      update: {},
    });
    createdCategories[categoryNames[i]] = cat;
  }

  // 9. Seed Menu Items & Recipes
  const menuItemsData = [
    {
      category: 'Biryani',
      name: 'Chicken Biryani',
      description: 'Fragrant long-grain basmati rice layered with tender spiced chicken pieces, caramelized onions, and royal spices.',
      basePrice: 250,
      isVeg: false,
      recipe: {
        name: 'Standard Chicken Biryani Recipe',
        yieldQuantity: 1,
        yieldUnit: 'PORTION',
        prepTimeMinutes: 25,
        items: [
          { ingredient: 'Chicken', quantity: 250, unit: 'G', wastePercentage: 0 },
          { ingredient: 'Rice', quantity: 180, unit: 'G', wastePercentage: 0 },
          { ingredient: 'Oil', quantity: 25, unit: 'ML', wastePercentage: 0 },
          { ingredient: 'Onion', quantity: 80, unit: 'G', wastePercentage: 5 },
          { ingredient: 'Curd', quantity: 50, unit: 'G', wastePercentage: 0 },
          { ingredient: 'Spices', quantity: 15, unit: 'G', wastePercentage: 0 },
        ],
      },
    },
    {
      category: 'North Indian',
      name: 'Paneer Butter Masala',
      description: 'Cottage cheese cubes simmered in rich silky tomato, butter, and cashew gravy infused with aromatic fenugreek.',
      basePrice: 220,
      isVeg: true,
      recipe: {
        name: 'Paneer Butter Masala Recipe',
        yieldQuantity: 1,
        yieldUnit: 'PORTION',
        prepTimeMinutes: 15,
        items: [
          { ingredient: 'Paneer', quantity: 200, unit: 'G', wastePercentage: 0 },
          { ingredient: 'Butter', quantity: 30, unit: 'G', wastePercentage: 0 },
          { ingredient: 'Tomato', quantity: 150, unit: 'G', wastePercentage: 5 },
          { ingredient: 'Onion', quantity: 70, unit: 'G', wastePercentage: 5 },
          { ingredient: 'Cream', quantity: 40, unit: 'ML', wastePercentage: 0 },
          { ingredient: 'Spices', quantity: 10, unit: 'G', wastePercentage: 0 },
        ],
      },
    },
    {
      category: 'Starters',
      name: 'Chicken Tikka',
      description: 'Boneless chicken marinated in spiced curd, mustard oil, and kashmiri chili, char-grilled to perfection.',
      basePrice: 280,
      isVeg: false,
      recipe: {
        name: 'Chicken Tikka Recipe',
        yieldQuantity: 1,
        yieldUnit: 'PORTION',
        prepTimeMinutes: 20,
        items: [
          { ingredient: 'Chicken', quantity: 250, unit: 'G', wastePercentage: 0 },
          { ingredient: 'Curd', quantity: 60, unit: 'G', wastePercentage: 0 },
          { ingredient: 'Oil', quantity: 15, unit: 'ML', wastePercentage: 0 },
          { ingredient: 'Spices', quantity: 20, unit: 'G', wastePercentage: 0 },
        ],
      },
    },
    {
      category: 'Chinese',
      name: 'Chilli Paneer Dry',
      description: 'Crisp paneer tossed with crunchy onions, capsicum, and oriental sauces.',
      basePrice: 210,
      isVeg: true,
      recipe: {
        name: 'Chilli Paneer Recipe',
        yieldQuantity: 1,
        yieldUnit: 'PORTION',
        prepTimeMinutes: 12,
        items: [
          { ingredient: 'Paneer', quantity: 180, unit: 'G', wastePercentage: 0 },
          { ingredient: 'Onion', quantity: 60, unit: 'G', wastePercentage: 5 },
          { ingredient: 'Oil', quantity: 20, unit: 'ML', wastePercentage: 0 },
          { ingredient: 'Spices', quantity: 10, unit: 'G', wastePercentage: 0 },
        ],
      },
    },
    {
      category: 'Breads',
      name: 'Butter Naan',
      description: 'Traditional leavened clay oven bread brushed generously with pure butter.',
      basePrice: 45,
      isVeg: true,
      recipe: {
        name: 'Butter Naan Recipe',
        yieldQuantity: 1,
        yieldUnit: 'PORTION',
        prepTimeMinutes: 5,
        items: [
          { ingredient: 'Butter', quantity: 15, unit: 'G', wastePercentage: 0 },
        ],
      },
    },
    {
      category: 'Beverages',
      name: 'Fresh Lime Soda',
      description: 'Refreshing sparkling soda with fresh squeezed lime juice and rock salt.',
      basePrice: 60,
      isVeg: true,
      recipe: null,
    },
  ];

  for (const m of menuItemsData) {
    const item = await prisma.menuItem.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name: m.name,
        },
      },
      create: {
        restaurantId: restaurant.id,
        categoryId: createdCategories[m.category].id,
        name: m.name,
        description: m.description,
        basePrice: m.basePrice,
        isVeg: m.isVeg,
        isAvailable: true,
        taxRate: 5.0,
      },
      update: {
        basePrice: m.basePrice,
      },
    });

    // Seed Recipe if provided
    if (m.recipe) {
      const existingRecipe = await prisma.recipe.findFirst({
        where: {
          restaurantId: restaurant.id,
          menuItemId: item.id,
        },
      });

      if (!existingRecipe) {
        const recipe = await prisma.recipe.create({
          data: {
            restaurantId: restaurant.id,
            menuItemId: item.id,
            name: m.recipe.name,
            yieldQuantity: m.recipe.yieldQuantity,
            yieldUnit: m.recipe.yieldUnit,
            prepTimeMinutes: m.recipe.prepTimeMinutes,
          },
        });

        for (const rItem of m.recipe.items) {
          const ing = createdIngredients[rItem.ingredient];
          if (ing) {
            await prisma.recipeItem.create({
              data: {
                recipeId: recipe.id,
                ingredientId: ing.id,
                quantity: rItem.quantity,
                unit: rItem.unit,
                wastePercentage: rItem.wastePercentage,
              },
            });
          }
        }
      }
    }
  }

  // 10. Seed Customers
  const customer1 = await prisma.customer.upsert({
    where: {
      restaurantId_phone: {
        restaurantId: restaurant.id,
        phone: '9876500001',
      },
    },
    create: {
      restaurantId: restaurant.id,
      name: 'Rahul Verma',
      phone: '9876500001',
      email: 'rahul.verma@example.com',
      totalVisits: 3,
      totalSpend: 1850,
    },
    update: {},
  });

  console.log('Seed completed successfully!');
  console.log('Ready to test and run RestroControl!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
