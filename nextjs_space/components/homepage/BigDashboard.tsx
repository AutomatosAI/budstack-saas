/**
 * Static "Healing Buds, Portugal" admin dashboard mock.
 * Pure presentational — no real data, no interactivity, no fetching.
 * Used inside DashboardShowcase (tilted) and as an inline preview in FeatureTabs.
 */
export default function BigDashboard({ compact = false }: { compact?: boolean }) {
    return (
        <div
            className={`bs-card overflow-hidden bg-bs-bg-1 ${
                compact ? "p-3 sm:p-5" : "p-5 sm:p-7"
            }`}
        >
            {/* Window chrome */}
            <div className="mb-4 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
                <span className="ml-3 truncate font-bs-mono text-[11px] text-bs-fg-2">
                    healing-buds.budstacks.app · Admin Console
                </span>
                <span className="ml-auto bs-chip bs-chip-green !py-1 !px-2 text-[10px]">
                    <span className="dot" />
                    SYNCED
                </span>
            </div>

            <div className="grid grid-cols-12 gap-4">
                {/* Sidebar — hidden in compact preview to give KPIs room */}
                {!compact && (
                    <aside className="col-span-3 hidden flex-col gap-1 border-r border-bs-border pr-4 md:flex">
                        <span className="bs-eyebrow mb-2">Healing Buds</span>
                        {["Overview", "Orders", "Products", "Consultations", "Storefront", "Branding", "The Wire", "Analytics", "Settings"].map(
                            (label, i) => (
                                <div
                                    key={label}
                                    className={`flex items-center justify-between rounded-md px-2 py-1.5 text-[12.5px] ${
                                        i === 0
                                            ? "bg-bs-green-400/10 text-bs-fg-0"
                                            : "text-bs-fg-2"
                                    }`}
                                >
                                    <span>{label}</span>
                                    {label === "Products" && (
                                        <span className="rounded bg-bs-green-400/15 px-1.5 py-0.5 font-bs-mono text-[10px] text-bs-green-300">
                                            17
                                        </span>
                                    )}
                                </div>
                            )
                        )}
                    </aside>
                )}

                {/* Main */}
                <div className={compact ? "col-span-12" : "col-span-12 md:col-span-9"}>
                    <div className="mb-4 flex items-end justify-between gap-3">
                        <div>
                            <span className="bs-eyebrow">Overview · Last 30 days</span>
                            <h3 className="mt-1 font-bs-serif text-[22px] font-medium text-bs-gold-300 sm:text-[28px]">
                                Healing Buds, Portugal
                            </h3>
                        </div>
                        <div className="flex shrink-0 gap-2">
                            <span className="bs-btn-ghost !py-1.5 !px-3 text-[12px]">Export</span>
                            <span className="bs-btn-green !py-1.5 !px-3 text-[12px]">New campaign</span>
                        </div>
                    </div>

                    {/* KPI cards */}
                    <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
                        <KpiCard compact={compact} label="MRR" value="$11,240" delta="+18% vs prev" />
                        <KpiCard compact={compact} label="Orders" value="312" delta="+7%" />
                        <KpiCard compact={compact} label="Patients" value="1,284" delta="+42 new" />
                        <KpiCard compact={compact} label="Margin" value="$3.80/g" delta="stable" />
                    </div>

                    {/* Chart + consultations */}
                    <div className={`mt-3 grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
                        {/* Revenue chart */}
                        <div className="bs-card !rounded-xl bg-bs-bg-2 p-4">
                            <div className="mb-2 flex items-baseline justify-between">
                                <div>
                                    <span className="bs-eyebrow">Revenue · 30D</span>
                                </div>
                                <span className="font-bs-serif text-[15px] text-bs-gold-300">$11,240</span>
                            </div>
                            <svg viewBox="0 0 320 100" className="h-24 w-full">
                                <defs>
                                    <linearGradient id="bsRevFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#52D97A" stopOpacity="0.35" />
                                        <stop offset="100%" stopColor="#52D97A" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <path
                                    d="M0,80 L40,72 L80,60 L120,55 L160,42 L200,36 L240,28 L280,22 L320,18"
                                    fill="none"
                                    stroke="#52D97A"
                                    strokeWidth="2"
                                />
                                <path
                                    d="M0,80 L40,72 L80,60 L120,55 L160,42 L200,36 L240,28 L280,22 L320,18 L320,100 L0,100 Z"
                                    fill="url(#bsRevFill)"
                                />
                                {[
                                    [40, 72],
                                    [80, 60],
                                    [120, 55],
                                    [160, 42],
                                    [200, 36],
                                    [240, 28],
                                    [280, 22],
                                ].map(([x, y]) => (
                                    <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" fill="#52D97A" />
                                ))}
                            </svg>
                        </div>

                        {/* Consultations — hidden in compact preview to keep height short */}
                        <div className={`bs-card !rounded-xl bg-bs-bg-2 p-4 ${compact ? "hidden" : ""}`}>
                            <span className="bs-eyebrow">Pending Consultations</span>
                            <div className="mt-3 space-y-2 text-[13px]">
                                {[
                                    { name: "M. Oliveira", state: "KYC ready", color: "text-bs-green-300" },
                                    { name: "R. Marques", state: "Doc review", color: "text-bs-gold-300" },
                                    { name: "S. Fonseca", state: "Payment", color: "text-bs-fg-2" },
                                ].map((row) => (
                                    <div
                                        key={row.name}
                                        className="flex items-center justify-between border-b border-bs-border/50 pb-2 last:border-b-0"
                                    >
                                        <span className="text-bs-fg-1">{row.name}</span>
                                        <span className={`font-bs-mono text-[10.5px] uppercase tracking-[0.1em] ${row.color}`}>
                                            {row.state}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function KpiCard({
    label,
    value,
    delta,
    compact = false,
}: {
    label: string;
    value: string;
    delta: string;
    compact?: boolean;
}) {
    return (
        <div className="rounded-xl border border-bs-border bg-bs-bg-2 p-2.5 sm:p-3">
            <span className="bs-eyebrow">{label}</span>
            <div
                className={`mt-1 font-bs-serif font-medium leading-tight tracking-[-0.01em] text-bs-gold-300 ${
                    compact
                        ? "text-[18px] sm:text-[20px]"
                        : "text-[16px] sm:text-[24px]"
                }`}
            >
                {value}
            </div>
            <div className="mt-0.5 font-bs-mono text-[10px] text-bs-green-300 sm:text-[10.5px]">{delta}</div>
        </div>
    );
}
