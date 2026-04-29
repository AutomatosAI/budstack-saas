import BigDashboard from "./BigDashboard";

export default function DashboardShowcase() {
    return (
        <section className="relative overflow-hidden bg-bs-bg-0 px-5 pb-24 pt-20 sm:px-10 sm:pt-28 lg:px-20 lg:pb-32 lg:pt-32">
            {/* Eyebrow + headline */}
            <div className="mx-auto max-w-[820px] text-center">
                <span className="bs-eyebrow bs-eyebrow-green">The Operating Console</span>
                <h2 className="mt-4 font-bs-serif text-[34px] font-medium leading-[1.1] tracking-[-0.02em] text-bs-gold-300 sm:text-[44px] lg:text-[56px] xl:text-[64px]">
                    Everything you need to run a regulated cannabis business.
                </h2>
            </div>

            {/* Tilted dashboard mock with green halo */}
            <div className="relative mx-auto mt-16 max-w-[1180px] sm:mt-20">
                {/* Green glow halo behind */}
                <div
                    className="pointer-events-none absolute inset-x-[-40px] inset-y-[-80px] -z-10 blur-[60px]"
                    style={{
                        background:
                            "radial-gradient(ellipse 55% 70% at 50% 40%, rgba(82,217,122,0.35), transparent 65%)",
                    }}
                    aria-hidden
                />

                {/* On mobile: render flat. Desktop: tilted 3D. */}
                <div className="dashboard-tilt">
                    <BigDashboard />
                </div>
            </div>

            <style>{`
        @media (min-width: 1024px) {
          .dashboard-tilt {
            transform: perspective(2000px) rotateX(18deg) rotateY(-5deg) rotateZ(0.5deg) scale(0.96);
            transform-origin: 50% 80%;
            box-shadow:
              0 100px 160px -30px rgba(0,0,0,0.7),
              0 0 0 1px rgba(82,217,122,0.15);
            border-radius: 16px;
          }
        }
      `}</style>
        </section>
    );
}
