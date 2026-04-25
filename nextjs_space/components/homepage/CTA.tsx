import Link from "next/link";
import Image from "next/image";

export default function CTA() {
    return (
        <section className="bs-smoky relative overflow-hidden border-t border-bs-border px-5 py-24 sm:px-10 sm:py-32 lg:px-20 lg:py-36">
            <div className="bs-smoky-bg" aria-hidden />

            <div className="relative z-10 mx-auto flex max-w-[800px] flex-col items-center text-center">
                {/* Cube — compact */}
                <div
                    className="relative h-32 w-32 sm:h-36 sm:w-36"
                    style={{ filter: "drop-shadow(0 0 36px rgba(82,217,122,0.45))" }}
                >
                    <Image
                        src="/images/homepage/budstacks-cube.png"
                        alt=""
                        fill
                        sizes="160px"
                        className="object-contain"
                    />
                </div>

                <span className="bs-chip bs-chip-gold mt-6">
                    <span className="dot" />
                    24 licences remaining · 2026 cohort
                </span>

                <h2 className="mt-5 font-bs-serif text-[36px] font-medium leading-[1.1] tracking-[-0.02em] text-bs-gold-300 sm:text-[48px] lg:text-[64px]">
                    Your territory. Your brand. Our stack.
                </h2>

                <p className="mt-5 max-w-[560px] text-[16px] leading-[1.55] text-bs-fg-1 sm:text-[18px]">
                    Apply for a Dr. Green licence. Launch on Budstacks. Be live in 14 days.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <Link href="/onboarding" className="bs-btn-green">
                        Apply for licence →
                    </Link>
                    <Link href="/contact" className="bs-btn-ghost">
                        Email the partnerships team
                    </Link>
                </div>
            </div>
        </section>
    );
}
