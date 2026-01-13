"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  Search,
  Home,
  Users,
  Package,
  ShoppingCart,
  Slash,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Keyboard shortcut definition interface
 */
export interface KeyboardShortcut {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Description of what the shortcut does */
  description: string;
  /** Keys to press (array for sequence like ['G', 'D']) */
  keys: string[];
  /** Handler function */
  handler: () => void;
  /** Icon component */
  icon?: React.ComponentType<{ className?: string }>;
  /** Category for grouping */
  category: "navigation" | "actions" | "search";
  /** Only available in specific theme */
  theme?: "super-admin" | "tenant-admin";
}

interface KeyboardShortcutsContextValue {
  /** Open the shortcuts help modal */
  openHelp: () => void;
  /** Close the shortcuts help modal */
  closeHelp: () => void;
  /** Whether help modal is open */
  isHelpOpen: boolean;
  /** Register a custom shortcut */
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  /** Unregister a custom shortcut */
  unregisterShortcut: (id: string) => void;
  /** Get all shortcuts for current theme */
  getShortcuts: () => KeyboardShortcut[];
  /** Detect if user is on Mac */
  isMac: boolean;
}

const KeyboardShortcutsContext =
  createContext<KeyboardShortcutsContextValue | null>(null);

export const useKeyboardShortcuts = () => {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error(
      "useKeyboardShortcuts must be used within KeyboardShortcutsProvider",
    );
  }
  return context;
};

interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
  /** Admin theme for context-aware shortcuts */
  theme: "super-admin" | "tenant-admin";
}

