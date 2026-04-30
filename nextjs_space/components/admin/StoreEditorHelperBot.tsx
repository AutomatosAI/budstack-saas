"use client";

import { useEffect, useState, ComponentType } from "react";

interface StoreEditorHelperBotProps {
    apiKey: string;
    agentId?: number | null;
    editorContext?: Record<string, unknown>;
    onAction?: (actionName: string, payload: any) => void;
}

export function StoreEditorHelperBot({
    apiKey,
    agentId,
    editorContext,
    onAction,
}: StoreEditorHelperBotProps) {
    const [isClient, setIsClient] = useState(false);
    const [ChatComponent, setChatComponent] = useState<ComponentType<any> | null>(null);

    useEffect(() => {
        setIsClient(true);

        // Load SDK at runtime only — hidden from TS type checker and webpack bundler
        const sdkModule = "@automatos/widget-sdk/react";
        (Function("m", "return import(m)")(sdkModule) as Promise<any>)
            .then((mod: any) => setChatComponent(() => mod.AutomatosChat))
            .catch(() => {
                // SDK not installed — widget won't render
            });

        const handleAutomatosAction = (event: Event) => {
            const customEvent = event as CustomEvent<{ action: string; result: any }>;
            if (onAction && customEvent.detail) {
                onAction(customEvent.detail.action, customEvent.detail.result);
            }
        };

        window.addEventListener("automatos:action", handleAutomatosAction);

        return () => {
            window.removeEventListener("automatos:action", handleAutomatosAction);
        };
    }, [onAction]);

    if (!isClient || !ChatComponent) {
        return null;
    }

    const apiBaseUrl =
        process.env.NEXT_PUBLIC_AUTOMATOS_API_URL || "https://api.automatos.app";

    return (
        <ChatComponent
            apiKey={apiKey}
            baseUrl={apiBaseUrl}
            agentId={agentId || undefined}
            greeting="Hi! I am the BudStacks Creative Assistant. I can help you pick colors, write descriptions, or configure your layout. What do you need help with?"
            context={editorContext}
            theme="dark"
        />
    );
}
