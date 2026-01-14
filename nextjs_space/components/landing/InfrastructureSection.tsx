import {
    Store,
    BarChart3,
    Layers,
    Palette,
    Globe,
    Shield,
    Code,
    Users,
    FileText,
    Monitor,
} from "lucide-react";

const features = [
    {
        icon: Store,
        badge: "What NFT holders need",
        badgeColor: "bg-accent/10 text-accent",
        title: "White-Label Storefronts",
        description:
            "Beautiful, branded dispensary websites with product catalogs, consultation booking, and customer portals",
    },
    {
        icon: BarChart3,
        badge: "Business tools",
        badgeColor: "bg-[hsl(var(--chart-blue))]/10 text-[hsl(var(--chart-blue))]",
        title: "Admin Dashboards",
        description:
            "Complete business management: analytics, orders, customers, inventory, and revenue tracking",
    },
    {
        icon: Layers,
        badge: "Enterprise-grade",
        badgeColor: "bg-purple-500/10 text-purple-600",
        title: "Multi-Tenant Architecture",
        description:
            "Scalable infrastructure supporting unlimited tenants, each with isolated data and custom branding",
    },
    {
        icon: Palette,
        badge: "Brand flexibility",
        badgeColor: "bg-accent/10 text-accent",
        title: "Template System",
        description:
            "Pre-designed professional templates with full customization: colors, fonts, logos, and layouts",
    },
    {
        icon: Globe,
        badge: "Professional presence",
        badgeColor: "bg-[hsl(var(--chart-blue))]/10 text-[hsl(var(--chart-blue))]",
        title: "Custom Domain Routing",
        description:
            "Path-based URLs and custom domain support for professional branded experiences",
    },
    {
        icon: Shield,
        badge: "Compliance ready",
        badgeColor: "bg-purple-500/10 text-purple-600",
        title: "Blockchain Traceability",
        description:
            "Integrated blockchain tracking for supply chain transparency and regulatory compliance",
    },
    {
        icon: Code,
        badge: "Fully integrated",
        badgeColor: "bg-accent/10 text-accent",
        title: "Dr. Green API Integration",
        description:
            "Seamless connection to product catalog, inventory, and order fulfillment systems",
    },
    {
        icon: Users,
        badge: "Patient-focused",
        badgeColor: "bg-[hsl(var(--chart-blue))]/10 text-[hsl(var(--chart-blue))]",
        title: "Customer Management",
        description:
            "Complete CRM with consultation tracking, order history, and patient onboarding flows",
    },
    {
        icon: FileText,
        badge: "Enterprise features",
        badgeColor: "bg-purple-500/10 text-purple-600",
        title: "Audit & Webhook Systems",
        description:
            "Enterprise-grade logging, webhooks, and integrations for compliance and automation",
    },
];

export default function InfrastructureSection() {
    return (
        <section className="px-4 py-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                {/* Section header */}
                <div className="mb-20 text-center">
                    <div className="mb-4 flex justify-center">
                        <div className="section-badge">
                            <Monitor className="h-4 w-4" />
                            Infrastructure
                        </div>
                    </div>
                    <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                        Proprietary Infrastructure
                        <br />
                        <span className="text-gradient">For Franchise Operations</span>
                    </h2>
                    <p className="mx-auto mt-4 max-w-3xl text-lg text-muted-foreground">
                        Dr. Green manages product catalog and supply chain. Popcorn Media
                        provides the complete franchise infrastructure — technology,
                        operations management, and compliance frameworks exclusively for
                        franchisees.
                    </p>
                </div>

                {/* Features grid - floating cards */}
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature) => (
                        <div key={feature.title} className="card-floating p-8">
                            {/* Header with icon and badge */}
                            <div className="mb-6 flex items-start justify-between">
                                <div className="icon-badge">
                                    <feature.icon className="h-5 w-5 text-white" />
                                </div>
                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-medium ${feature.badgeColor}`}
                                >
                                    {feature.badge}
                                </span>
                            </div>

                            {/* Title */}
                            <h3 className="mb-3 font-display text-lg font-bold text-foreground">
                                {feature.title}
                            </h3>

                            {/* Description */}
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
