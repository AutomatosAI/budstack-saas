/**
 * Investment Bento — revenue calc (50→250 patients × 30g × $10/g) + grid of stat cards.
 * Anchored as #pricing for nav linking.
 */
const BARS = [
    { month: "M1", value: 15000, patients: 50 },
    { month: "M2", value: 22000, patients: 75 },
    { month: "M3", value: 30000, patients: 100 },
    { month: "M4", value: 39000, patients: 130 },
    { month: "M5", value: 48000, patients: 160 },
    { month: "M6", value: 57000, patients: 190 },
    { month: "M7", value: 66000, patients: 220 },
    { month: "M8", value: 75000, patients: 250 },
];
const MAX = 75000;

export default function InvestmentBento() {
    return (
        <section
            id="pricing"
            className="border-y border-bs-border bg-bs-bg-1 px-5 py-20 sm:px-10 sm:py-28 lg:px-20 lg:py-32"
        >
            <div className="mx-auto max-w-[1280px]">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <span className="bs-eyebrow bs-eyebrow-green">The Numbers</span>
                        <h2 className="mt-3 max-w-[820px] font-bs-serif text-[34px] font-medium leading-[1.1] tracking-[-0.02em] text-bs-gold-300 sm:text-[44px] lg:text-[56px] xl:text-[64px]">
                            $10K in. $15K → $75K out / month.
                        </h2>
                    </div>
                    <span className="bs-chip bs-chip-gold self-start md:self-end">
                        <span className="dot" />
                        24 licences remaining · 2026 cohort
                    </span>
                </div>

                <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
                    {/* Big card — chart */}
                    <div className="bs-card flex flex-col p-6 sm:p-8 lg:row-span-2">
                        <span className="bs-eyebrow">Estimated Monthly Revenue</span>
                        <div className="mt-2 font-bs-serif text-[48px] font-medium leading-none tracking-[-0.04em] text-bs-green-400 sm:text-[64px] lg:text-[76px]">
                            $15K → $75K
                        </div>
                        <p className="mt-2 font-bs-mono text-[11px] uppercase tracking-[0.1em] text-bs-fg-2">
                            @ 50–250 active patients × 30g/mo × $10/g
                        </p>

                        {/* Bar chart */}
                        <div className="mt-6 flex h-44 items-end gap-2 sm:gap-3">
                            {BARS.map((b) => {
                                const h = (b.value / MAX) * 100;
                                return (
                                    <div key={b.month} className="flex flex-1 flex-col items-center gap-1.5">
                                        <span className="font-bs-mono text-[9px] text-bs-gold-300">
                                            ${Math.round(b.value / 1000)}k
                                        </span>
                                        <div
                                            className="w-full rounded-t bg-gradient-to-t from-bs-green-700 to-bs-green-400"
                                            style={{ height: `${h}%` }}
                                        />
                                        <span className="font-bs-mono text-[9.5px] text-bs-fg-2">{b.month}</span>
                                        <span className="font-bs-mono text-[8.5px] text-bs-fg-2/70">{b.patients}p</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Small cards */}
                    <StatCard label="Licence" value="$10,000" note="One-time · 3mo free" />
                    <StatCard label="Margin" value="$3–4/g" note="Blended across regions" />
                    <StatCard label="Tiers" value="$99 · $189 · $249" note="AI-managed subscription" />
                    <StatCard label="Segments" value="55 / 30 / 15" note="Patients / Clinics / Retail" />
                </div>
            </div>
        </section>
    );
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
    return (
        <div className="bs-card flex flex-col p-6 sm:p-7">
            <span className="bs-eyebrow">{label}</span>
            <div className="mt-3 font-bs-serif text-[28px] font-medium tracking-[-0.02em] text-bs-gold-300 sm:text-[34px]">
                {value}
            </div>
            <p className="mt-2 text-[13px] text-bs-fg-2">{note}</p>
        </div>
    );
}
