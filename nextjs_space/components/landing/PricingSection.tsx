import { Button } from "@/components/ui/button";
import { Diamond, Clock, Zap } from "lucide-react";

const plans = [
    {
        number: "01",
        tagLeft: "Setup in 24 hours",
        tagRight: "Fast",
        tagIcon: Clock,
        name: "Starter",
        price: "€299",
        period: "per month",
        description: "For individuals and side projects",
        buttonText: "Get Started",
        buttonVariant: "default" as const,
        features: [
            "Single storefront",
            "Basic analytics dashboard",
            "Standard email support",
            "Dr. Green API access",
            "Mobile responsive design",
            "SSL certificate included",
        ],
    },
    {
        number: "02",
        tagLeft: "Most popular",
        tagRight: "Balanced",
        tagIcon: Zap,
        name: "Team",
        price: "€599",
        period: "per month",
        description: "For growing product teams",
        buttonText: "Start 14-day trial",
        buttonVariant: "hero" as const,
        popular: true,
        features: [
            "Up to 3 storefronts",
            "Advanced analytics + reports",
            "Priority support",
            "Custom domain routing",
            "Enhanced branding options",
            "Webhook integrations",
        ],
    },
    {
        number: "03",
        tagLeft: "Custom solutions",
        tagRight: "Tailored",
        tagIcon: Diamond,
        name: "Enterprise",
        price: "Quote",
        period: "billed annually",
        description: "For large scale companies",
        buttonText: "Contact Sales",
        buttonVariant: "default" as const,
        features: [
            "Unlimited storefronts",
            "White-label solution",
            "Dedicated account manager",
            "SLA with priority support",
            "Custom integrations",
            "Audit logs + compliance tools",
        ],
    },
];

export default function PricingSection() {
    return (
        <section id="pricing" className="px-4 py-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                {/* Section header */}
                <div className="mb-20 text-center">
                    <div className="mb-4 flex justify-center">
                        <div className="section-badge">
                            <Diamond className="h-4 w-4" />
                            Pricing
                        </div>
                    </div>
                    <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                        Scale with confidence
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                        Simple and transparent plans that grow with your team.
                    </p>
                </div>

                {/* Pricing cards */}
                <div className="grid gap-8 lg:grid-cols-3">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`card-floating relative overflow-hidden ${plan.popular ? "ring-2 ring-primary" : ""
                                }`}
                        >
                            {/* Diagonal lines decoration on popular plan */}
                            {plan.popular && (
                                <div className="absolute right-0 top-0 h-full w-1/3 diagonal-lines opacity-40" />
                            )}

                            <div className="relative p-10">
                                {/* Top row - number badge, tags */}
                                <div className="mb-6 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                            {plan.number}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            {plan.tagLeft}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <plan.tagIcon className="h-4 w-4" />
                                        {plan.tagRight}
                                    </div>
                                </div>

                                {/* Name and price row */}
                                <div className="mb-4 flex items-baseline justify-between">
                                    <h3 className="font-display text-2xl font-bold text-foreground">
                                        {plan.name}
                                    </h3>
                                    <div className="text-right">
                                        <span className="font-display text-3xl font-bold text-foreground">
                                            {plan.price}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            {plan.period}
                                        </span>
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="mb-6 text-sm text-muted-foreground">
                                    {plan.description}
                                </p>

                                {/* Button */}
                                <Button
                                    variant={plan.popular ? "hero" : plan.buttonVariant}
                                    size="lg"
                                    className="w-full rounded-xl"
                                >
                                    {plan.buttonText}
                                </Button>

                                {/* Features - highlighted section with background */}
                                <div className="mt-8 pt-6 border-t border-border">
                                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 -mx-2">
                                        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                                            What&apos;s included:
                                        </p>
                                        <ul className="space-y-3">
                                            {plan.features.map((feature) => (
                                                <li key={feature} className="flex items-center gap-3">
                                                    <svg
                                                        className="h-5 w-5 flex-shrink-0 text-emerald-500"
                                                        viewBox="0 0 20 20"
                                                        fill="currentColor"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                    <span className="text-sm text-foreground">
                                                        {feature}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer note */}
                <div className="mt-12 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                        <Diamond className="h-4 w-4" />
                        All prices in EUR. Taxes and third party fees may apply.
                    </p>
                    <a href="#" className="font-medium text-accent hover:text-accent/80">
                        Talk to sales →
                    </a>
                </div>
            </div>
        </section>
    );
}
