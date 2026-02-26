"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info } from "lucide-react";

interface Hotspot {
    id: string;
    x: number;
    y: number;
    title: string;
    description: string;
}

interface InteractiveImageProps {
    src: string;
    alt: string;
    hotspots?: Hotspot[];
    className?: string;
    glassEffect?: "none" | "light" | "heavy";
}

export function InteractiveImage({ src, alt, hotspots = [], className = "", glassEffect = "none" }: InteractiveImageProps) {
    const [activeHotspot, setActiveHotspot] = useState<string | null>(null);

    // Map the Tenant glass token to actual Tailwind backdrop blur utilities for the tooltips
    const glassClasses = {
        none: "bg-background border shadow-md",
        light: "bg-background/80 backdrop-blur-md border border-white/20 shadow-lg",
        heavy: "bg-background/60 backdrop-blur-xl border border-white/30 shadow-xl",
    };

    const tooltipBg = glassClasses[glassEffect];

    return (
        <div className={`relative w-full max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl ${className}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={alt}
                className="w-full h-auto object-cover"
                onClick={() => setActiveHotspot(null)}
            />

            {hotspots.map((hotspot) => (
                <div
                    key={hotspot.id}
                    className="absolute z-10"
                    style={{
                        left: `${hotspot.x}%`,
                        top: `${hotspot.y}%`,
                        transform: 'translate(-50%, -50%)'
                    }}
                >
                    {/* Hotspot Marker */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveHotspot(activeHotspot === hotspot.id ? null : hotspot.id);
                        }}
                        className="group relative flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform duration-200"
                        aria-label={`View details for ${hotspot.title}`}
                        aria-expanded={activeHotspot === hotspot.id}
                    >
                        <span className="absolute inset-0 rounded-full bg-primary opacity-30 animate-ping" />
                        <Info className="w-4 h-4 md:w-5 md:h-5 z-10" />
                    </button>

                    {/* Tooltip Overlay */}
                    <AnimatePresence>
                        {activeHotspot === hotspot.id && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className={`absolute left-1/2 -translate-x-1/2 mt-4 w-64 md:w-80 p-4 rounded-xl z-20 pointer-events-none text-left ${tooltipBg}`}
                                style={{
                                    // Keep tooltip within bounds somewhat naively
                                    marginLeft: hotspot.x > 80 ? '-80px' : hotspot.x < 20 ? '80px' : '0'
                                }}
                            >
                                {/* Connector Triangle */}
                                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-inherit border-l border-t border-inherit" />

                                <div className="relative z-10">
                                    <h4 className="font-heading font-semibold text-lg mb-1">{hotspot.title}</h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{hotspot.description}</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ))}
        </div>
    );
}
