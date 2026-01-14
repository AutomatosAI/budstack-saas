import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FranchiseOpportunitySection() {
    return (
        <section className="px-4 py-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
                <div className="card-floating overflow-hidden">
                    <div className="grid lg:grid-cols-2">
                        {/* Left side - What you own */}
                        <div className="border-b border-[hsla(var(--edge),var(--edge-opacity))] p-10 lg:border-b-0 lg:border-r">
                            <h2 className="mb-2 font-display text-3xl font-bold text-foreground">
                                Franchise Opportunity
                            </h2>
                            <p className="mb-8 text-4xl font-bold text-gradient">
                                Starting €10,000
                            </p>
                            <p className="mb-6 text-muted-foreground">
                                Own a real medical dispensary franchise with access to
                                proprietary infrastructure and Dr. Green partnership benefits.
                            </p>

                            <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
                                What You Own
                            </h3>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-success" />
                                    <span className="text-foreground">
                                        Real medical dispensary franchise
                                    </span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-success" />
                                    <span className="text-foreground">
                                        Proprietary infrastructure access
                                    </span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-success" />
                                    <span className="text-foreground">
                                        Closed ecosystem participation
                                    </span>
                                </li>
                            </ul>
                        </div>

                        {/* Right side - Entry Details */}
                        <div className="p-10">
                            <h3 className="mb-6 font-display text-lg font-semibold text-foreground">
                                Entry Details
                            </h3>
                            <ul className="mb-8 space-y-3">
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-success" />
                                    <span className="text-foreground">
                                        From €10,000 initial investment
                                    </span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-success" />
                                    <span className="text-foreground">
                                        Limited to 5,400 total franchises
                                    </span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-success" />
                                    <span className="text-foreground">
                                        Legal agreements off-chain
                                    </span>
                                </li>
                            </ul>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Link href="/onboarding" className="flex-1">
                                    <Button variant="hero" size="lg" className="w-full">
                                        Apply for Franchise
                                    </Button>
                                </Link>
                                <a href="/#models" className="flex-1">
                                    <Button variant="outline" size="lg" className="w-full">
                                        View Management Models
                                    </Button>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
