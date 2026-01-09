'use client';

import { cn } from '@/lib/utils';

/**
 * SkipToContent Component
 *
 * Provides keyboard users with a shortcut to skip navigation and jump
 * directly to the main content area. Visually hidden until focused.
 *
 * @param theme - 'super-admin' (slate) or 'tenant-admin' (cyan)
 * @param targetId - ID of the main content element to focus (default: 'main-content')
 */

export interface SkipToContentProps {
  theme?: 'super-admin' | 'tenant-admin';
  targetId?: string;
}

export function SkipToContent({
  theme = 'tenant-admin',
  targetId = 'main-content',
}: SkipToContentProps) {
  const themeStyles = {
    'super-admin': {
      bg: 'bg-slate-900',
      text: 'text-white',
      ring: 'focus:ring-slate-400',
      shadow: 'shadow-slate-500/50',
    },
    'tenant-admin': {
      bg: 'bg-cyan-600',
      text: 'text-white',
      ring: 'focus:ring-cyan-400',
      shadow: 'shadow-cyan-500/50',
    },
  };

  const styles = themeStyles[theme];

  const handleSkip = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleSkip}
      className={cn(
        // Positioning - fixed at top, initially off-screen
        'fixed top-4 left-4 z-[100]',
        // Transform off-screen by default
        '-translate-y-full',
        // Slide down with dramatic animation on focus
        'focus:translate-y-0 focus:animate-skip-link-slide',
        // Styling
        styles.bg,
        styles.text,
        'px-6 py-3 rounded-lg font-semibold text-sm',
        // Focus ring with offset
        'focus:outline-none focus:ring-2',
        styles.ring,
        'focus:ring-offset-2 focus:ring-offset-white',
        // Shadow and depth
        'shadow-lg',
        styles.shadow,
        // Smooth transitions
        'transition-all duration-200 ease-out',
        // Prevent text selection
        'select-none',
        // Cursor
        'cursor-pointer'
      )}
      aria-label={`Skip to ${targetId.replace('-', ' ')}`}
    >
      <span className="flex items-center gap-2">
        <svg
          className="w-4 h-4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
        Skip to main content
      </span>
    </a>
  );
}
