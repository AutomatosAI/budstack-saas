import Image from "next/image";

/**
 * Phone frame around a Healing Buds mobile screenshot.
 * Used inside the Storefront feature tab.
 */
export default function StorefrontPreview() {
    return (
        <div className="relative mx-auto w-[260px] sm:w-[280px]">
            {/* Phone frame */}
            <div className="relative overflow-hidden rounded-[42px] border-[10px] border-bs-bg-3 bg-bs-bg-3 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
                {/* Notch */}
                <div className="pointer-events-none absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
                <div className="relative aspect-[9/19.5] w-full overflow-hidden rounded-[32px] bg-black">
                    <Image
                        src="/images/homepage/healingbuds-mobile.jpeg"
                        alt="Healing Buds mobile storefront"
                        fill
                        sizes="280px"
                        className="object-cover"
                    />
                </div>
            </div>

            {/* Soft green floor glow */}
            <div
                className="pointer-events-none absolute inset-x-[-30px] -bottom-12 h-24 blur-3xl"
                style={{
                    background:
                        "radial-gradient(ellipse 60% 100% at 50% 50%, rgba(82,217,122,0.35), transparent 70%)",
                }}
                aria-hidden
            />
        </div>
    );
}
