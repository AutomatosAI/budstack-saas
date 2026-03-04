"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export function AdvancedTab({ formData, setFormData, tenant }: AdvancedTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Custom CSS</CardTitle>
          <CardDescription>
            Add custom CSS for advanced styling (applies to ALL pages)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.customCSS}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, customCSS: e.target.value }))
            }
            placeholder=".my-custom-class { color: red; }"
            rows={10}
            className="font-mono text-sm"
          />
          <p className="text-sm text-gray-500 mt-2">
            Advanced users only. Use CSS selectors to override default styles.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview Your Store</CardTitle>
          <CardDescription>See how your changes look live</CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href={getTenantUrl(tenant)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ImageIcon className="w-5 h-5 mr-2" />
            View Live Store
          </a>
          <p className="text-sm text-gray-500 mt-2">
            Open your store in a new tab to preview changes
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
