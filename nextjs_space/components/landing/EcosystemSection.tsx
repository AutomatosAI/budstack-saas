import { Lock, Layers, Code, TrendingUp } from "lucide-react";

const ecosystemLayers = [
    {
        icon: Lock,
        title: "NFT Licensing Layer",
        features: [
            "Blockchain-verified ownership via Dr. Green NFT",
            "Secure, transferable business credentials",
            "Automatic tenant provisioning on license verification",
        ],
    },
    {
        icon: Layers,
        title: "SaaS Platform Layer",
        features: [
            "Multi-tenant infrastructure with data isolation",
            "Template-based storefront customization",
            "Comprehensive admin dashboards and analytics",
        ],
    },
    {
        icon: Code,
        title: "Dr. Green API Layer",
        features: [
            "Real-time product catalog synchronization",
            "Automated order fulfillment integration",
            "Inventory and stock management sync",
        ],
    },
    {
        icon: TrendingUp,
        title: "Business Operations",
        features: [
            "Complete customer and order management",
            "Revenue analytics and business intelligence",
            "Compliance tracking and audit logging",
        ],
    },
];

export default function EcosystemSection() {
    return (
        <section className="px-4 py-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                {/* Section header */}
                <div className="mb-20 text-center">
                    <div className="mb-4 flex justify-center">
                        <div className="section-badge">
                            <Layers className="h-4 w-4" />
                            Ecosystem
                        </div>
                    </div>
                    <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                        The Popcorn Media{" "}
                        <span className="text-gradient">Ecosystem</span>
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                        A complete, integrated platform connecting NFT licenses to
                        operational dispensaries
                    </p>
                </div>

                {/* Ecosystem grid */}
                <div className="grid gap-8 md:grid-cols-2">
                    {ecosystemLayers.map((layer) => (
                        <div key={layer.title} className="card-floating p-10 lg:p-12">
                            {/* Navy icon badge */}
                            <div className="icon-badge mb-6">
                                <layer.icon className="h-5 w-5 text-white" />
                            </div>

                            {/* Title */}
                            <h3 className="mb-6 font-display text-2xl font-bold text-foreground">
                                {layer.title}
                            </h3>

                            {/* Features - with visible green SVG checkmarks */}
                            <ul className="space-y-4">
                                {layer.features.map((feature) => (
                                    <li key={feature} className="flex items-start gap-3">
                                        <svg
                                            className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        <span className="text-muted-foreground leading-relaxed">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
