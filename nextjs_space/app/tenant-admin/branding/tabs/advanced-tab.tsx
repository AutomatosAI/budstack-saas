"use client";

import { Textarea } from "@/components/ui/textarea";
import { Image as ImageIcon } from "lucide-react";
import { getTenantUrl } from "@/lib/tenant-utils";
import type { EditorFormData, SetFormData } from "./types";

interface AdvancedTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
  tenant: {
    id: string;
    businessName: string;
    subdomain: string;
    customDomain: string | null;
    settings: any;
  };
}

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

export function AdvancedTab({ formData, setFormData, tenant }: AdvancedTabProps) {
  return (
    <div className="space-y-6">
      <section className="bs-card bs-card-pad space-y-3">
        <div>
          <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
            Custom CSS
          </h3>
          <p className="text-sm text-bs-fg-muted">
            Add custom CSS for advanced styling (applies to ALL pages)
          </p>
        </div>
        <Textarea
          value={formData.customCSS}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, customCSS: e.target.value }))
          }
          placeholder=".my-custom-class { color: red; }"
          rows={10}
          className="font-mono text-sm"
        />
        <p className="text-sm text-bs-fg-muted">
          Advanced users only. Use CSS selectors to override default styles.
        </p>
      </section>

      <section className="bs-card bs-card-pad space-y-3">
        <div>
          <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
            Preview Your Store
          </h3>
          <p className="text-sm text-bs-fg-muted">See how your changes look live</p>
        </div>
        <a
          href={getTenantUrl(tenant)}
          target="_blank"
          rel="noopener noreferrer"
          className="bs-btn bs-btn-green"
        >
          <ImageIcon className="w-5 h-5 mr-2" aria-hidden="true" />
          View Live Store
        </a>
        <p className="text-sm text-bs-fg-muted">
          Open your store in a new tab to preview changes
        </p>
      </section>
    </div>
  );
}
