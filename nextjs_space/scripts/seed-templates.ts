import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedTemplates() {
  console.log('🌱 Seeding templates...');

  const templates = [
    {
      name: 'Healing Buds',
      slug: 'healingbuds',
      description: 'Modern medical cannabis template with sage-teal design system, multi-language capabilities.',
      category: 'medical',
      version: '2.0.0',
      author: 'BudStack Team',
      tags: ['medical', 'multi-language'],
      layoutFilePath: 'templates/healingbuds/index.tsx',
      metadata: {},
      isActive: true,
      isPremium: false,
    },
    {
      name: 'GTA Cannabis',
      slug: 'gta-cannabis',
      description: 'Product-focused layout with rich cannabis-specific features.',
      category: 'dispensary',
      version: '1.0.0',
      author: 'BudStack Team',
      tags: ['dispensary', 'products'],
      layoutFilePath: 'templates/gta-cannabis/index.tsx',
      metadata: {},
      isActive: true,
      isPremium: false,
    },
    {
      name: 'Wellness & Nature',
      slug: 'wellness-nature',
      description: 'Organic, calming design with natural imagery and holistic wellness focus.',
      category: 'wellness',
      version: '1.0.0',
      author: 'BudStack Team',
      tags: ['wellness', 'nature', 'organic'],
      layoutFilePath: 'templates/wellness-nature/index.tsx',
      metadata: {},
      isActive: true,
      isPremium: false,
    },
  ];


  for (const template of templates) {
    const existing = await prisma.templates.findUnique({
      where: { slug: template.slug },
    });

    if (existing) {
      console.log(`  ✓ Template "${template.name}" already exists, updating...`);
      await prisma.templates.update({
        where: { slug: template.slug },
        data: template,
      });
    } else {
      console.log(`  + Creating template "${template.name}"...`);
      await prisma.templates.create({
        data: { ...template, id: crypto.randomUUID(), updatedAt: new Date() },
      });
    }
  }

  console.log('✅ Templates seeded successfully!\n');
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTemplates()
    .catch((error) => {
      console.error('❌ Error seeding templates:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