export function KeyboardShortcutsProvider({
  children,
  theme,
}: KeyboardShortcutsProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [customShortcuts, setCustomShortcuts] = useState<KeyboardShortcut[]>(
    [],
  );

  // Track sequence keys (for 'G then D' style shortcuts)
  const [sequenceKeys, setSequenceKeys] = useState<string[]>([]);
  const [sequenceTimeout, setSequenceTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );

  // Detect Mac on mount
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  // Focus search input helper
  const focusSearch = useCallback(() => {
    const searchInput = document.querySelector<HTMLInputElement>(
      'input[type="text"][placeholder*="Search"], input[type="search"]',
    );
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }, []);

  // Close any open modals/dialogs
  const closeModals = useCallback(() => {
    // Trigger ESC key on any open dialogs
    const openDialog = document.querySelector(
      '[role="dialog"][data-state="open"]',
    );
    if (openDialog) {
      const escEvent = new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        bubbles: true,
      });
      openDialog.dispatchEvent(escEvent);
    }
  }, []);

  // Built-in shortcuts
  const builtInShortcuts: KeyboardShortcut[] = [
    // Search
    {
      id: "focus-search",
      label: "Focus Search",
      description: "Jump to search input",
      keys: [isMac ? "⌘" : "Ctrl", "K"],
      handler: focusSearch,
      icon: Search,
      category: "search",
    },
    // Navigation - Dashboard
    {
      id: "go-dashboard",
      label: "Go to Dashboard",
      description: "Navigate to dashboard",
      keys: ["G", "D"],
      handler: () => {
        const basePath =
          theme === "super-admin" ? "/super-admin" : "/tenant-admin";
        router.push(basePath);
      },
      icon: Home,
      category: "navigation",
    },
    // Navigation - Tenants (Super Admin only)
    {
      id: "go-tenants",
      label: "Go to Tenants",
      description: "Navigate to tenants page",
      keys: ["G", "T"],
      handler: () => router.push("/super-admin/tenants"),
      icon: Users,
      category: "navigation",
      theme: "super-admin",
    },
    // Navigation - Products (Tenant Admin only)
    {
      id: "go-products",
      label: "Go to Products",
      description: "Navigate to products page",
      keys: ["G", "P"],
      handler: () => router.push("/tenant-admin/products"),
      icon: Package,
      category: "navigation",
      theme: "tenant-admin",
    },
    // Navigation - Orders
    {
      id: "go-orders",
      label: "Go to Orders",
      description: "Navigate to orders page",
      keys: ["G", "O"],
      handler: () => {
        const basePath =
          theme === "super-admin" ? "/super-admin" : "/tenant-admin";
        router.push(`${basePath}/orders`);
      },
      icon: ShoppingCart,
      category: "navigation",
    },
    // Actions - Close modal
    {
      id: "close-modal",
      label: "Close Modal",
      description: "Close any open dialog or modal",
      keys: ["Esc"],
      handler: closeModals,
      icon: Slash,
      category: "actions",
    },
    // Actions - Show help
    {
      id: "show-help",
      label: "Keyboard Shortcuts",
      description: "Show this help menu",
      keys: [isMac ? "⌘" : "Ctrl", "/"],
      handler: () => setIsHelpOpen(true),
      icon: Zap,
      category: "actions",
    },
  ];

  // Get all shortcuts for current theme
  const getShortcuts = useCallback(() => {
    return [...builtInShortcuts, ...customShortcuts].filter(
      (shortcut) => !shortcut.theme || shortcut.theme === theme,
    );
  }, [builtInShortcuts, customShortcuts, theme]);

  // Register custom shortcut
  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setCustomShortcuts((prev) => [
      ...prev.filter((s) => s.id !== shortcut.id),
      shortcut,
    ]);
  }, []);

  // Unregister custom shortcut
  const unregisterShortcut = useCallback((id: string) => {
    setCustomShortcuts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Helper to check if modifier key combo matches
      const isModifierCombo = (keys: string[]) => {
        if (keys.length !== 2) return false;
        const [modifier, key] = keys;
        const modifierPressed =
          (modifier === "⌘" || modifier === "Ctrl") && (e.metaKey || e.ctrlKey);
        const keyMatches = e.key.toLowerCase() === key.toLowerCase();
        return modifierPressed && keyMatches;
      };

      // Get all active shortcuts
      const shortcuts = getShortcuts();

      // Check for modifier-based shortcuts (Cmd+K, Cmd+/, etc.)
      for (const shortcut of shortcuts) {
        if (isModifierCombo(shortcut.keys)) {
          e.preventDefault();
          shortcut.handler();
          return;
        }
      }

      // Escape key - always works
      if (e.key === "Escape") {
        closeModals();
        setIsHelpOpen(false);
        return;
      }

      // Sequence shortcuts (G then D, etc.) - don't trigger in inputs
      if (!isInput) {
        const key = e.key.toUpperCase();

        // Clear sequence timeout
        if (sequenceTimeout) {
          clearTimeout(sequenceTimeout);
        }

        // Add key to sequence
        const newSequence = [...sequenceKeys, key];
        setSequenceKeys(newSequence);

        // Set timeout to reset sequence after 1 second
        const timeout = setTimeout(() => {
          setSequenceKeys([]);
        }, 1000);
        setSequenceTimeout(timeout);

        // Check if sequence matches any shortcut
        for (const shortcut of shortcuts) {
          if (
            shortcut.keys.length === 2 &&
            shortcut.keys[0].toUpperCase() === newSequence[0] &&
            shortcut.keys[1].toUpperCase() ===
              newSequence[newSequence.length - 1]
          ) {
            e.preventDefault();
            shortcut.handler();
            setSequenceKeys([]);
            clearTimeout(timeout);
            return;
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (sequenceTimeout) {
        clearTimeout(sequenceTimeout);
      }
    };
  }, [getShortcuts, sequenceKeys, sequenceTimeout, closeModals]);

  // Reset sequence on route change
  useEffect(() => {
    setSequenceKeys([]);
    if (sequenceTimeout) {
      clearTimeout(sequenceTimeout);
    }
  }, [pathname]);

  const value: KeyboardShortcutsContextValue = {
    openHelp: () => setIsHelpOpen(true),
    closeHelp: () => setIsHelpOpen(false),
    isHelpOpen,
    registerShortcut,
    unregisterShortcut,
    getShortcuts,
    isMac,
  };

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
      <KeyboardShortcutsHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        shortcuts={getShortcuts()}
        theme={theme}
        isMac={isMac}
      />
    </KeyboardShortcutsContext.Provider>
  );
}

/**
 * Keyboard shortcuts help modal component
 */
interface KeyboardShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
  theme: "super-admin" | "tenant-admin";
  isMac: boolean;
}

