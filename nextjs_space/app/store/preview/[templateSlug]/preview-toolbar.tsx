"use client";

import { useState, useEffect } from "react";
import { Monitor, Tablet, Smartphone, Eye } from "lucide-react";

const devices = [
  { id: "desktop", label: "Desktop", width: "100%" },
  { id: "tablet", label: "Tablet", width: "768px" },
  { id: "mobile", label: "Mobile", width: "375px" },
] as const;

type DeviceId = (typeof devices)[number]["id"];

const deviceIcons = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

export default function PreviewToolbar({
  templateName,
}: {
  templateName: string;
}) {
  const [activeDevice, setActiveDevice] = useState<DeviceId>("desktop");

  const device = devices.find((d) => d.id === activeDevice)!;
  const showIframe = activeDevice !== "desktop";

  // Hide/show the server-rendered .preview-content when iframe is active
  useEffect(() => {
    const content = document.querySelector(".preview-content") as HTMLElement | null;
    if (content) {
      content.style.display = showIframe ? "none" : "";
    }
  }, [showIframe]);

  return (
    <>
      {/* Toolbar */}
      <div
        className="sticky top-0 z-[100] flex items-center justify-between px-6 py-3 border-b"
        style={{
          backgroundColor: "#1a1a2e",
          borderColor: "#2d2d44",
          color: "white",
        }}
      >
        <div className="flex items-center gap-3">
          <Eye size={18} className="text-purple-400" />
          <span className="text-sm font-medium">
            Preview Mode —{" "}
            <span className="text-purple-300">{templateName}</span>
          </span>
        </div>

        {/* Device Toggle */}
        <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
          {devices.map((d) => {
            const Icon = deviceIcons[d.id];
            return (
              <button
                key={d.id}
                onClick={() => setActiveDevice(d.id)}
                className={`p-2 rounded-md transition-all ${
                  activeDevice === d.id
                    ? "bg-purple-500 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
                title={d.label}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>

        <span className="text-xs text-white/40">
          {showIframe ? `${device.width} viewport` : "Dev only — not for production"}
        </span>
      </div>

      {/* Iframe for mobile/tablet — real viewport width so media queries work */}
      {showIframe && (
        <div
          className="flex justify-center bg-slate-200 dark:bg-slate-900"
          style={{ minHeight: "calc(100vh - 52px)" }}
        >
          <div
            className="bg-white shadow-2xl"
            style={{
              width: device.width,
              maxWidth: device.width,
              height: "calc(100vh - 52px)",
              borderRadius: activeDevice === "mobile" ? "0 0 2rem 2rem" : undefined,
              overflow: "hidden",
            }}
          >
            <iframe
              src={`${window.location.pathname}${window.location.search ? window.location.search + '&' : '?'}embed=true`}
              className="w-full h-full border-0"
              title={`${device.label} preview`}
            />
          </div>
        </div>
      )}
    </>
  );
}
