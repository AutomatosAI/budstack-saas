/**
 * Dotted-blob world map with partner pins.
 * Static SVG — no real geography. Replace with proper map (MapLibre) later if needed.
 */

const PINS = [
    { id: "usa", label: "USA", status: "Coming Soon", x: 240, y: 195, type: "pipeline" },
    { id: "uk", label: "England", status: "Launching Soon", x: 490, y: 150, type: "pipeline" },
    { id: "pt", label: "Portugal", status: "Headquarters", x: 470, y: 210, type: "hq" },
    { id: "za", label: "South Africa", status: "Operational", x: 550, y: 380, type: "live" },
    { id: "th", label: "Thailand", status: "Production", x: 760, y: 240, type: "live" },
] as const;

const COLORS = {
    live: "#52D97A",
    hq: "#C9A96E",
    pipeline: "#8A928E",
} as const;

export default function GlobalMap() {
    return (
        <section className="bg-bs-bg-0 px-5 py-20 sm:px-10 sm:py-28 lg:px-20 lg:py-32">
            <div className="mx-auto max-w-[1280px]">
                <span className="bs-eyebrow bs-eyebrow-green">§ 02 — Global</span>
                <h2 className="mt-3 max-w-[720px] font-bs-serif text-[34px] font-medium leading-[1.1] tracking-[-0.02em] text-bs-gold-300 sm:text-[44px] lg:text-[56px] xl:text-[64px]">
                    One licence, five territories and climbing.
                </h2>

                {/* Legend */}
                <div className="mt-6 flex flex-wrap gap-5 font-bs-mono text-[11px] uppercase tracking-[0.12em] text-bs-fg-2">
                    <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: COLORS.live, boxShadow: `0 0 8px ${COLORS.live}` }} />
                        Operational
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: COLORS.hq, boxShadow: `0 0 8px ${COLORS.hq}` }} />
                        HQ
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: COLORS.pipeline }} />
                        Pipeline
                    </span>
                </div>

                <div className="relative mt-10 w-full" style={{ aspectRatio: "1000 / 520" }}>
                    <svg
                        viewBox="0 0 1000 520"
                        className="h-full w-full"
                        role="img"
                        aria-label="Dr. Green operational territories: Portugal HQ, South Africa, Thailand operational; UK and USA in pipeline"
                    >
                        <defs>
                            <filter id="bsPinGlow" x="-100%" y="-100%" width="300%" height="300%">
                                <feGaussianBlur stdDeviation="2" />
                            </filter>
                        </defs>

                        {/* Continents — abstract dot clusters */}
                        <g fill="#2F3A3D" opacity="0.85">
                            {dotCluster(180, 230, 120, 100, 420)}
                            {dotCluster(300, 380, 60, 90, 200)}
                            {dotCluster(480, 180, 60, 45, 180)}
                            {dotCluster(520, 320, 75, 110, 280)}
                            {dotCluster(720, 210, 160, 110, 520)}
                            {dotCluster(840, 390, 60, 40, 140)}
                        </g>

                        {/* Connection lines from PT */}
                        <g stroke="rgba(82,217,122,0.35)" strokeWidth="1" strokeDasharray="3 4" fill="none">
                            {PINS.filter((p) => p.id !== "pt").map((p) => (
                                <path
                                    key={`line-${p.id}`}
                                    d={`M 470 210 Q ${(470 + p.x) / 2} ${Math.min(210, p.y) - 40} ${p.x} ${p.y}`}
                                />
                            ))}
                        </g>

                        {/* Pins */}
                        {PINS.map((p) => {
                            const color = COLORS[p.type];
                            return (
                                <g key={p.id} transform={`translate(${p.x} ${p.y})`}>
                                    <circle r="14" fill={color} opacity="0.12" filter="url(#bsPinGlow)" />
                                    <circle r="6" fill={color} opacity="0.25" />
                                    <circle r="3" fill={color} />
                                    <text
                                        x="10"
                                        y="-4"
                                        fill="#F5F6F4"
                                        fontSize="11"
                                        fontFamily="var(--font-inter)"
                                        fontWeight="600"
                                    >
                                        {p.label}
                                    </text>
                                    <text
                                        x="10"
                                        y="10"
                                        fill="#8A928E"
                                        fontSize="9"
                                        fontFamily="var(--font-jetbrains-mono)"
                                        letterSpacing="0.08em"
                                    >
                                        {p.status.toUpperCase()}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>
        </section>
    );
}

/**
 * Generate a deterministic cluster of dots for an abstract continent.
 * Same seed → same output, so SSR + client agree.
 */
function dotCluster(cx: number, cy: number, rx: number, ry: number, count: number) {
    const dots: JSX.Element[] = [];
    let seed = cx * 1000 + cy;
    const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
    for (let i = 0; i < count; i++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand());
        const x = cx + Math.cos(a) * rx * r;
        const y = cy + Math.sin(a) * ry * r;
        dots.push(<circle key={`${cx}-${cy}-${i}`} cx={x} cy={y} r={1} />);
    }
    return dots;
}
