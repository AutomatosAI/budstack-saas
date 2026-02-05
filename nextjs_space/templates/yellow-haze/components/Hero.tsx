interface HeroProps {
  businessName: string;
  heroImageUrl?: string | null;
  consultationUrl?: string;
}

export default function Hero({
  businessName,
  heroImageUrl,
  consultationUrl
}: HeroProps) {
  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      {heroImageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{ backgroundImage: `url(${heroImageUrl})` }}
        />
      )}

      {/* Warm gradient overlay matching the golden haze aesthetic */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(30, 20, 10, 0.3) 0%, rgba(45, 30, 15, 0.5) 50%, rgba(30, 20, 10, 0.7) 100%)'
        }}
      />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center text-white">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 drop-shadow-lg">
          {businessName}
        </h1>
        <p className="text-xl md:text-2xl mb-8 max-w-2xl mx-auto drop-shadow-md">
          Elevate your wellness journey with premium medical cannabis
        </p>
        {consultationUrl && (
          <a
            href={consultationUrl}
            className="btn-primary inline-block"
          >
            Book Consultation
          </a>
        )}
      </div>
    </section>
  );
}
