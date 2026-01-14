import { HandCoins, Settings, Wrench } from "lucide-react";

const models = [
    {
        icon: HandCoins,
        title: "Fully Managed",
        description:
            "Popcorn Media operates the entire franchise on your behalf. Perfect for hands-off ownership.",
        features: [
            "Complete operational management",
            "Popcorn Media handles all decisions",
            "Passive income model",
            "Full compliance oversight",
        ],
        bestFor: "Investors, hands-off NFT holders, passive income seekers",
    },
    {
        icon: Settings,
        title: "Semi-Managed",
        description:
            "You run day-to-day operations with Popcorn Media support. A balanced approach for part-time entrepreneurs.",
        features: [
            "You manage daily operations",
            "Popcorn Media technical support",
            "Shared decision-making",
            "Full infrastructure access",
        ],
        bestFor: "Part-time entrepreneurs, franchise owners with day jobs",
        popular: true,
    },
    {
        icon: Wrench,
        title: "Independent Operator",
        description:
            "Full operational responsibility within Popcorn Media infrastructure. Maximum flexibility for experienced operators.",
        features: [
            "Complete operational control",
            "You make all decisions",
            "Maximum flexibility",
            "Must follow franchise guidelines",
        ],
        bestFor: "Experienced operators, hands-on entrepreneurs",
    },
];

export default function ManagementModels() {
    return (
        <section id="models" className="px-4 py-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                {/* Section header */}
                <div className="mb-20 text-center">
                    <div className="mb-4 flex justify-center">
                        <div className="section-badge">
                            <Settings className="h-4 w-4" />
                            Management Models
                        </div>
                    </div>
                    <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                        Choose your level of
                        <br />
                        <span className="text-gradient">involvement</span>
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                        Three operational approaches to suit different franchise owner
                        preferences and capabilities. All include full infrastructure
                        access.
                    </p>
                </div>

                {/* Models grid */}
                <div className="grid gap-8 lg:grid-cols-3">
                    {models.map((model) => (
                        <div
                            key={model.title}
                            className={`card-floating relative overflow-hidden p-10 lg:p-12 ${model.popular ? "ring-2 ring-accent" : ""
                                }`}
                        >
                            {/* Popular badge */}
                            {model.popular && (
                                <div className="absolute right-6 top-6">
                                    <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                                        Most Popular
                                    </span>
                                </div>
                            )}

                            {/* Navy icon badge */}
                            <div className="icon-badge mb-6">
                                <model.icon className="h-5 w-5 text-white" />
                            </div>

                            {/* Title */}
                            <h3 className="mb-4 font-display text-2xl font-bold text-foreground">
                                {model.title}
                            </h3>

                            {/* Description */}
                            <p className="mb-8 text-muted-foreground leading-relaxed">
                                {model.description}
                            </p>

                            {/* Features - with visible green SVG checkmarks */}
                            <ul className="mb-8 space-y-3">
                                {model.features.map((feature) => (
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
                                        <span className="text-foreground">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* Best for - highlighted with stronger background */}
                            <div className="rounded-2xl bg-slate-100 border border-slate-200 p-5">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                                    Best for:
                                </p>
                                <p className="text-foreground font-medium leading-relaxed">
                                    {model.bestFor}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer note */}
                <p className="mt-12 text-center text-sm text-muted-foreground">
                    All models include access to Popcorn Media&apos;s proprietary
                    infrastructure and Dr. Green partnership benefits.
                </p>
            </div>
        </section>
    );
}
