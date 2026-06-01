
import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { eraseUser } from "@/lib/gdpr/erasure";
import { getClientInfo } from "@/lib/audit-log";

export async function POST(req: Request) {
    // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
        throw new Error(
            "Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
        );
    }

    // Get the headers
    const headerPayload = headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
        return new NextResponse("Error occured -- no svix headers", {
            status: 400,
        });
    }

    // Get the body
    const payload = await req.json();
    const body = JSON.stringify(payload);

    // Create a new Svix instance with your secret.
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt: WebhookEvent;

    // Verify the payload with the headers
    try {
        evt = wh.verify(body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        }) as WebhookEvent;
    } catch (err) {
        console.error("Error verifying webhook:", err);
        return new NextResponse("Error occured", {
            status: 400,
        });
    }

    // Get the ID and type
    const { id } = evt.data;
    const eventType = evt.type;

    console.log(`Clerk webhook received: id=${id} type=${eventType}`);

    if (eventType === "user.created" || eventType === "user.updated") {
        const { id, email_addresses, first_name, last_name, primary_email_address_id } = evt.data;
        const email = email_addresses.find((e) => e.id === primary_email_address_id)?.email_address || email_addresses[0]?.email_address;

        if (!email) {
            return new NextResponse("No email found in user data", { status: 400 });
        }

        const name = `${first_name || ""} ${last_name || ""}`.trim();

        // We upsert the user based on email.
        // Note: We do NOT blindly overwrite tenantId or role if they exist, to prevent resetting permissions.
        // Only update basic info.
        // However, if it's a NEW user (created), we might want to just create them.
        // But since we seed users manually for now, we just want to ensure the record exists or update properties.

        // Check if user exists first to decide on partial update vs create
        const existingUser = await prisma.users.findUnique({ where: { email } });

        if (existingUser) {
            await prisma.users.update({
                where: { email },
                data: {
                    name: name || undefined,
                    firstName: first_name || undefined,
                    lastName: last_name || undefined,
                    // PRD-213 AC-1a: persist the Clerk id so user.deleted erasure
                    // can resolve the local record without relying on the payload email.
                    clerkUserId: id || undefined,
                    updatedAt: new Date(),
                    // We do NOT update role or tenantId here typically, as that's business logic
                }
            });
        } else {
            // New user from Clerk side - create with safe defaults.
            // Use try-catch to handle race condition with consultation submit flow.
            try {
                await prisma.users.create({
                    data: {
                        email,
                        password: "CLERK_MANAGED_ACCOUNT",
                        name: name,
                        firstName: first_name || null,
                        lastName: last_name || null,
                        role: "CONSUMER",
                        isActive: true,
                        id: `user_${id}`,
                        // PRD-213 AC-1a: dedicated Clerk-id column for reliable erasure mapping.
                        clerkUserId: id || null,
                        updatedAt: new Date(),
                    }
                });
            } catch (createError: any) {
                // P2002 = unique constraint violation - user was created by another flow
                if (createError.code === "P2002") {
                    console.log(`User ${email} already exists (created by another flow), updating instead.`);
                    await prisma.users.update({
                        where: { email },
                        data: {
                            name: name || undefined,
                            firstName: first_name || null,
                            lastName: last_name || null,
                            clerkUserId: id || undefined,
                            updatedAt: new Date(),
                        },
                    });
                } else {
                    throw createError;
                }
            }
        }
    }

    if (eventType === "user.deleted") {
        // PRD-213 AC-1: honour GDPR Art.17 for Clerk-side deletions. Resolve the
        // local user by the stored Clerk id (AC-1a) and run the canonical erasure
        // — anonymise PII + sever the Dr Green linkage. AC-1b: if no local user is
        // found, eraseUser writes an `erasure_noop_user_not_found` audit row so a
        // missed mapping is visible rather than silent. Best-effort: never throw,
        // so Clerk does not retry indefinitely on an internal hiccup.
        const { id: deletedClerkId } = evt.data;
        try {
            await eraseUser({
                clerkUserId: deletedClerkId,
                reason: "clerk_user_deleted",
                clerkDeleted: true,
                clientInfo: getClientInfo(headerPayload),
            });
        } catch (erasureErr) {
            console.error(
                "[clerk.webhook] user.deleted erasure failed:",
                erasureErr instanceof Error ? erasureErr.message : erasureErr,
            );
        }
    }

    return new NextResponse("", { status: 200 });
}
