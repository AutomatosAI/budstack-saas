import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CTASection() {
    return (
        <section className="relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
            {/* Background decorative elements */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {/* Calendar icon - left side */}
                <div className="absolute left-[15%] top-[30%] opacity-10">
                    <div className="h-20 w-16 rounded-xl border-2 border-muted-foreground/30 bg-card">
                        <div className="flex h-5 items-center justify-center border-b border-muted-foreground/20">
                            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                            <div className="mx-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                        </div>
                        <div className="flex items-center justify-center pt-3">
                            <span className="font-display text-2xl font-bold text-muted-foreground/40">
                                31
                            </span>
                        </div>
                    </div>
                </div>

                {/* Plus sign */}
                <div className="absolute left-[25%] top-[20%] opacity-10">
                    <span className="text-6xl font-thin text-muted-foreground">+</span>
                </div>

                {/* Orange gradient shapes - right side */}
                <div className="absolute right-[10%] top-[20%]">
                    <div className="h-32 w-28 rounded-2xl bg-gradient-to-br from-accent/60 to-warning/40 opacity-60 blur-sm" />
                    <div className="absolute left-3 top-3 h-28 w-24 rounded-2xl bg-gradient-to-br from-accent/80 to-warning/60 opacity-80" />
                    <div className="absolute left-6 top-6 h-24 w-20 rounded-2xl bg-gradient-to-br from-accent to-warning" />
                </div>
            </div>

            <div className="relative mx-auto max-w-3xl text-center">
                <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                    Ready to launch your store?
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
                    Join the Popcorn Media ecosystem. Professional infrastructure, Dr.
                    Green partnership, and launch in 5 minutes.
                </p>

                <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <Link href="/onboarding">
                        <Button variant="hero" size="lg">
                            Start Free Trial
                        </Button>
                    </Link>
                    <Button
                        variant="hero-outline"
                        size="lg"
                        onClick={() => alert("Demo video coming soon!")}
                    >
                        Watch Demo
                    </Button>
                </div>
            </div>
        </section>
    );
}
