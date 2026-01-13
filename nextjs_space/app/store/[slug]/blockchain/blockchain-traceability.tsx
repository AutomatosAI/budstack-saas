"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sprout,
  Dna,
  Leaf,
  Scissors,
  Microscope,
  Package,
  Truck,
  CheckCircle,
  Shield,
  Eye,
  Lock,
} from "lucide-react";

interface TrackingStage {
  id: string;
  title: string;
  description: string;
  Icon: typeof Sprout;
  status: "completed" | "active" | "pending";
  timestamp?: string;
  details: {
    label: string;
    value: string;
  }[];
}

const BlockchainTraceability = () => {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);

  const trackingStages: TrackingStage[] = [
    {
      id: "seed",
      title: "Seed Registration",
      description: "Cannabis seed registered with unique genome sequence",
      Icon: Sprout,
      status: "completed",
      timestamp: "2024-01-15 08:30:00",
      details: [
        { label: "Genome ID", value: "0x7A3F...B2C9" },
        { label: "Strain", value: "Northern Lights" },
        { label: "Origin", value: "Cape Town Facility" },
        { label: "Genetics", value: "Indica Dominant" },
      ],
    },
    {
      id: "sequencing",
      title: "Genome Sequencing",
      description: "Plant DNA encrypted into blockchain key-pairs",
      Icon: Dna,
      status: "completed",
      timestamp: "2024-01-15 09:45:00",
      details: [
        { label: "Public Key", value: "0xA1B2...C3D4" },
        { label: "Private Key", value: "Secured on-chain" },
        { label: "QR Code", value: "Generated" },
        { label: "Verification", value: "Blockchain Verified" },
      ],
    },
    {
      id: "cultivation",
      title: "Cultivation Tracking",
      description: "Growth cycle monitored with blockchain checkpoints",
      Icon: Leaf,
      status: "completed",
      timestamp: "2024-02-20 14:20:00",
      details: [
        { label: "Duration", value: "90 Days" },
        { label: "Environment", value: "Controlled Indoor" },
        { label: "Checkpoints", value: "24 Verified" },
        { label: "License", value: "SAHPRA-2024-001" },
      ],
    },
    {
      id: "harvest",
      title: "Harvest & Processing",
      description: "Product harvested and quality tested",
      Icon: Scissors,
      status: "completed",
      timestamp: "2024-03-15 11:00:00",
      details: [
        { label: "Batch ID", value: "NL-2024-Q1-045" },
        { label: "Weight", value: "2.5 kg" },
        { label: "THC Content", value: "22.4%" },
        { label: "CBD Content", value: "1.2%" },
      ],
    },
    {
      id: "lab",
      title: "Lab Testing",
      description: "Independent lab verification and certification",
      Icon: Microscope,
      status: "completed",
      timestamp: "2024-03-18 16:30:00",
      details: [
        { label: "Lab", value: "CannaSafe Analytics" },
        { label: "Microbial", value: "Pass" },
        { label: "Heavy Metals", value: "Pass" },
        { label: "Certificate", value: "CS-2024-0318" },
      ],
    },
    {
      id: "packaging",
      title: "Packaging & QR",
      description: "Product sealed with blockchain-verified QR code",
      Icon: Package,
      status: "active",
      timestamp: "2024-03-20 10:15:00",
      details: [
        { label: "QR Generated", value: "Yes" },
        { label: "Tamper Seal", value: "Applied" },
        { label: "Package ID", value: "PKG-2024-045-01" },
        { label: "Expiry Date", value: "2025-03-20" },
      ],
    },
    {
      id: "distribution",
      title: "Distribution",
      description: "Licensed partner delivery to medical dispensaries",
      Icon: Truck,
      status: "pending",
      details: [
        { label: "Carrier", value: "Licensed Courier" },
        { label: "Destination", value: "Medical Clinic - Lisbon" },
        { label: "ETA", value: "2024-03-22" },
        { label: "Temperature", value: "Monitored" },
      ],
    },
    {
      id: "consumer",
      title: "Consumer Verification",
      description: "End user scans QR to verify authenticity",
      Icon: CheckCircle,
      status: "pending",
      details: [
        { label: "Verification", value: "Pending" },
        { label: "Authenticity", value: "Blockchain Verified" },
        { label: "Journey", value: "Full Transparency" },
        { label: "Anti-Spoofing", value: "Protected" },
      ],
    },
  ];

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed":
        return {
          backgroundColor: "var(--tenant-color-primary, #047857)",
          color: "#ffffff",
          opacity: 0.9,
        };
      case "active":
        return {
          backgroundColor: "var(--tenant-color-secondary, #0d9488)",
          color: "#ffffff",
          opacity: 0.9,
        };
      case "pending":
        return {
          backgroundColor: "var(--tenant-color-muted, #f3f4f6)",
          color: "var(--tenant-color-text, #4a5568)",
          border: "1px solid var(--tenant-color-border, #e5e7eb)",
        };
      default:
        return {
          backgroundColor: "var(--tenant-color-muted, #f3f4f6)",
          color: "var(--tenant-color-text, #4a5568)",
          border: "1px solid var(--tenant-color-border, #e5e7eb)",
        };
    }
  };

  const stage = selectedStage
    ? trackingStages.find((s) => s.id === selectedStage)
    : null;

  return (
    <div
      className="w-full py-20 md:py-32"
      style={{
        backgroundColor: "var(--tenant-color-background, #ffffff)",
        fontFamily: "var(--tenant-font-base, inherit)",
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16 max-w-4xl mx-auto">
          <Badge
            className="mb-4 text-xs font-bold tracking-wider"
            style={{
              backgroundColor: "var(--tenant-color-primary, #047857)",
              color: "#ffffff",
            }}
          >
            BLOCKCHAIN TECHNOLOGY
          </Badge>
          <h2
            className="text-4xl md:text-5xl font-semibold mb-6"
            style={{
              color: "var(--tenant-color-heading, #1a1a1a)",
              fontFamily: "var(--tenant-font-heading, inherit)",
            }}
          >
            Seed-to-Sale{" "}
            <span style={{ color: "var(--tenant-color-primary, #047857)" }}>
              Traceability
            </span>
          </h2>
          <p
            className="text-lg leading-relaxed"
            style={{
              color: "var(--tenant-color-text, #4a5568)",
              fontFamily: "var(--tenant-font-base, inherit)",
            }}
          >
            Every product journey is immutably recorded on the blockchain with
            genome sequencing verification, eliminating counterfeits and
            ensuring complete transparency.
          </p>
        </div>

        {/* Tracking Timeline */}
        <div className="relative mb-16 max-w-6xl mx-auto">
          {/* Progress Line */}
          <div
            className="absolute left-1/2 top-0 bottom-0 w-1 transform -translate-x-1/2 hidden md:block"
            style={{
              backgroundColor: "var(--tenant-color-border, #e5e7eb)",
              opacity: 0.4,
            }}
          />

          <div className="space-y-8">
            {trackingStages.map((stage, index) => {
              const IconComponent = stage.Icon;
              return (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`flex items-center gap-6 ${
                    index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                  }`}
                >
                  {/* Content Card */}
                  <div
                    className={`flex-1 p-6 cursor-pointer transition-all rounded-lg ${
                      selectedStage === stage.id ? "shadow-xl" : "shadow-md"
                    }`}
                    onClick={() =>
                      setSelectedStage(
                        selectedStage === stage.id ? null : stage.id,
                      )
                    }
                    style={{
                      backgroundColor: "var(--tenant-color-surface, #ffffff)",
                      border:
                        selectedStage === stage.id
                          ? `2px solid var(--tenant-color-primary, #047857)`
                          : `1px solid var(--tenant-color-border, #e5e7eb)`,
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                        style={{
                          background: `linear-gradient(135deg, var(--tenant-color-primary, #047857), var(--tenant-color-secondary, #0d9488))`,
                        }}
                      >
                        <IconComponent
                          className="w-6 h-6 text-white"
                          strokeWidth={2}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3
                            className="font-semibold text-lg"
                            style={{
                              color: "var(--tenant-color-heading, #1a1a1a)",
                              fontFamily: "var(--tenant-font-heading, inherit)",
                            }}
                          >
                            {stage.title}
                          </h3>
                          <Badge
                            className="text-[10px]"
                            style={getStatusStyle(stage.status)}
                          >
                            {stage.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p
                          className="text-sm mb-2"
                          style={{
                            color: "var(--tenant-color-text, #4a5568)",
                            fontFamily: "var(--tenant-font-base, inherit)",
                          }}
                        >
                          {stage.description}
                        </p>
                        {stage.timestamp && (
                          <p
                            className="text-xs font-mono"
                            style={{
                              color: "var(--tenant-color-text, #4a5568)",
                            }}
                          >
                            {stage.timestamp}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Timeline Node */}
                  <div className="relative z-10 hidden md:block">
                    <div
                      className={`w-12 h-12 rounded-full border-4 flex items-center justify-center font-bold transition-all shadow-lg ${
                        stage.status === "active" ? "animate-pulse" : ""
                      }`}
                      style={{
                        backgroundColor:
                          stage.status === "completed"
                            ? "var(--tenant-color-primary, #047857)"
                            : stage.status === "active"
                              ? "var(--tenant-color-secondary, #0d9488)"
                              : "var(--tenant-color-background, #ffffff)",
                        borderColor:
                          stage.status === "completed" ||
                          stage.status === "active"
                            ? "var(--tenant-color-primary, #047857)"
                            : "var(--tenant-color-border, #e5e7eb)",
                        color:
                          stage.status === "completed" ||
                          stage.status === "active"
                            ? "#ffffff"
                            : "var(--tenant-color-text, #4a5568)",
                      }}
                    >
                      {stage.status === "completed" && (
                        <CheckCircle className="w-6 h-6" />
                      )}
                      {stage.status === "active" && (
                        <div className="w-3 h-3 rounded-full bg-white" />
                      )}
                      {stage.status === "pending" && (
                        <div
                          className="w-3 h-3 rounded-full border-2"
                          style={{
                            borderColor: "var(--tenant-color-text, #4a5568)",
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Spacer for alternating layout */}
                  <div className="flex-1 hidden md:block" />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Stage Details Panel */}
        <AnimatePresence mode="wait">
          {stage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-6xl mx-auto"
            >
              <div
                className="p-8 rounded-lg"
                style={{
                  backgroundColor: "var(--tenant-color-surface, #ffffff)",
                  border: "1px solid var(--tenant-color-border, #e5e7eb)",
                }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, var(--tenant-color-primary, #047857), var(--tenant-color-secondary, #0d9488))`,
                      }}
                    >
                      <stage.Icon
                        className="w-7 h-7 text-white"
                        strokeWidth={2}
                      />
                    </div>
                    <div>
                      <h3
                        className="text-2xl font-semibold mb-1"
                        style={{
                          color: "var(--tenant-color-heading, #1a1a1a)",
                          fontFamily: "var(--tenant-font-heading, inherit)",
                        }}
                      >
                        {stage.title}
                      </h3>
                      <p
                        style={{
                          color: "var(--tenant-color-text, #4a5568)",
                          fontFamily: "var(--tenant-font-base, inherit)",
                        }}
                      >
                        {stage.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedStage(null)}
                  >
                    ✕
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stage.details.map((detail, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-lg"
                      style={{
                        backgroundColor:
                          "var(--tenant-color-background, #ffffff)",
                        border: "1px solid var(--tenant-color-border, #e5e7eb)",
                      }}
                    >
                      <div
                        className="text-xs font-semibold uppercase tracking-wider mb-1"
                        style={{
                          color: "var(--tenant-color-text, #4a5568)",
                          opacity: 0.8,
                        }}
                      >
                        {detail.label}
                      </div>
                      <div
                        className="text-sm font-mono font-semibold"
                        style={{
                          color: "var(--tenant-color-heading, #1a1a1a)",
                        }}
                      >
                        {detail.value}
                      </div>
                    </div>
                  ))}
                </div>

                {stage.id === "sequencing" && (
                  <div
                    className="mt-6 pt-6"
                    style={{
                      borderTop:
                        "1px solid var(--tenant-color-border, #e5e7eb)",
                    }}
                  >
                    <Button
                      onClick={() => setShowQRCode(!showQRCode)}
                      className="w-full"
                    >
                      {showQRCode ? "Hide" : "View"} QR Code Verification
                    </Button>

                    <AnimatePresence>
                      {showQRCode && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 p-6 text-center rounded-lg"
                          style={{
                            backgroundColor:
                              "var(--tenant-color-surface, #ffffff)",
                            border:
                              "1px solid var(--tenant-color-border, #e5e7eb)",
                          }}
                        >
                          <div className="w-48 h-48 mx-auto bg-white rounded-lg flex items-center justify-center mb-4">
                            {/* QR Code Placeholder */}
                            <div className="grid grid-cols-8 gap-1 p-2">
                              {Array.from({ length: 64 }).map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-4 h-4 ${
                                    Math.random() > 0.5
                                      ? "bg-black"
                                      : "bg-white"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <p
                            className="text-sm"
                            style={{
                              color: "var(--tenant-color-text, #4a5568)",
                              opacity: 0.8,
                            }}
                          >
                            Scan to verify product authenticity and view
                            complete blockchain journey
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Technology Explanation */}
        <div className="mt-16 grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <div
            className="p-7 rounded-lg group transition-all duration-200"
            style={{
              backgroundColor: "var(--tenant-color-surface, #ffffff)",
              border: "1px solid var(--tenant-color-border, #e5e7eb)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-xl transition-all duration-200 group-hover:scale-110"
              style={{
                background: `linear-gradient(135deg, var(--tenant-color-primary, #047857), var(--tenant-color-secondary, #0d9488))`,
              }}
            >
              <Lock className="w-8 h-8 text-white" strokeWidth={2} />
            </div>
            <h3
              className="font-semibold text-lg mb-2"
              style={{
                color: "var(--tenant-color-heading, #1a1a1a)",
                fontFamily: "var(--tenant-font-heading, inherit)",
              }}
            >
              Genome Encryption
            </h3>
            <p
              className="text-sm leading-relaxed"
              style={{
                color: "var(--tenant-color-text, #4a5568)",
                fontFamily: "var(--tenant-font-base, inherit)",
                opacity: 0.8,
              }}
            >
              Plant DNA is sequenced and encrypted into public/private key-pairs
              at the seed stage, creating an immutable genetic fingerprint on
              the blockchain.
            </p>
          </div>

          <div
            className="p-7 rounded-lg group transition-all duration-200"
            style={{
              backgroundColor: "var(--tenant-color-surface, #ffffff)",
              border: "1px solid var(--tenant-color-border, #e5e7eb)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-xl transition-all duration-200 group-hover:scale-110"
              style={{
                background: `linear-gradient(135deg, var(--tenant-color-primary, #047857), var(--tenant-color-secondary, #0d9488))`,
              }}
            >
              <Shield className="w-8 h-8 text-white" strokeWidth={2} />
            </div>
            <h3
              className="font-semibold text-lg mb-2"
              style={{
                color: "var(--tenant-color-heading, #1a1a1a)",
                fontFamily: "var(--tenant-font-heading, inherit)",
              }}
            >
              Anti-Spoofing Protection
            </h3>
            <p
              className="text-sm leading-relaxed"
              style={{
                color: "var(--tenant-color-text, #4a5568)",
                fontFamily: "var(--tenant-font-base, inherit)",
                opacity: 0.8,
              }}
            >
              QR codes contain encrypted genome data that can be verified
              against our secure servers, preventing illegal cannabis from
              entering the legal supply chain.
            </p>
          </div>

          <div
            className="p-7 rounded-lg group transition-all duration-200"
            style={{
              backgroundColor: "var(--tenant-color-surface, #ffffff)",
              border: "1px solid var(--tenant-color-border, #e5e7eb)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-xl transition-all duration-200 group-hover:scale-110"
              style={{
                background: `linear-gradient(135deg, var(--tenant-color-primary, #047857), var(--tenant-color-secondary, #0d9488))`,
              }}
            >
              <Eye className="w-8 h-8 text-white" strokeWidth={2} />
            </div>
            <h3
              className="font-semibold text-lg mb-2"
              style={{
                color: "var(--tenant-color-heading, #1a1a1a)",
                fontFamily: "var(--tenant-font-heading, inherit)",
              }}
            >
              Full Transparency
            </h3>
            <p
              className="text-sm leading-relaxed"
              style={{
                color: "var(--tenant-color-text, #4a5568)",
                fontFamily: "var(--tenant-font-base, inherit)",
                opacity: 0.8,
              }}
            >
              Every step from seed to consumer is recorded on-chain with
              timestamps, ensuring regulatory compliance and building consumer
              trust.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center max-w-6xl mx-auto">
          <div
            className="p-8 rounded-lg transition-all duration-200"
            style={{
              backgroundColor: "var(--tenant-color-surface, #ffffff)",
              border: "1px solid var(--tenant-color-border, #e5e7eb)",
            }}
          >
            <h3
              className="text-2xl font-semibold mb-3"
              style={{
                color: "var(--tenant-color-heading, #1a1a1a)",
                fontFamily: "var(--tenant-font-heading, inherit)",
              }}
            >
              Experience The Future of Cannabis Traceability
            </h3>
            <p
              className="mb-6 max-w-2xl mx-auto leading-relaxed"
              style={{
                color: "var(--tenant-color-text, #4a5568)",
                fontFamily: "var(--tenant-font-base, inherit)",
                opacity: 0.8,
              }}
            >
              Our blockchain-verified system ensures every product is authentic,
              compliant, and traceable from seed to consumer.
            </p>
            <Button size="lg" className="gap-2">
              Learn More About Our Technology
              <span>→</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockchainTraceability;
