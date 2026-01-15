
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function AuthCallbackPage() {
    const user = await currentUser();

    if (!user) {
        return redirect("/sign-in");
    }

    // Check role in metadata
    const role = user.publicMetadata.role as string;
    const email = user.emailAddresses[0]?.emailAddress;

    // 1. Super Admin
    if (role === "SUPER_ADMIN") {
        return redirect("/super-admin");
    }

    // 2. Tenant Admin
    if (role === "TENANT_ADMIN") {
        // Optional: Double check if they are linked to a tenant
        // But metadata is usually enough for routing.
        return redirect("/tenant-admin");
    }

    // 3. Consumer / other
    // If no role, try to find in DB to be safe (sync issue?)
    if (!role) {
        const localUser = await prisma.users.findFirst({ where: { email } });
        if (localUser?.role === "SUPER_ADMIN") return redirect("/super-admin");
        if (localUser?.role === "TENANT_ADMIN") return redirect("/tenant-admin");
    }

    // Default fallback
    return redirect("/");
}
