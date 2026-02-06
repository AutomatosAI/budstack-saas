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

  // Apply width constraint to the template wrapper div (class="template-{slug}")
  useEffect(() => {
    const container = document.querySelector(
      '[class^="template-"]'
    ) as HTMLElement | null;
    if (!container) return;

    const device = devices.find((d) => d.id === activeDevice);
    if (activeDevice === "desktop") {
      container.style.maxWidth = "";
      container.style.marginLeft = "";
      container.style.marginRight = "";
      container.style.boxShadow = "";
    } else {
      container.style.maxWidth = device?.width || "100%";
      container.style.marginLeft = "auto";
      container.style.marginRight = "auto";
      container.style.boxShadow = "0 0 40px rgba(0,0,0,0.15)";
    }

    return () => {
      if (container) {
        container.style.maxWidth = "";
        container.style.marginLeft = "";
        container.style.marginRight = "";
        container.style.boxShadow = "";
      }
    };
  }, [activeDevice]);

  return (
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
        {devices.map((device) => {
          const Icon = deviceIcons[device.id];
          return (
            <button
              key={device.id}
              onClick={() => setActiveDevice(device.id)}
              className={`p-2 rounded-md transition-all ${
                activeDevice === device.id
                  ? "bg-purple-500 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
              title={device.label}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>

      <span className="text-xs text-white/40">
        Dev only — not for production
      </span>
    </div>
  );
}
