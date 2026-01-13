"use client";

import { useEffect, useRef, useState } from 'react';
import { Cookie, Settings, Shield } from 'lucide-react';
import {
  getConsentModel,
  getRegionBannerText,
  getDefaultCategories,
  CONSENT_COOKIE_NAME,
  CONSENT_CATEGORIES_COOKIE_NAME,
  stringifyConsentCategories,
  parseConsentCategories,
  type ConsentCategories,
  type ConsentModel,
} from "@/lib/cookie-utils";

interface CookieConsentProps {
  tenant: {
    id: string;
    businessName: string;
    countryCode: string;
    settings?: any;
  };
}

export function CookieConsent({ tenant }: CookieConsentProps) {
    const [showCustomize, setShowCustomize] = useState(false);
    const [showBanner, setShowBanner] = useState(false);
    const [categories, setCategories] = useState<ConsentCategories | null>(null);
    const [mounted, setMounted] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const firstCheckboxRef = useRef<HTMLInputElement>(null);

  const consentModel = getConsentModel(tenant.countryCode);
  const bannerText = getRegionBannerText(tenant.countryCode);

  // Check if cookie consent is enabled for tenant
  const settings = tenant.settings as Record<string, any> | null;
  const isEnabled = settings?.cookieConsentEnabled !== false;
  const customMessage = settings?.cookieBannerMessage;

    useEffect(() => {
        setMounted(true);
        const model = getConsentModel(tenant.countryCode);
        // Check if consent has already been given
        const existingConsent = getCookieValue(CONSENT_COOKIE_NAME);
        const existingCategories = getCookieValue(CONSENT_CATEGORIES_COOKIE_NAME);
        const parsed = parseConsentCategories(existingCategories);

        setCategories(parsed || getDefaultCategories(model));

        // Only show banner if consent hasn't been given yet
        if (!existingConsent || existingConsent !== 'true') {
            setShowBanner(true);
        }
    }, []);

    useEffect(() => {
        if (showCustomize) {
            firstCheckboxRef.current?.focus();
        }
    }, [showCustomize]);

  if (!mounted || !isEnabled) return null;

  const handleAccept = () => {
    // Accept all categories
    const allAccepted: ConsentCategories = {
      essential: true,
      analytics: true,
      marketing: true,
      preferences: true,
    };
    saveCategories(allAccepted);
    saveConsent();
    setCategories(allAccepted);
    setShowCustomize(false);
    setShowBanner(false);
  };

  const handleDecline = () => {
    // Only essential cookies
    const essentialOnly: ConsentCategories = {
      essential: true,
      analytics: false,
      marketing: false,
      preferences: false,
    };
    saveCategories(essentialOnly);
    saveConsent();
    setCategories(essentialOnly);
    setShowCustomize(false);
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    if (categories) {
      saveCategories(categories);
      saveConsent();
    }
    setShowCustomize(false);
    setShowBanner(false);
  };

    const saveCategories = (cats: ConsentCategories) => {
        const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${CONSENT_CATEGORIES_COOKIE_NAME}=${stringifyConsentCategories(cats)}; path=/; max-age=31536000; SameSite=Lax${secureFlag}`;
    };

    const saveConsent = () => {
        const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${CONSENT_COOKIE_NAME}=true; path=/; max-age=31536000; SameSite=Lax${secureFlag}`;
    };

    const handleModalKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape') {
            setShowCustomize(false);
            return;
        }

        if (event.key !== 'Tab') return;

        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    if (showCustomize) {
        return (
            <div
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cookie-modal-title"
                onKeyDown={handleModalKeyDown}
                onClick={(event) => {
                    if (event.target === event.currentTarget) {
                        setShowCustomize(false);
                    }
                }}
            >
                <div ref={modalRef} className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Settings className="w-6 h-6 text-emerald-600" />
                        <h3 id="cookie-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">Cookie Preferences</h3>
                    </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Customize which cookies you allow. Essential cookies are always
            enabled as they're required for the site to function.
          </p>

          <div className="space-y-4">
            {/* Essential - Always on */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Essential
                </p>
                <p className="text-xs text-gray-500">
                  Required for site functionality
                </p>
              </div>
              <div className="text-emerald-600 text-sm font-medium">
                Always On
              </div>
            </div>

                        {/* Analytics */}
                        <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer">
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">Analytics</p>
                                <p className="text-xs text-gray-500">Help us improve our service</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={categories?.analytics ?? false}
                                onChange={(e) => setCategories(prev => prev ? { ...prev, analytics: e.target.checked } : null)}
                                className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                                ref={firstCheckboxRef}
                            />
                        </label>

            {/* Marketing */}
            <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Marketing
                </p>
                <p className="text-xs text-gray-500">
                  Personalized ads and offers
                </p>
              </div>
              <input
                type="checkbox"
                checked={categories?.marketing ?? false}
                onChange={(e) =>
                  setCategories((prev) =>
                    prev ? { ...prev, marketing: e.target.checked } : null,
                  )
                }
                className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
              />
            </label>

            {/* Preferences */}
            <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Preferences
                </p>
                <p className="text-xs text-gray-500">Remember your settings</p>
              </div>
              <input
                type="checkbox"
                checked={categories?.preferences ?? false}
                onChange={(e) =>
                  setCategories((prev) =>
                    prev ? { ...prev, preferences: e.target.checked } : null,
                  )
                }
                className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
              />
            </label>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowCustomize(false)}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePreferences}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!showBanner) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] flex items-center justify-between gap-4 p-4 sm:px-6"
      style={{
        background: "linear-gradient(to right, #065f46, #047857)",
        boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.15)",
      }}
    >
      <div className="flex items-start gap-3 flex-1">
        <Cookie className="w-5 h-5 text-emerald-200 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <span className="text-white">
            {customMessage || bannerText.message}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCustomize(true);
            }}
            className="ml-2 text-emerald-200 underline hover:text-white transition-colors"
          >
            {bannerText.customizeLabel}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {consentModel === "opt-in" && (
          <button
            onClick={handleDecline}
            className="px-5 py-2.5 text-sm font-medium text-white bg-transparent border border-white/50 rounded-lg hover:bg-white/10 transition-colors"
          >
            {bannerText.declineLabel}
          </button>
        )}
        <button
          onClick={handleAccept}
          className="px-6 py-2.5 text-sm font-semibold text-emerald-800 bg-white rounded-lg hover:bg-gray-100 transition-colors"
        >
          {bannerText.acceptLabel}
        </button>
      </div>
    </div>
  );
}

// Helper to get cookie value
function getCookieValue(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : undefined;
}

/**
 * Hook to check if a cookie category is allowed
 */
export function useCookieConsent() {
  const [categories, setCategories] = useState<ConsentCategories | null>(null);

  useEffect(() => {
    const cookieValue = getCookieValue(CONSENT_CATEGORIES_COOKIE_NAME);
    const parsed = parseConsentCategories(cookieValue);
    setCategories(parsed);
  }, []);

  return {
    isAnalyticsAllowed: categories?.analytics ?? false,
    isMarketingAllowed: categories?.marketing ?? false,
    isPreferencesAllowed: categories?.preferences ?? false,
    categories,
  };
}

export default CookieConsent;
