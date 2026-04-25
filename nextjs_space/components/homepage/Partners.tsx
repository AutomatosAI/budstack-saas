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

                <div className="flex flex-1 items-center gap-8 overflow-x-auto md:justify-around md:gap-12 md:overflow-visible [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                    <Image
                        src="/images/homepage/drgreen-logo.png"
                        alt="Dr. Green"
                        width={120}
                        height={40}
                        className="h-9 w-auto shrink-0 [filter:drop-shadow(0_0_18px_rgba(82,217,122,0.35))]"
                    />
                    <span className="shrink-0 font-bs-serif text-[20px] text-bs-gold-400">Healing Buds</span>
                    <span className="shrink-0 font-bs-serif text-[20px] italic text-bs-gold-400">LekkerWeed</span>
                    <span className="shrink-0 text-[16px] font-semibold tracking-[0.06em] text-bs-gold-400">
                        Cannabis Express
                    </span>
                    <span className="shrink-0 text-[15px] font-medium uppercase tracking-[0.16em] text-bs-gold-400">
                        ONE TREE
                    </span>
                </div>
            </div>
        </section>
    );
}
