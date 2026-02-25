"use client";

import { usePathname } from "next/navigation";
import { AutomatosWidgetWrapper } from "@/components/admin/AutomatosWidgetWrapper";

interface Props {
    automatosApiKey: string;
    automatosAgentId?: number;
    themeOverrides?: Record<string, string>;
    businessName?: string;
}

export function GlobalPlatformChatbot({ automatosApiKey, automatosAgentId, themeOverrides, businessName }: Props) {
    const pathname = usePathname();

    // Exclude admin dashboards and tenant stores so they don't get the platform chatbot
    const excludedPaths = [
        "/store",         // Tenant public stores (they have their own chatbot based on tenant config)
        "/super-admin",   // Admin backend
        "/tenant-admin",  // Admin backend
        "/sign-in",       // Auth UI
        "/sign-up",       // Auth UI
        "/api"            // API routes
    ];

    const isExcluded = excludedPaths.some(path => pathname?.startsWith(path));

    if (isExcluded) {
        return null;
    }

    return (
        <AutomatosWidgetWrapper
            apiKey={automatosApiKey}
            agentId={automatosAgentId}
            position="bottom-right"
            theme="light"
            themeOverrides={themeOverrides}
            title={`${businessName || 'BudStacks'} - Support`}
            greeting={`Hi there! 👋 Welcome to ${businessName || 'BudStacks Support'}. How can we help you today?`}
        />
    );
}
