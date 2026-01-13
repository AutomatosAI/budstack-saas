import { render } from "@react-email/components";
import { MailerService } from "./mailer";
import WelcomeEmail from "@/emails/welcome";
import PasswordResetEmail from "@/emails/password-reset";
import OrderConfirmationEmail from "@/emails/order-confirmation";
import TenantWelcomeEmail from "@/emails/tenant-welcome";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  tenantId: string; // Made required for new system
  templateName: string;
  metadata?: any;
  variables?: any;
}

export async function sendEmail({
  to,
  subject,
  html,
  from,
  tenantId,
  templateName,
  metadata,
  variables,
}: EmailOptions) {
  if (!tenantId) {
    console.warn(
      '[sendEmail] Missing tenantId, using "SYSTEM" fallback but this may fail if no default config',
    );
    tenantId = "SYSTEM";
  }

  return MailerService.send({
    tenantId,
    to,
    subject,
    html,
    templateName,
    metadata,
    variables,
    from,
  });
}

// Email templates helper to render React components to HTML
export const emailTemplates = {
  welcome: (userName: string, tenantName: string) => {
    const html = render(
      WelcomeEmail({
        userName,
        tenantName,
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin`,
      }),
    );
    return html;
  },

  passwordReset: (userName: string, resetLink: string, tenantName: string) => {
    const html = render(
      PasswordResetEmail({ userName, resetLink, tenantName }),
    );
    return html;
  },

  orderConfirmation: (
    userName: string,
    orderNumber: string,
    orderTotal: string,
    orderItems: any[],
    tenantName: string,
  ) => {
    // Convert orderTotal string to number if needed, though props expect number.
    // Existing usage passes string .toFixed(2).
    const total = parseFloat(orderTotal);
    const html = render(
      OrderConfirmationEmail({
        userName,
        orderNumber,
        items: orderItems,
        total,
        shippingAddress: "See Order Details", // Placeholder as it wasn't passed in legacy
        tenantName,
      }),
    );
    return html;
  },

  tenantWelcome: (adminName: string, tenantName: string, subdomain: string) => {
    const html = render(
      TenantWelcomeEmail({
        adminName,
        tenantName,
        subdomain,
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin`,
      }),
    );
    return html;
  },
};
