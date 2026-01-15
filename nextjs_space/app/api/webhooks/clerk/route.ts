
import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

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

    console.log(`Webhook with and ID of ${id} and type of ${eventType}`);
    console.log("Webhook body:", body);

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
                    updatedAt: new Date(),
                    // We do NOT update role or tenantId here typically, as that's business logic
                }
            });
        } else {
            // New user from Clerk side. We create a basic record.
            // They won't have a role or tenant yet properly assigned unless we have logic for that.
            // For now, we create them as CONSUMER or similar defaults, but schema might require role.
            // We'll skip creating if role is required and not nullable, but let's assume we create inactive.

            // Actually, safer to just log for now if we don't have a default role strategy.
            // But let's try to upsert with safe defaults.
            await prisma.users.create({
                data: {
                    email,
                    name: name,
                    firstName: first_name || null,
                    lastName: last_name || null,
                    role: "CONSUMER", // Default role
                    isActive: true,
                    id: `user_${id}`, // Sync IDs if possible or just use generated
                    updatedAt: new Date(),
                }
            });
        }
    }

    if (eventType === "user.deleted") {
        const { id } = evt.data;
        // We might need to look up by ID if we stored Clerk ID. 
        // Currently we rely on email. The deleted webhook might not contain email?
        // user.deleted payload usually has id, deleted: boolean.
        // If we don't store Clerk ID in our DB, we can't easily find them to delete.
        // Strategy: We should probably start storing Clerk ID in `drGreenClientId` or a new field?
        // For now, we'll skip delete since we match by email and delete event might not have it.
        console.log("User deleted event received. Manual cleanup might be required as we don't map Clerk ID directly yet.");
    }

    return new NextResponse("", { status: 200 });
}
