import Image from "next/image";

/**
 * Layered cube hero — ambient floor glow → core glow → cube → sparkles → vignette.
 * Cube image already includes the BUDSTACKS wordmark baked in.
 */
export default function BudstacksCubeHero() {
    return (
        <div className="relative mx-auto aspect-square w-full max-w-[540px]">
            {/* Ambient floor glow */}
            <div className="bs-cube-floor" />

            {/* Inner core glow */}
            <div className="bs-cube-core" />

            {/* The cube — float animation, respects prefers-reduced-motion */}
            <div className="absolute inset-0 motion-safe:animate-bs-cube-float">
                <Image
                    src="/images/homepage/budstacks-cube.png"
                    alt="Budstacks — the rollout platform for Dr. Green storefronts"
                    fill
                    sizes="(max-width: 640px) 90vw, (max-width: 1024px) 50vw, 540px"
                    className="bs-cube-img object-contain"
                    priority
                />
            </div>

            {/* Foreground sparkles — 4 staggered */}
            <span className="pointer-events-none absolute left-[18%] top-[22%] h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] motion-safe:animate-bs-sparkle-1" />
            <span className="pointer-events-none absolute right-[14%] top-[30%] h-1 w-1 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] motion-safe:animate-bs-sparkle-2" />
            <span className="pointer-events-none absolute left-[26%] bottom-[24%] h-1 w-1 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] motion-safe:animate-bs-sparkle-3" />
            <span className="pointer-events-none absolute right-[22%] bottom-[18%] h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] motion-safe:animate-bs-sparkle-4" />

            {/* Vignette overlay */}
            <div className="bs-cube-vignette" />
        </div>
    );
}
