"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useEffect, useState } from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Custom toast functions with consistent styling for the admin panels.
 *
 * Usage:
 * - toast.success('Tenant activated') - Green with checkmark, 3s duration
 * - toast.error('Failed to load orders') - Red with X icon, 5s duration
 * - toast.loading('Processing...') - Blue with spinner, dismissible
 * - toast.warning('Low stock alert') - Amber with warning icon, 4s duration
 * - toast.info('New order received') - Cyan with info icon, 3s duration
 */
export const toast = {
  success: (message: string, options?: { description?: string }) => {
    return sonnerToast.custom(
      (id) => (
        <div className="toast-success group flex items-start gap-3 w-full p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg shadow-lg shadow-emerald-100/50">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-900">{message}</p>
            {options?.description && (
              <p className="text-xs text-emerald-700 mt-0.5">
                {options.description}
              </p>
            )}
          </div>
          <button
            onClick={() => sonnerToast.dismiss(id)}
            className="flex-shrink-0 text-emerald-400 hover:text-emerald-600 transition-colors"
            aria-label="Dismiss notification"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      ),
      { duration: 3000 },
    );
  },

  error: (message: string, options?: { description?: string }) => {
    return sonnerToast.custom(
      (id) => (
        <div className="toast-error group flex items-start gap-3 w-full p-4 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-lg shadow-lg shadow-red-100/50">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
            <XCircle className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-900">{message}</p>
            {options?.description && (
              <p className="text-xs text-red-700 mt-0.5">
                {options.description}
              </p>
            )}
          </div>
          <button
            onClick={() => sonnerToast.dismiss(id)}
            className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
            aria-label="Dismiss notification"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      ),
      { duration: 5000 },
    );
  },

  loading: (message: string, options?: { description?: string }) => {
    return sonnerToast.custom(
      (id) => (
        <div className="toast-loading group flex items-start gap-3 w-full p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-lg shadow-blue-100/50">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-900">{message}</p>
            {options?.description && (
              <p className="text-xs text-blue-700 mt-0.5">
                {options.description}
              </p>
            )}
          </div>
          <button
            onClick={() => sonnerToast.dismiss(id)}
            className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
            aria-label="Dismiss notification"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      ),
      { duration: Infinity },
    );
  },

  warning: (message: string, options?: { description?: string }) => {
    return sonnerToast.custom(
      (id) => (
        <div className="toast-warning group flex items-start gap-3 w-full p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg shadow-lg shadow-amber-100/50">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">{message}</p>
            {options?.description && (
              <p className="text-xs text-amber-700 mt-0.5">
                {options.description}
              </p>
            )}
          </div>
          <button
            onClick={() => sonnerToast.dismiss(id)}
            className="flex-shrink-0 text-amber-400 hover:text-amber-600 transition-colors"
            aria-label="Dismiss notification"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      ),
      { duration: 4000 },
    );
  },

  info: (message: string, options?: { description?: string }) => {
    return sonnerToast.custom(
      (id) => (
        <div className="toast-info group flex items-start gap-3 w-full p-4 bg-gradient-to-r from-cyan-50 to-sky-50 border border-cyan-200 rounded-lg shadow-lg shadow-cyan-100/50">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center">
            <Info className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-cyan-900">{message}</p>
            {options?.description && (
              <p className="text-xs text-cyan-700 mt-0.5">
                {options.description}
              </p>
            )}
          </div>
          <button
            onClick={() => sonnerToast.dismiss(id)}
            className="flex-shrink-0 text-cyan-400 hover:text-cyan-600 transition-colors"
            aria-label="Dismiss notification"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      ),
      { duration: 3000 },
    );
  },

  dismiss: sonnerToast.dismiss,

  promise: sonnerToast.promise,
};

/**
 * Toaster component with responsive positioning.
 * - Desktop (>=768px): bottom-right
 * - Mobile (<768px): top-center
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={isMobile ? "top-center" : "bottom-right"}
      expand={true}
      richColors={false}
      closeButton={false}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "w-full max-w-sm",
        },
      }}
      style={
        {
          "--width": "360px",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
