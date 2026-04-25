import Link from "next/link";
import Image from "next/image";
import BudstacksCubeHero from "./BudstacksCubeHero";

export default function Hero() {
    return (
        <section className="bs-smoky relative overflow-hidden px-5 pb-20 pt-16 sm:px-10 sm:pb-24 sm:pt-20 lg:px-20 lg:pb-32 lg:pt-28">
            <div className="bs-smoky-bg" aria-hidden />

            <div className="relative z-10 mx-auto grid max-w-[1280px] items-center gap-12 lg:min-h-[620px] lg:grid-cols-2 lg:gap-15">
                {/* Left column */}
                <div className="order-2 lg:order-1">
                    {/* Eyebrow chip */}
                    <span className="bs-chip bs-chip-green mb-6">
                        <span className="dot" />
                        V2.6 · Portugal HQ · South Africa Live
                    </span>

                    {/* Headline */}
                    <h1 className="font-bs-serif text-[44px] font-medium leading-[1.05] tracking-[-0.025em] text-bs-gold-300 sm:text-[64px] lg:text-[80px] xl:text-[88px] xl:tracking-[-0.035em]">
                        The premium rollout platform for{" "}
                        <Image
                            src="/images/homepage/drgreen-logo.png"
                            alt="Dr. Green"
                            width={220}
                            height={80}
                            className="bs-drgreen-inline"
                        />{" "}
                        storefronts.
                    </h1>

                    {/* Subhead */}
                    <p className="mt-6 max-w-[540px] text-base leading-[1.5] text-bs-gold-400 sm:text-lg lg:text-[20px]">
                        Launch a compliant, beautifully branded medical-cannabis storefront — with no
                        custom development overhead and no operational chaos.
                    </p>

                    {/* CTAs */}
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                        <Link href="/onboarding" className="bs-btn-green">
                            Start a 5-minute tour →
                        </Link>
                        <Link href="/contact" className="bs-btn-ghost">
                            <span aria-hidden>▶</span>
                            Watch 90-second demo
                        </Link>
                    </div>

                    {/* Compliance row */}
                    <div className="mt-8 flex flex-wrap gap-4 font-bs-mono text-[11px] uppercase tracking-[0.1em] text-bs-gold-400 sm:gap-6">
                        <span>◆ GDPR · HIPAA</span>
                        <span>◆ INFARMED</span>
                        <span>◆ EU-GMP</span>
                    </div>
                </div>

                {/* Right column — cube */}
                <div className="order-1 lg:order-2">
                    <BudstacksCubeHero />
                </div>
            </div>
        </section>
    );
}
