"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

interface AutomatosChatProps {
    apiKey: string;
    baseUrl?: string;
    position?: "bottom-right" | "bottom-left";
    theme?: "light" | "dark";
    greeting?: string;
    agentId?: number;
    modelId?: string;
    themeOverrides?: Record<string, string>;
}

export function AutomatosWidgetWrapper(props: AutomatosChatProps) {
    const isInitialized = useRef(false);

    const initWidget = () => {
        if (isInitialized.current) return;

        // Check if the global object exists (loaded via script)
        if (typeof window !== "undefined" && (window as any).AutomatosWidget) {
            (window as any).AutomatosWidget.init({
                apiKey: props.apiKey,
                widget: "chat",
                baseUrl: props.baseUrl,
                position: props.position ?? "bottom-right",
                theme: props.theme ?? "light",
                greeting: props.greeting,
                agentId: props.agentId,
                modelId: props.modelId,
                themeOverrides: props.themeOverrides,
            });
            isInitialized.current = true;
        }
    };

    useEffect(() => {
        // If the script is already loaded when component mounts
        initWidget();
    }, [props.apiKey, props.agentId]);

    return (
        <Script
            src="/automatos-widget.js"
            strategy="afterInteractive"
            onLoad={initWidget}
        />
    );
}
