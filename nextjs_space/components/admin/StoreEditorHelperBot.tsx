"use client";

import { useEffect, useState } from "react";
import { AutomatosChat } from "@automatos/widget-sdk/react";

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

    useEffect(() => {
        setIsClient(true);

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

    if (!isClient) {
        return null;
    }

    // Determine an appropriate API URL based on the environment
    const apiBaseUrl =
        process.env.NEXT_PUBLIC_AUTOMATOS_API_URL || "https://api.automatos.app";

    return (
        <AutomatosChat
            apiKey={apiKey}
            baseUrl={apiBaseUrl}
            agentId={agentId || undefined}
            greeting="Hi! I am the BudStacks Creative Assistant. I can help you pick colors, write descriptions, or configure your layout. What do you need help with?"
            context={editorContext}
            theme="light" // Always render light theme for the editor to match dashboard
        />
    );
}
