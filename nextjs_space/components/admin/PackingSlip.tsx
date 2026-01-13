"use client";

import { useEffect } from "react";
import { format } from "date-fns";
import { Package, MapPin, Phone, Mail, Hash } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

/**
 * Order item data shape
 */
interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
}

/**
 * Order data shape for packing slip
 */
interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  subtotal: number;
  shippingCost: number;
  createdAt: string;
  items: OrderItem[];
  user: {
    name: string | null;
    email: string;
  };
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
}

interface PackingSlipProps {
  /** Order data to display */
  order: Order;
  /** Business name for header */
  businessName?: string;
  /** Business logo URL (optional) */
  logoUrl?: string;
  /** Auto-print on mount */
  autoPrint?: boolean;
}

/**
 * PackingSlip - Professional print-optimized packing slip component
 *
 * **Design Aesthetic: Professional Logistics Document**
 * - Clean, structured, utilitarian with refined typography
 * - Clear information hierarchy for scannable fulfillment
 * - Dual-mode: elegant on-screen preview, perfectly optimized for print
 * - Monospaced IDs, scannable QR codes, professional layout
 *
 * Features:
 * - Print-optimized CSS with @media print rules
 * - QR code for order tracking
 * - Clean grid layout with clear sections
 * - Professional typography with IBM Plex Mono for IDs
 * - Auto-print on mount (optional)
 * - Removes navigation/buttons in print mode
 */
