import Image from "next/image";

/**
 * Partners strip — Dr. Green + 4 client name placeholders.
 * Markup is intentionally easy to swap for <Image> components when real client logos arrive.
 * Mobile: horizontal scroll (snap). Desktop: even spacing.
 */
export default function Partners() {
    return (
        <section className="border-y border-bs-border bg-bs-bg-1 px-5 py-9 sm:px-10 lg:px-20">
            <div className="mx-auto flex max-w-[1280px] flex-col gap-6 md:flex-row md:items-center md:gap-10">
                <span className="bs-eyebrow bs-eyebrow-gold whitespace-nowrap">Our Partners</span>

                <div className="flex flex-1 items-center gap-10 overflow-x-auto md:justify-around md:gap-12 md:overflow-visible [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                    <div className="flex h-12 shrink-0 items-center">
                        <Image
                            src="/images/homepage/drgreen-logo.png"
                            alt="Dr. Green"
                            width={140}
                            height={48}
                            className="h-10 w-auto object-contain [filter:drop-shadow(0_0_18px_rgba(82,217,122,0.35))]"
                        />
                    </div>
                    <div className="flex h-12 shrink-0 items-center">
                        <Image
                            src="/images/homepage/healingbuds-logo.png"
                            alt="Healing Buds"
                            width={160}
                            height={48}
                            className="h-9 w-auto object-contain opacity-90"
                        />
                    </div>
                    <div className="flex h-12 shrink-0 items-center">
                        <span className="font-bs-serif text-[22px] italic text-white">LekkerWeed</span>
                    </div>
                    <div className="flex h-12 shrink-0 items-center">
                        <Image
                            src="/images/homepage/cannabis-express-logo.webp"
                            alt="Cannabis Express"
                            width={140}
                            height={48}
                            className="h-12 w-auto object-contain"
                        />
                    </div>
                    <div className="flex h-12 shrink-0 items-center">
                        <Image
                            src="/images/homepage/onetree-logo.png"
                            alt="One Tree Cannabis"
                            width={120}
                            height={48}
                            className="h-12 w-auto object-contain [filter:invert(1)_brightness(1.1)] opacity-90"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}
