import { MessageSquare } from "lucide-react";

const testimonials = [
    {
        initials: "JM",
        name: "João Mendes",
        role: "NFT Holder, Portugal",
        quote:
            "I went from buying my NFT to having a live store in under 10 minutes. Popcorn Media saved me months.",
    },
    {
        initials: "SK",
        name: "Stefan Klein",
        role: "Franchise Operator, Germany",
        quote:
            "The analytics dashboard alone is worth it. I can see exactly what's selling in real-time.",
    },
    {
        initials: "EW",
        name: "Emma Williams",
        role: "Independent Operator, UK",
        quote:
            "€20,000 on developers couldn't integrate Dr. Green properly. Popcorn Media just works.",
    },
];

export default function TestimonialsSection() {
    return (
        <section id="testimonials" className="px-4 py-20 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                {/* Section header */}
                <div className="mb-16 text-center">
                    <div className="mb-4 flex justify-center">
                        <div className="section-badge">
                            <MessageSquare className="h-4 w-4" />
                            Testimonials
                        </div>
                    </div>
                    <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                        Teams ship better with
                        <br />
                        <span className="text-gradient">Popcorn Media</span>
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                        Loved by product, engineering, and design teams.
                    </p>
                </div>

                {/* Testimonials grid - 3 columns, compact */}
                <div className="grid gap-6 md:grid-cols-3">
                    {testimonials.map((testimonial) => (
                        <div key={testimonial.name} className="card-floating p-6">
                            {/* Avatar and name - compact */}
                            <div className="mb-4 flex items-center gap-3">
                                {/* Initials avatar - smaller */}
                                <div
                                    className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white"
                                    style={{
                                        background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
                                    }}
                                >
                                    {testimonial.initials}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">
                                        {testimonial.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {testimonial.role}
                                    </p>
                                </div>
                            </div>

                            {/* Quote - compact italic style */}
                            <p className="text-sm text-muted-foreground leading-relaxed italic">
                                &quot;{testimonial.quote}&quot;
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
