import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Rocket, Users, Building2 } from "lucide-react";

export default function Hero() {
    return (
        <section className="relative overflow-hidden px-4 pb-32 pt-32 sm:px-6 sm:pb-40 sm:pt-36 lg:px-8 lg:pb-48 lg:pt-40">
            {/* Background decorative elements */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {/* Calendar icon - left side */}
                <div className="hidden lg:block absolute left-[8%] top-[18%]">
                    <div className="card-floating-static h-28 w-24 p-2">
                        <div className="flex h-7 items-center justify-center border-b border-border/30">
                            <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                            <div className="mx-1.5 h-2 w-2 rounded-full bg-muted-foreground/40" />
                        </div>
                        <div className="flex items-center justify-center pt-3">
                            <span className="font-display text-4xl text-muted-foreground/50">
                                31
                            </span>
                        </div>
                    </div>
                </div>

                {/* Orange gradient shape - right side */}
                <div className="hidden lg:block absolute right-[5%] top-[12%]">
                    <div
                        className="h-44 w-40 rounded-3xl bg-gradient-to-br from-accent to-warning shadow-lg"
                        style={{
                            boxShadow:
                                "0 20px 50px rgba(249, 115, 22, 0.3), 0 10px 25px rgba(249, 115, 22, 0.2)",
                        }}
                    />
                </div>
            </div>

            <div className="relative z-10 mx-auto max-w-5xl text-center">
                {/* Badge */}
                <div className="mb-8 flex justify-center">
                    <div className="badge-pill">
                        <Rocket className="h-4 w-4 text-accent" />
                        <span>Partnering with Dr. Green · Powered by Automatos AI</span>
                    </div>
                </div>

                {/* Main heading - Flowa style with serif font */}
                <h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl md:text-6xl">
                    Medical Dispensary <span className="text-gradient italic">Franchise</span>
                    <br />
                    Management Platform
                </h1>

                {/* Subtitle */}
                <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground sm:text-xl">
                    Popcorn Media provides{" "}
                    <strong className="font-semibold text-foreground">
                        proprietary infrastructure exclusively for franchisees
                    </strong>{" "}
                    — professional storefronts, admin dashboards, and multi-tenant
                    operations management.
                </p>

                <p className="mt-4 text-sm text-muted-foreground">
                    A closed franchise ecosystem. Not a public marketplace.
                </p>

                {/* CTA Buttons - Elevated style */}
                <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <Link href="/onboarding">
                        <Button variant="hero" size="lg" className="btn-elevated">
                            <Rocket className="mr-2 h-4 w-4" />
                            Apply for Franchise
                        </Button>
                    </Link>
                    <a href="/#models">
                        <Button
                            variant="hero-outline"
                            size="lg"
                            className="btn-elevated-outline"
                        >
                            Explore Management Options
                        </Button>
                    </a>
                </div>

                {/* Trust badges */}
                <div className="mt-14 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                        <span>Franchise Agreements</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-accent" />
                        <span>Dr. Green Partnership</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <span>5,400 Limited Franchises</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
