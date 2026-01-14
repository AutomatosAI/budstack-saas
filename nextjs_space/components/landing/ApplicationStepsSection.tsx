import Link from "next/link";
import { FileText, Palette, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
    {
        number: "01",
        icon: FileText,
        title: "Franchise Application",
        description:
            "Submit your franchise application with business details and ownership verification for Popcorn Media review",
    },
    {
        number: "02",
        icon: Palette,
        title: "Customize Branding",
        description:
            "Choose a template, upload your logo, set brand colors, configure your domain, and customize content",
    },
    {
        number: "03",
        icon: Rocket,
        title: "Launch & Scale",
        description:
            "Your storefront goes live instantly. Start accepting consultations, processing orders, and growing your business",
    },
];

export default function ApplicationStepsSection() {
    return (
        <section className="px-4 py-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                {/* Section header */}
                <div className="mb-16 text-center">
                    <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                        Franchise Application in
                        <br />
                        <span className="text-gradient">3 Steps</span>
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                        Apply for your medical cannabis franchise and get infrastructure
                        access quickly
                    </p>
                </div>

                {/* Steps - using card-floating with larger padding */}
                <div className="grid gap-8 lg:grid-cols-3">
                    {steps.map((step) => (
                        <div key={step.number} className="card-floating p-10 text-center">
                            {/* Step icon with orange gradient and glow shadow */}
                            <div
                                className="mx-auto mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-full"
                                style={{
                                    background: "linear-gradient(135deg, #FF9500, #FFB347)",
                                    boxShadow: "0 12px 24px rgba(255, 149, 0, 0.3)",
                                }}
                            >
                                <span className="font-display text-2xl font-bold text-white">
                                    {step.number}
                                </span>
                            </div>

                            {/* Title */}
                            <h3 className="mb-4 font-display text-2xl font-bold text-foreground">
                                {step.title}
                            </h3>

                            {/* Description */}
                            <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div className="mt-16 text-center">
                    <Link href="/onboarding">
                        <Button variant="hero" size="lg" className="px-8">
                            Apply for Franchise
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
}
