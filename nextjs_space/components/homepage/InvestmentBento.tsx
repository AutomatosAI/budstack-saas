/**
 * Investment Bento — revenue projection chart (clients vs monthly revenue) +
 * two anchor stat cards (Licence, Margin). Anchored as #pricing for nav linking.
 */

const HIGH_PER = 120; // $4/g × 30g/mo
const LOW_PER = 90; //  $3/g × 30g/mo
const MILESTONES = [
    { clients: 1, lowLabel: "$90", highLabel: "$120" },
    { clients: 25, lowLabel: "$2.25K", highLabel: "$3K" },
    { clients: 50, lowLabel: "$4.5K", highLabel: "$6K" },
    { clients: 100, lowLabel: "$9K", highLabel: "$12K" },
] as const;

// Chart geometry
const W = 600;
const H = 260;
const M = { l: 52, r: 28, t: 22, b: 36 };
const innerW = W - M.l - M.r;
const innerH = H - M.t - M.b;
const X_MAX = 100;
const Y_MAX = 12000;
const xs = (c: number) => M.l + (c / X_MAX) * innerW;
const ys = (v: number) => M.t + innerH - (v / Y_MAX) * innerH;

const Y_TICKS = [0, 3000, 6000, 9000, 12000];
const X_TICKS = [1, 25, 50, 100];

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
                            $10K in. $9K → $12K out / month.
                        </h2>
                    </div>
                    <span className="bs-chip bs-chip-gold self-start md:self-end">
                        <span className="dot" />
                        24 licences remaining · 2026 cohort
                    </span>
                </div>

                <div className="mt-10 grid grid-cols-1 items-stretch gap-3 md:grid-cols-3">
                    {/* Left column — stacked anchor cards */}
                    <div className="flex flex-col gap-3 md:col-span-1">
                        <StatCard
                            label="Licence"
                            value="$10,000"
                            note="One-time · Full licence, one brand"
                        />
                        <StatCard
                            label="Margin"
                            value="$3–4/g"
                            note="Depends on strain and region"
                        />
                        <StatCard
                            label="Per Patient"
                            value="30 g / mo"
                            note="Average monthly script per active patient"
                        />
                    </div>

                    {/* Right — big chart card */}
                    <div className="bs-card flex flex-col p-6 sm:p-8 md:col-span-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                            <span className="bs-eyebrow">Monthly Revenue Projection</span>
                            <span className="font-bs-mono text-[10.5px] uppercase tracking-[0.12em] text-bs-gold-300/90">
                                ≈ $108K → $144K / year @ 100 patients
                            </span>
                        </div>

                        <div className="mt-2 font-bs-serif text-[36px] font-medium leading-none tracking-[-0.04em] text-bs-green-400 sm:text-[44px] lg:text-[52px]">
                            $9K → $12K
                        </div>
                        <p className="mt-2 font-bs-mono text-[11px] uppercase tracking-[0.1em] text-bs-fg-2">
                            30g/mo per patient × $3–4/g margin
                        </p>

                        <div className="mt-4 flex-1">
                            <RevenueChart />
                        </div>

                        {/* Legend */}
                        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 font-bs-mono text-[10.5px] uppercase tracking-[0.12em] text-bs-fg-2">
                            <span className="flex items-center gap-2">
                                <span className="h-[2px] w-5 bg-bs-gold-400" />
                                High estimate · $4/g
                            </span>
                            <span className="flex items-center gap-2">
                                <span
                                    className="h-[2px] w-5"
                                    style={{
                                        background:
                                            "repeating-linear-gradient(90deg, #52D97A 0 4px, transparent 4px 8px)",
                                    }}
                                />
                                Low estimate · $3/g
                            </span>
                        </div>

                        {/* Milestone strip */}
                        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-bs-border pt-3 sm:grid-cols-4">
                            {MILESTONES.map((m) => (
                                <div key={m.clients} className="flex flex-col">
                                    <span className="font-bs-mono text-[10.5px] uppercase tracking-[0.12em] text-bs-fg-3">
                                        {m.clients} {m.clients === 1 ? "client" : "clients"}
                                    </span>
                                    <span className="mt-1 font-bs-serif text-[16px] text-bs-gold-300 sm:text-[18px]">
                                        {m.lowLabel}–{m.highLabel}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function RevenueChart() {
    const origin = { x: xs(0), y: ys(0) };
    const highEnd = { x: xs(100), y: ys(100 * HIGH_PER) };
    const lowEnd = { x: xs(100), y: ys(100 * LOW_PER) };

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label="Monthly revenue projection: high estimate ($4/g) and low estimate ($3/g) across 1 to 100 patients"
        >
            <defs>
                <linearGradient id="bsRevGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C9A96E" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#C9A96E" stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* Grid lines */}
            {Y_TICKS.map((t) => (
                <line
                    key={t}
                    x1={M.l}
                    y1={ys(t)}
                    x2={W - M.r}
                    y2={ys(t)}
                    stroke="#1F2823"
                    strokeWidth="1"
                />
            ))}

            {/* Subtle vertical guides at milestone clients */}
            {X_TICKS.slice(1).map((c) => (
                <line
                    key={c}
                    x1={xs(c)}
                    y1={M.t}
                    x2={xs(c)}
                    y2={H - M.b}
                    stroke="#1F2823"
                    strokeWidth="1"
                    strokeDasharray="2 6"
                    opacity="0.6"
                />
            ))}

            {/* Y-axis labels */}
            {Y_TICKS.map((t) => (
                <text
                    key={t}
                    x={M.l - 10}
                    y={ys(t) + 3.5}
                    textAnchor="end"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fontSize="10.5"
                    fill="#8A928E"
                    letterSpacing="0.5"
                >
                    {t === 0 ? "$0" : `$${t / 1000}K`}
                </text>
            ))}

            {/* X-axis labels */}
            {X_TICKS.map((c) => (
                <text
                    key={c}
                    x={xs(c)}
                    y={H - 14}
                    textAnchor="middle"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fontSize="10.5"
                    fill="#8A928E"
                    letterSpacing="0.5"
                >
                    {c}
                </text>
            ))}

            {/* X-axis caption */}
            <text
                x={W - M.r}
                y={H - 1}
                textAnchor="end"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize="9"
                fill="#5A625E"
                letterSpacing="2"
            >
                CLIENTS
            </text>

            {/* Cubic Bezier curves — slow-start, accelerating-finish growth shape */}
            {(() => {
                const highCurve = `M ${origin.x},${origin.y} C ${xs(38)},${ys(600)} ${xs(78)},${ys(8400)} ${highEnd.x},${highEnd.y}`;
                const lowCurve = `M ${origin.x},${origin.y} C ${xs(38)},${ys(450)} ${xs(78)},${ys(6300)} ${lowEnd.x},${lowEnd.y}`;
                const highArea = `${highCurve} L ${highEnd.x},${origin.y} Z`;
                return (
                    <>
                        {/* High estimate area fill */}
                        <path d={highArea} fill="url(#bsRevGold)" />

                        {/* High estimate curve (gold) */}
                        <path
                            d={highCurve}
                            stroke="#C9A96E"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            fill="none"
                        />

                        {/* Low estimate curve (dashed green) */}
                        <path
                            d={lowCurve}
                            stroke="#52D97A"
                            strokeWidth="2"
                            strokeDasharray="5 4"
                            strokeLinecap="round"
                            fill="none"
                        />

                        {/* Endpoint dots */}
                        <circle cx={highEnd.x} cy={highEnd.y} r="5" fill="#C9A96E" />
                        <circle cx={highEnd.x} cy={highEnd.y} r="2" fill="#0B1410" />
                        <circle cx={lowEnd.x} cy={lowEnd.y} r="4" fill="#52D97A" />
                    </>
                );
            })()}

            {/* Endpoint labels */}
            <text
                x={highEnd.x - 8}
                y={highEnd.y - 10}
                textAnchor="end"
                fontFamily="ui-serif, Georgia, serif"
                fontSize="14"
                fontWeight="500"
                fill="#E6C997"
            >
                $12K
            </text>
            <text
                x={lowEnd.x - 8}
                y={lowEnd.y - 8}
                textAnchor="end"
                fontFamily="ui-serif, Georgia, serif"
                fontSize="13"
                fontWeight="500"
                fill="#7CE39B"
            >
                $9K
            </text>
        </svg>
    );
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
    return (
        <div className="bs-card flex flex-1 flex-col justify-center p-6 sm:p-7">
            <span className="bs-eyebrow">{label}</span>
            <div className="mt-3 font-bs-serif text-[28px] font-medium tracking-[-0.02em] text-bs-gold-300 sm:text-[34px]">
                {value}
            </div>
            <p className="mt-2 text-[13px] text-bs-fg-2">{note}</p>
        </div>
    );
}
