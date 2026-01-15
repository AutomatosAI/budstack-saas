import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";
import { sendEmail, emailTemplates } from "@/lib/email";
import {
  createOrder as createDrGreenOrder,
  getCurrencyByCountry,
} from "@/lib/doctor-green-api";

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();

    if (!user?.id || !user.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from DB linked by email
    const email = user.emailAddresses[0].emailAddress;
    const dbUser = await prisma.users.findFirst({ where: { email } });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const tenant = await getTenantFromRequest(req);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await req.json();
    const { items, shippingInfo, total, clientId } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Calculate subtotal and shipping
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0,
    );
    const shippingCost = 5.0;
    const calculatedTotal = subtotal + shippingCost;

    // Determine currency from shipping country (default to ZAR - South Africa, the only live site)
    const currency = shippingInfo?.country
      ? getCurrencyByCountry(shippingInfo.country)
      : "ZAR";

    // Create order in BudStack database first
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
    try {
      const drGreenOrderData = {
        client_id: clientId || dbUser.id,
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
        platform_order_number: order.orderNumber, // Reference to BudStack order
      };

      // Fetch tenant-specific Dr Green Config
      const { getTenantDrGreenConfig } = await import("@/lib/tenant-config");
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

      console.log(
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
      // The order is created in BudStack, tenant can manually process it
    }

    // Send order confirmation email
    const html = await emailTemplates.orderConfirmation(
      user.firstName ? `${user.firstName} ${user.lastName || ''}` : "Customer",
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
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Auth Check
    const user = await currentUser();
    if (!user?.id || !user.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // DB User Link
    const email = user.emailAddresses[0].emailAddress;
    const dbUser = await prisma.users.findFirst({ where: { email } });
    if (!dbUser) {
      return NextResponse.json({ orders: [] });
    }

    const tenant = await getTenantFromRequest(req);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
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
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 },
    );
  }
}