export function PackingSlip({
  order,
  businessName = "BudStack",
  logoUrl,
  autoPrint = false,
}: PackingSlipProps) {
  useEffect(() => {
    if (autoPrint) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  // Format shipping address
  const shippingAddress = order.shippingAddress || {
    street: "Not provided",
    city: "N/A",
    state: "N/A",
    postalCode: "N/A",
    country: "N/A",
  };

  // Generate tracking URL for QR code
  const trackingUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/track/${order.orderNumber}`;

  return (
    <>
      {/* Google Fonts: IBM Plex Mono for monospaced IDs */}
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div className="packing-slip-container min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 p-8 print:p-0 print:bg-white">
        {/* No-print controls */}
        <div className="no-print mb-6 flex justify-between items-center">
          <button
            onClick={() => window.print()}
            className="px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition-colors shadow-lg hover:shadow-xl"
          >
            Print Packing Slip
          </button>
          <button
            onClick={() => window.close()}
            className="px-6 py-3 bg-white text-slate-700 border-2 border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>

        {/* Main packing slip document */}
        <div className="packing-slip-document max-w-4xl mx-auto bg-white shadow-2xl print:shadow-none rounded-lg print:rounded-none overflow-hidden">
          {/* Document Header */}
          <div className="header-section bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white p-8 print:bg-slate-900">
            <div className="flex items-start justify-between">
              {/* Business Info */}
              <div className="flex-1">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={businessName}
                    className="h-12 w-auto mb-3"
                  />
                ) : (
                  <div className="mb-3">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
                      <Package className="w-6 h-6 text-white" />
                    </div>
                  </div>
                )}
                <h1 className="text-3xl font-bold tracking-tight mb-1">
                  {businessName}
                </h1>
                <p className="text-slate-300 text-sm font-medium uppercase tracking-wider">
                  Packing Slip
                </p>
              </div>

              {/* QR Code */}
              <div className="bg-white p-3 rounded-lg shadow-xl">
                <QRCodeSVG
                  value={trackingUrl}
                  size={96}
                  level="H"
                  includeMargin={false}
                />
                <p className="text-[10px] text-slate-600 text-center mt-2 font-mono">
                  Scan to track
                </p>
              </div>
            </div>
          </div>

          {/* Order Information Bar */}
          <div className="bg-slate-100 border-b-2 border-slate-300 px-8 py-4 grid grid-cols-3 gap-4 print:border-slate-400">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">
                Order Number
              </p>
              <p className="font-mono text-lg font-bold text-slate-900">
                #{order.orderNumber.slice(-12).toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">
                Order Date
              </p>
              <p className="text-slate-900 font-semibold">
                {format(new Date(order.createdAt), "MMM d, yyyy")}
              </p>
              <p className="text-slate-600 text-sm">
                {format(new Date(order.createdAt), "h:mm a")}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">
                Status
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 border border-blue-300 rounded-md">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse print:animate-none" />
                <span className="text-blue-900 font-semibold text-sm">
                  {order.status}
                </span>
              </div>
            </div>
          </div>

          {/* Body: Two-column layout */}
          <div className="grid grid-cols-2 gap-8 p-8">
            {/* Left Column: Shipping Address */}
            <div>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-slate-200">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <MapPin className="w-5 h-5 text-slate-700" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                  Ship To
                </h2>
              </div>
              <div className="space-y-2">
                <p className="text-lg font-bold text-slate-900">
                  {order.user?.name || "Guest"}
                </p>
                <p className="text-slate-700">{shippingAddress.street}</p>
                <p className="text-slate-700">
                  {shippingAddress.city}, {shippingAddress.state}{" "}
                  {shippingAddress.postalCode}
                </p>
                <p className="text-slate-700 font-semibold">
                  {shippingAddress.country}
                </p>

                {/* Contact Info */}
                <div className="pt-3 mt-3 border-t border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm">{order.user?.email}</span>
                  </div>
                  {shippingAddress.phone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-4 h-4" />
                      <span className="text-sm">{shippingAddress.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Order Summary Stats */}
            <div>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-slate-200">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Hash className="w-5 h-5 text-slate-700" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                  Summary
                </h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-600 font-medium">
                    Total Items
                  </span>
                  <span className="text-2xl font-bold text-slate-900">
                    {order.items.length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-600 font-medium">
                    Total Quantity
                  </span>
                  <span className="text-2xl font-bold text-slate-900">
                    {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border-2 border-emerald-300">
                  <span className="text-emerald-900 font-bold">
                    Order Total
                  </span>
                  <span className="text-2xl font-bold text-emerald-900">
                    €{order.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="px-8 pb-8">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-slate-200">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Package className="w-5 h-5 text-slate-700" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                Items to Pack
              </h2>
            </div>

            <div className="border-2 border-slate-300 rounded-lg overflow-hidden print:border-slate-400">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="text-left px-4 py-3 font-bold text-sm uppercase tracking-wider">
                      Item
                    </th>
                    <th className="text-center px-4 py-3 font-bold text-sm uppercase tracking-wider w-24">
                      Qty
                    </th>
                    <th className="text-right px-4 py-3 font-bold text-sm uppercase tracking-wider w-32">
                      Price
                    </th>
                    <th className="text-right px-4 py-3 font-bold text-sm uppercase tracking-wider w-32">
                      Total
                    </th>
                    <th className="px-4 py-3 w-16 print:table-cell hidden">
                      <span className="sr-only">Packed</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, index) => (
                    <tr
                      key={item.id}
                      className={`border-b border-slate-200 ${
                        index % 2 === 0 ? "bg-white" : "bg-slate-50"
                      }`}
                    >
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">
                          {item.productName}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 border-2 border-blue-300 rounded-lg font-bold text-blue-900 text-lg">
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-slate-700">
                        €{item.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold text-slate-900">
                        €{(item.quantity * item.price).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-center print:table-cell hidden">
                        <div className="w-8 h-8 border-2 border-slate-400 rounded-md" />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold">
                    <td colSpan={2} className="px-4 py-3 text-slate-600">
                      Subtotal
                    </td>
                    <td
                      colSpan={2}
                      className="px-4 py-3 text-right font-mono text-slate-900"
                    >
                      €{order.subtotal.toFixed(2)}
                    </td>
                    <td className="print:table-cell hidden" />
                  </tr>
                  <tr className="bg-slate-100">
                    <td colSpan={2} className="px-4 py-3 text-slate-600">
                      Shipping
                    </td>
                    <td
                      colSpan={2}
                      className="px-4 py-3 text-right font-mono text-slate-700"
                    >
                      €{order.shippingCost.toFixed(2)}
                    </td>
                    <td className="print:table-cell hidden" />
                  </tr>
                  <tr className="bg-slate-800 text-white">
                    <td
                      colSpan={2}
                      className="px-4 py-4 text-lg font-bold uppercase tracking-wider"
                    >
                      Total
                    </td>
                    <td
                      colSpan={2}
                      className="px-4 py-4 text-right text-xl font-bold font-mono"
                    >
                      €{order.total.toFixed(2)}
                    </td>
                    <td className="print:table-cell hidden" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-100 px-8 py-6 border-t-2 border-slate-300 print:border-slate-400">
            <div className="grid grid-cols-2 gap-8 text-sm text-slate-600">
              <div>
                <p className="font-semibold text-slate-900 mb-2">
                  Packing Instructions:
                </p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Verify all items before sealing package</li>
                  <li>Include this packing slip in shipment</li>
                  <li>Use appropriate packaging materials</li>
                </ul>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  Printed On
                </p>
                <p className="font-mono font-semibold text-slate-900">
                  {format(new Date(), "MMM d, yyyy • h:mm a")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print-specific styles */}
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@400;500;600;700&display=swap");

        .packing-slip-container {
          font-family:
            "Inter",
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .packing-slip-container .font-mono {
          font-family: "IBM Plex Mono", "Courier New", monospace;
        }

        @media print {
          /* Remove page margins and backgrounds */
          @page {
            margin: 0.5cm;
            size: A4 portrait;
          }

          body {
            margin: 0;
            padding: 0;
            background: white;
          }

          /* Hide no-print elements */
          .no-print {
            display: none !important;
          }

          /* Reset container for print */
          .packing-slip-container {
            background: white;
            padding: 0;
            margin: 0;
            min-height: auto;
          }

          /* Document styling for print */
          .packing-slip-document {
            max-width: 100%;
            margin: 0;
            box-shadow: none;
            border-radius: 0;
          }

          /* Ensure crisp text */
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }

          /* Force background colors to print */
          .header-section {
            background: #1e293b !important;
            color: white !important;
          }

          /* Prevent page breaks inside elements */
          .header-section,
          .grid,
          table,
          tr {
            page-break-inside: avoid;
          }

          /* Remove animations and transitions */
          *,
          *::before,
          *::after {
            animation-duration: 0s !important;
            transition-duration: 0s !important;
          }

          /* Show packed checkboxes in print */
          .print\\:table-cell {
            display: table-cell !important;
          }

          /* Ensure QR code prints */
          svg {
            display: block !important;
          }
        }

        @media screen {
          /* Hide print-only elements on screen */
          .print\\:table-cell {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
