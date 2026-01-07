
import { Resend } from 'resend';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({ to, subject, html, from }: EmailOptions) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const data = await resend.emails.send({
      from: from || process.env.EMAIL_FROM || 'noreply@budstack.to',
      to,
      subject,
      html,
    });

    console.log('Email sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}

// Email templates
export const emailTemplates = {
  welcome: (userName: string, tenantName: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${tenantName}!</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Welcome to ${tenantName}! We're excited to have you as part of our community.</p>
            <p>Your account has been successfully created. You can now browse our products and place orders.</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}" class="button">Start Shopping</a>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Best regards,<br>The ${tenantName} Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${tenantName}. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `,

  passwordReset: (userName: string, resetLink: string, tenantName: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <a href="${resetLink}" class="button">Reset Password</a>
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you didn't request this, please ignore this email.
            </div>
            <p>Best regards,<br>The ${tenantName} Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${tenantName}. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `,

  orderConfirmation: (userName: string, orderNumber: string, orderTotal: string, orderItems: any[], tenantName: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .order-details { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .order-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .total { font-size: 18px; font-weight: bold; padding-top: 15px; text-align: right; }
          .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Order Confirmed!</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Thank you for your order! Your order has been confirmed and is being processed.</p>
            <div class="order-details">
              <h3>Order #${orderNumber}</h3>
              ${orderItems.map(item => `
                <div class="order-item">
                  <span>${item.quantity}x ${item.name}</span>
                  <span>€${item.price}</span>
                </div>
              `).join('')}
              <div class="total">Total: €${orderTotal}</div>
            </div>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="button">View Order Status</a>
            <p>You'll receive another email when your order ships.</p>
            <p>Best regards,<br>The ${tenantName} Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${tenantName}. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `,

  tenantWelcome: (adminName: string, tenantName: string, subdomain: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .info-box { background: white; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #8b5cf6; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to BudStack!</h1>
          </div>
          <div class="content">
            <p>Hi ${adminName},</p>
            <p>Congratulations! Your store <strong>${tenantName}</strong> is now live on BudStack.</p>
            <div class="info-box">
              <h3>Your Store Details:</h3>
              <p><strong>Store Name:</strong> ${tenantName}</p>
              <p><strong>Store URL:</strong> https://${subdomain}.budstack.to</p>
              <p><strong>Admin Dashboard:</strong> https://${subdomain}.budstack.to/tenant-admin</p>
            </div>
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Customize your store's branding and colors</li>
              <li>Add your products and pricing</li>
              <li>Set up your custom domain (optional)</li>
              <li>Configure your store settings</li>
            </ul>
            <a href="https://${subdomain}.budstack.to/tenant-admin" class="button">Go to Dashboard</a>
            <p>Need help? Check out our documentation or contact support.</p>
            <p>Best regards,<br>The BudStack Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} BudStack. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `,
};
