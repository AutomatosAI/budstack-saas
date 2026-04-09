
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedOrderTemplate() {
    console.log('📦 Seeding Order Confirmation Template...');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: sans-serif; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
  .header { text-align: center; margin-bottom: 30px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { text-align: left; background: #f9f9f9; padding: 10px; border-bottom: 2px solid #eee; }
  td { padding: 10px; border-bottom: 1px solid #eee; }
  .total-row { font-weight: bold; background: #f9f9f9; }
  .btn { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
  .center { text-align: center; }
  .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
</style>
</head>
<body>
  <div class="container">
      <div class="header">
        <h1>Order Confirmed!</h1>
        <p>Thanks for shopping with {{tenantName}}</p>
      </div>

      <p>Hi {{userName}},</p>
      <p>Your order <strong>#{{orderNumber}}</strong> has been successfully placed.</p>
      
      <h3>Order Details</h3>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th style="text-align: right;">Price</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          {{#each items}}
          <tr>
            <td>{{this.name}}</td>
            <td>{{this.quantity}}</td>
            <td style="text-align: right;">€{{toFixed this.price}}</td>
            <td style="text-align: right;">€{{multiply this.price this.quantity}}</td>
          </tr>
          {{/each}}
          <tr class="total-row">
            <td colspan="3" style="text-align: right;">Grand Total</td>
            <td style="text-align: right;">€{{toFixed total}}</td>
          </tr>
        </tbody>
      </table>
      
      <p><strong>Shipping Address:</strong><br/>{{shippingAddress}}</p>

      <div class="center" style="margin: 30px 0;">
        <a href="{{storeUrl}}/orders/{{orderNumber}}" class="btn">
           Track Order
        </a>
      </div>

      <div class="footer">
        <p>If you have any questions, reply to this email.</p>
      </div>
  </div>
</body>
</html>
    `.trim();

    const t = {
        key: 'orderConfirmation',
        name: 'Default Order Confirmation',
        subject: 'Order Confirmation #{{orderNumber}}',
        category: 'transactional',
    };

    console.log(`Processing ${t.name}...`);

    // Upsert Template
    let template = await prisma.email_templates.findFirst({
        where: { name: t.name, isSystem: true, tenantId: null }
    });

    if (template) {
        console.log(`  - Updating existing template: ${t.name}`);
        template = await prisma.email_templates.update({
            where: { id: template.id },
            data: {
                contentHtml: htmlContent,
                subject: t.subject
            }
        });
    } else {
        console.log(`  - Creating new template: ${t.name}`);
        template = await prisma.email_templates.create({
            data: {
                name: t.name,
                subject: t.subject,
                contentHtml: htmlContent,
                category: t.category,
                isSystem: true,
                tenantId: null
            }
        });
    }

    // Upsert Mapping
    console.log(`  - Mapping event '${t.key}'...`);
    const mapping = await prisma.email_event_mappings.findFirst({
        where: { eventType: t.key, tenantId: null }
    });

    if (mapping) {
        await prisma.email_event_mappings.update({
            where: { id: mapping.id },
            data: { templateId: template.id }
        });
    } else {
        await prisma.email_event_mappings.create({
            data: {
                eventType: t.key,
                tenantId: null,
                templateId: template.id
            }
        });
    }

    console.log('✅ Order Template Seeded!');
}

seedOrderTemplate()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
