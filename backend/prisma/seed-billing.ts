import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedBillingData() {
  console.log('🌱 Seeding billing data...');

  // Create features first
  const features = await prisma.feature.createMany({
    data: [
      // Core features
      {
        key: 'basic_pipeline',
        name: 'Basic Pipeline Management',
        description: 'Manage contacts and track deal stages',
        category: 'core',
        creditCost: 0,
        usageLimit: null,
        isBoolean: true
      },
      {
        key: 'email_sync',
        name: 'Email Synchronization',
        description: 'Sync emails from Gmail and Outlook',
        category: 'core',
        creditCost: 0,
        usageLimit: null,
        isBoolean: true
      },
      
      // AI features
      {
        key: 'ai_investor_matching',
        name: 'AI Investor Matching',
        description: 'Find relevant investors using AI',
        category: 'ai',
        creditCost: 2,
        usageLimit: 10,
        isBoolean: false
      },
      {
        key: 'ai_email_drafts',
        name: 'AI Email Drafts',
        description: 'Generate personalized emails',
        category: 'ai',
        creditCost: 1,
        usageLimit: 5,
        isBoolean: false
      },
      {
        key: 'sentiment_analysis',
        name: 'Sentiment Monitoring',
        description: 'Track relationship sentiment over time',
        category: 'ai',
        creditCost: 1,
        usageLimit: null,
        isBoolean: true
      },
      {
        key: 'feature_intelligence',
        name: 'Feature Intelligence',
        description: 'AI-powered product feature analysis',
        category: 'ai',
        creditCost: 5,
        usageLimit: 3,
        isBoolean: false
      },

      // Collaboration features
      {
        key: 'team_collaboration',
        name: 'Team Collaboration',
        description: 'Share pipeline with team members',
        category: 'collaboration',
        creditCost: 0,
        usageLimit: null,
        isBoolean: true
      },
      {
        key: 'advanced_permissions',
        name: 'Advanced Permissions',
        description: 'Role-based access control',
        category: 'collaboration',
        creditCost: 0,
        usageLimit: null,
        isBoolean: true
      },

      // Analytics features
      {
        key: 'advanced_analytics',
        name: 'Advanced Analytics',
        description: 'Detailed pipeline insights and forecasting',
        category: 'analytics',
        creditCost: 0,
        usageLimit: null,
        isBoolean: true
      },
      {
        key: 'custom_reports',
        name: 'Custom Reports',
        description: 'Build custom dashboards and reports',
        category: 'analytics',
        creditCost: 0,
        usageLimit: null,
        isBoolean: true
      },

      // Enterprise features
      {
        key: 'api_access',
        name: 'API Access',
        description: 'Full REST API for integrations',
        category: 'enterprise',
        creditCost: 0,
        usageLimit: null,
        isBoolean: true
      },
      {
        key: 'white_label',
        name: 'White Label',
        description: 'Custom branding and domain',
        category: 'enterprise',
        creditCost: 0,
        usageLimit: null,
        isBoolean: true
      }
    ],
    skipDuplicates: true
  });

  console.log(`✅ Created ${features.count} features`);

  // Create plans
  const starterPlan = await prisma.plan.create({
    data: {
      name: 'starter',
      displayName: 'Starter',
      description: 'Perfect for solo founders getting started',
      priceMonthly: 0,
      priceYearly: 0,
      contactLimit: 50,
      teamSeats: 1,
      creditsPerMonth: 10,
      isActive: true,
      sortOrder: 1,
      isPopular: false,
      isMostAdvanced: false
    }
  });

  const growthPlan = await prisma.plan.create({
    data: {
      name: 'growth',
      displayName: 'Growth',
      description: 'For growing startups actively fundraising',
      priceMonthly: 4900, // $49.00 in cents
      priceYearly: 47040, // $470.40 in cents (20% discount)
      contactLimit: 500,
      teamSeats: 2,
      creditsPerMonth: 100,
      isActive: true,
      sortOrder: 2,
      isPopular: true,
      isMostAdvanced: false
    }
  });

  const scalePlan = await prisma.plan.create({
    data: {
      name: 'scale',
      displayName: 'Scale',
      description: 'For scaling companies with teams',
      priceMonthly: 9900, // $99.00 in cents
      priceYearly: 95040, // $950.40 in cents (20% discount)
      contactLimit: null, // unlimited
      teamSeats: 5,
      creditsPerMonth: 300,
      isActive: true,
      sortOrder: 3,
      isPopular: false,
      isMostAdvanced: false
    }
  });

  const enterprisePlan = await prisma.plan.create({
    data: {
      name: 'enterprise',
      displayName: 'Enterprise',
      description: 'For large organizations with custom needs',
      priceMonthly: 29900, // $299.00 in cents
      priceYearly: 287040, // $2870.40 in cents (20% discount)
      contactLimit: null, // unlimited
      teamSeats: 25,
      creditsPerMonth: 1000,
      isActive: true,
      sortOrder: 4,
      isPopular: false,
      isMostAdvanced: true
    }
  });

  console.log('✅ Created 4 plans');

  // Get all features to assign to plans
  const allFeatures = await prisma.feature.findMany();
  const featureMap = new Map(allFeatures.map(f => [f.key, f]));

  // Define plan-feature mappings
  const planFeatures = [
    // Starter Plan
    { plan: starterPlan, features: ['basic_pipeline', 'email_sync'] },
    
    // Growth Plan
    { 
      plan: growthPlan, 
      features: [
        'basic_pipeline', 
        'email_sync', 
        'ai_investor_matching', 
        'ai_email_drafts', 
        'sentiment_analysis'
      ] 
    },
    
    // Scale Plan
    { 
      plan: scalePlan, 
      features: [
        'basic_pipeline', 
        'email_sync', 
        'ai_investor_matching', 
        'ai_email_drafts', 
        'sentiment_analysis',
        'feature_intelligence',
        'team_collaboration',
        'advanced_analytics',
        'custom_reports'
      ] 
    },
    
    // Enterprise Plan (all features)
    { 
      plan: enterprisePlan, 
      features: allFeatures.map(f => f.key)
    }
  ];

  // Create plan-feature relationships
  for (const { plan, features } of planFeatures) {
    for (const featureKey of features) {
      const feature = featureMap.get(featureKey);
      if (feature) {
        await prisma.planFeature.create({
          data: {
            planId: plan.id,
            featureId: feature.id,
            isIncluded: true,
            // Override limits for specific plans
            customLimit: plan.name === 'growth' && featureKey === 'ai_investor_matching' ? 20 : null,
            customCreditCost: null
          }
        });
      }
    }
  }

  console.log('✅ Created plan-feature relationships');
  console.log('🎉 Billing data seeded successfully!');

  console.log('\n📋 Summary:');
  console.log('- Starter: Free, 50 contacts, 10 credits/month');
  console.log('- Growth: $49/month, 500 contacts, 100 credits/month (POPULAR)');
  console.log('- Scale: $99/month, unlimited contacts, 300 credits/month');
  console.log('- Enterprise: $299/month, unlimited contacts, 1000 credits/month');
}

async function main() {
  try {
    await seedBillingData();
  } catch (error) {
    console.error('❌ Error seeding billing data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}