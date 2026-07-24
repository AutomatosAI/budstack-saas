import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant/tenant";
import { sendEmail, emailTemplates } from "@/lib/email/email";
import {
  createOrder as createDrGreenOrder,
  getCurrencyByCountry,
} from "@/lib/drgreen/doctor-green-api";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { apiError, apiValidationError } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import { FALLBACK_DELIVERY_CHARGE } from "@/lib/drgreen/delivery";

export const POST = withAuth(async (req, { user }) => {
  try {
    // Get user from DB linked by email
    const email = user.email;

    if (!email) {
      return apiError(new Error("Unauthorized"), {
        route: "POST /api/orders",
        status: 401,
        safeMessage: "Unauthorized",
      });
    }

    const tenant = await getTenantFromRequest(req);

    if (!tenant) {
      return apiError(new Error("Tenant not found"), {
        route: "POST /api/orders",
        status: 404,
        safeMessage: "Tenant not found",
      });
    }

    const dbUser = await prisma.users.findFirst({
      where: {
        email,
        tenantId: tenant.id
      }
    });

    if (!dbUser) {
      return apiError(new Error("User not found in this store"), {
        route: "POST /api/orders",
        status: 404,
        safeMessage: "User not found in this store",
      });
    }

    const body = await req.json();
    const { items, shippingInfo } = body;

    if (!items || items.length === 0) {
      return apiValidationError("Cart is empty", "POST /api/orders");
    }

    // Calculate subtotal and shipping
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0,
    );
    // Legacy path: this route creates the local order BEFORE talking to Dr
    // Green, and does so through a different (snake_case) contract than the
    // live storefront checkout, so there is no authoritative delivery charge to
    // read here. Named rather than magic — the real number comes from Dr Green
    // on the /api/store/[slug]/orders/submit path (see lib/drgreen/delivery.ts).
    const shippingCost = FALLBACK_DELIVERY_CHARGE;
    const calculatedTotal = subtotal + shippingCost;

    // Determine currency from shipping country (default to ZAR - South Africa, the only live site)
    const currency = shippingInfo?.country
      ? getCurrencyByCountry(shippingInfo.country)
      : "ZAR";

    // Create order in BudStacks database first
    const order = await prisma.orders.create({
      data: {
        userId: dbUser.id,
        tenantId: tenant.id,
        subtotal,
        shippingCost,
        total: calculatedTotal,
        status: "PENDING",
        shippingInfo,
        notes: shippingInfo?.notes || "",
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            productName: item.name || `Product ${item.productId}`,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // Submit order to Dr. Green API
    let drGreenOrderId = null;

    // SECURITY (C3): Always use authenticated user's ID. Customer checkout
    // must never accept a client_id override from the request body — admin
    // role does not justify checking out as another customer through this
    // endpoint.
    const finalClientId = dbUser.id;

    try {
      const drGreenOrderData = {
        client_id: finalClientId,
        items: items.map((item: any) => ({
          product_id: item.productId,
          product_name: item.name || `Product ${item.productId}`,
          quantity: item.quantity,
          price: item.price,
        })),
        total_amount: calculatedTotal,
        currency: currency,
        shipping_address: shippingInfo,
        notes: shippingInfo?.notes || "",
        platform_order_number: order.orderNumber, // Reference to BudStacks order
      };

      const doctorGreenConfig = await getTenantDrGreenConfig(tenant.id);

      const drGreenOrder = await createDrGreenOrder(
        drGreenOrderData,
        doctorGreenConfig,
      );
      drGreenOrderId = drGreenOrder.id;

      // Update local order with Dr. Green order ID
      await prisma.orders.update({
        where: { id: order.id },
        data: {
          notes: `${shippingInfo?.notes || ""}\nDr. Green Order ID: ${drGreenOrderId}`,
        },
      });

      logger.info(
        `✅ Order submitted to Dr. Green API. Order ID: ${drGreenOrderId}`,
      );
    } catch (drGreenError: any) {
      console.error(
        "❌ Failed to submit order to Dr. Green API:",
        drGreenError,
      );

      // Update order status to indicate Dr. Green submission failed
      await prisma.orders.update({
        where: { id: order.id },
        data: {
          status: "PENDING",
          notes: `${shippingInfo?.notes || ""}\nDr. Green API Error: ${drGreenError.message || "Unknown error"}`,
        },
      });

      // Don't fail the entire order - just log the error
      // The order is created in BudStacks, tenant can manually process it
    }

    // Send order confirmation email
    const html = await emailTemplates.orderConfirmation(
      dbUser.firstName ? `${dbUser.firstName} ${dbUser.lastName || ''}` : "Customer",
      order.orderNumber,
      calculatedTotal.toFixed(2),
      items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price.toFixed(2),
      })),
      tenant.businessName,
    );

    sendEmail({
      to: email || "",
      subject: `Order Confirmation - #${order.orderNumber}`,
      html,
      tenantId: tenant.id,
      templateName: "orderConfirmation",
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
    }).catch((error) => {
      console.error("Failed to send order confirmation email:", error);
    });

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        drGreenOrderId: drGreenOrderId,
        drGreenSubmitted: drGreenOrderId !== null,
      },
    });
  } catch (error) {
    console.error("Order creation error:", error);
    return apiError(error, {
      route: "POST /api/orders",
      safeMessage: "Failed to create order",
    });
  }
});

export const GET = withAuth(async (req, { user }) => {
  try {
    // Auth Check
    const email = user.email;
    if (!email) {
      return apiError(new Error("Unauthorized"), {
        route: "GET /api/orders",
        status: 401,
        safeMessage: "Unauthorized",
      });
    }

    const tenant = await getTenantFromRequest(req);

    if (!tenant) {
      return apiError(new Error("Tenant not found"), {
        route: "GET /api/orders",
        status: 404,
        safeMessage: "Tenant not found",
      });
    }

    // DB User Link — scoped to this tenant so a shared email across stores
    // resolves to the correct tenant's user row.
    const dbUser = await prisma.users.findFirst({
      where: { email, tenantId: tenant.id },
    });
    if (!dbUser) {
      return NextResponse.json({ orders: [] });
    }

    // Get orders for the current user
    const orders = await prisma.orders.findMany({
      where: {
        userId: dbUser.id,
        tenantId: tenant.id,
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Orders fetch error:", error);
    return apiError(error, {
      route: "GET /api/orders",
      safeMessage: "Failed to fetch orders",
    });
  }
});