function KeyboardShortcutsHelpModal({
  isOpen,
  onClose,
  shortcuts,
  theme,
  isMac,
}: KeyboardShortcutsHelpModalProps) {
  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<string, KeyboardShortcut[]>,
  );

  const themeStyles = {
    "super-admin": {
      accent: "slate",
      gradient: "from-slate-900 via-slate-800 to-zinc-900",
      border: "border-slate-700",
      keyBg: "bg-slate-800/80",
      keyBorder: "border-slate-600",
      keyText: "text-slate-100",
      categoryBg: "bg-slate-800/40",
      iconBg: "bg-slate-700",
    },
    "tenant-admin": {
      accent: "cyan",
      gradient: "from-cyan-900 via-blue-900 to-indigo-900",
      border: "border-cyan-700",
      keyBg: "bg-cyan-800/80",
      keyBorder: "border-cyan-600",
      keyText: "text-cyan-100",
      categoryBg: "bg-cyan-800/40",
      iconBg: "bg-cyan-700",
    },
  };

  const styles = themeStyles[theme];

  const categoryLabels = {
    navigation: "Navigation",
    actions: "Actions",
    search: "Search",
  };

  const categoryIcons = {
    navigation: Home,
    actions: Zap,
    search: Search,
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "max-w-2xl p-0 overflow-hidden border-2",
          styles.border,
          "bg-gradient-to-br",
          styles.gradient,
        )}
      >
        {/* Command Interface Header */}
        <DialogHeader className="relative p-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={cn("p-2 rounded-lg", styles.iconBg, "shadow-inner")}
            >
              <Command className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-2xl font-bold text-white font-mono tracking-tight">
              COMMAND INTERFACE
            </DialogTitle>
          </div>
          <DialogDescription className="text-white/60 font-mono text-sm">
            System keyboard shortcuts • Press{" "}
            <kbd
              className={cn(
                "px-1.5 py-0.5 rounded text-xs font-mono",
                styles.keyBg,
                styles.keyText,
                "border",
                styles.keyBorder,
              )}
            >
              ESC
            </kbd>{" "}
            to close
          </DialogDescription>

          {/* Decorative scanline effect */}
          <div className="absolute inset-0 pointer-events-none opacity-5">
            <div
              className="absolute inset-0 bg-gradient-to-b from-transparent via-white to-transparent animate-pulse"
              style={{ animationDuration: "3s" }}
            />
          </div>
        </DialogHeader>

        {/* Shortcuts Grid */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {(["navigation", "search", "actions"] as const).map((category) => {
            const categoryShortcuts = groupedShortcuts[category];
            if (!categoryShortcuts || categoryShortcuts.length === 0)
              return null;

            const CategoryIcon = categoryIcons[category];

            return (
              <div key={category} className="space-y-3">
                {/* Category Header */}
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border",
                    styles.categoryBg,
                    styles.border,
                  )}
                >
                  <CategoryIcon
                    className="w-4 h-4 text-white/80"
                    aria-hidden="true"
                  />
                  <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider font-mono">
                    {categoryLabels[category]}
                  </h3>
                </div>

                {/* Shortcuts List */}
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg",
                        "bg-black/20 border border-white/10",
                        "hover:bg-black/30 hover:border-white/20",
                        "transition-all duration-200",
                        "group",
                      )}
                    >
                      {/* Left: Label and Description */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {shortcut.icon && (
                          <shortcut.icon
                            className="w-4 h-4 text-white/60 mt-0.5 flex-shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white/90 font-mono">
                            {shortcut.label}
                          </div>
                          <div className="text-xs text-white/50 mt-0.5">
                            {shortcut.description}
                          </div>
                        </div>
                      </div>

                      {/* Right: Keys */}
                      <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                        {shortcut.keys.map((key, idx) => (
                          <React.Fragment key={idx}>
                            <kbd
                              className={cn(
                                "px-2.5 py-1.5 rounded-md text-xs font-bold font-mono",
                                "border shadow-sm",
                                styles.keyBg,
                                styles.keyBorder,
                                styles.keyText,
                                "group-hover:scale-105 transition-transform duration-200",
                                "min-w-[2rem] text-center",
                              )}
                            >
                              {key}
                            </kbd>
                            {idx < shortcut.keys.length - 1 && (
                              <span className="text-white/40 text-xs font-mono mx-0.5">
                                {shortcut.keys.length === 2 &&
                                idx === 0 &&
                                key !== "⌘" &&
                                key !== "Ctrl"
                                  ? "then"
                                  : "+"}
                              </span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={cn("px-6 py-4 border-t", styles.border, "bg-black/20")}>
          <p className="text-xs text-white/50 font-mono text-center">
            {isMac ? "⌘ Command" : "Ctrl"} key • Platform:{" "}
            {isMac ? "macOS" : "Windows/Linux"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Keyboard hint component for displaying shortcut hints in menus
 */
interface KeyboardHintProps {
  keys: string[];
  theme?: "super-admin" | "tenant-admin";
  className?: string;
}

export function KeyboardHint({
  keys,
  theme = "tenant-admin",
  className,
}: KeyboardHintProps) {
  const themeStyles = {
    "super-admin": {
      bg: "bg-slate-700/50",
      border: "border-slate-500/50",
      text: "text-slate-300",
    },
    "tenant-admin": {
      bg: "bg-cyan-700/30",
      border: "border-cyan-500/30",
      text: "text-cyan-200",
    },
  };

  const styles = themeStyles[theme];

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {keys.map((key, idx) => (
        <React.Fragment key={idx}>
          <kbd
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono",
              "border shadow-sm",
              styles.bg,
              styles.border,
              styles.text,
              "min-w-[1.25rem] text-center",
            )}
          >
            {key}
          </kbd>
          {idx < keys.length - 1 && key !== "⌘" && key !== "Ctrl" && (
            <span className={cn("text-[10px] font-mono mx-0.5", styles.text)}>
              {keys.length === 2 ? "" : "+"}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
