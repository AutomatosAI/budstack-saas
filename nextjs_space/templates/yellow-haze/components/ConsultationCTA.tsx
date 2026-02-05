interface ConsultationCTAProps {
  businessName: string;
  consultationUrl?: string;
}

export default function ConsultationCTA({
  businessName,
  consultationUrl
}: ConsultationCTAProps) {
  return (
    <section className="section-padding bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">
          Ready to Elevate?
        </h2>
        <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
          Book your consultation with {businessName} today and discover your path to wellness.
        </p>
        {consultationUrl && (
          <a
            href={consultationUrl}
            className="btn-secondary inline-block"
          >
            Book Your Consultation
          </a>
        )}
      </div>
    </section>
  );
}
