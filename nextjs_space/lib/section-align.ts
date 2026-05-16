export type TextAlign = 'left' | 'center' | 'right';

/** Resolve the user-facing textAlign config to a stable value. */
export function resolveTextAlign(value: unknown): TextAlign {
  if (value === 'left' || value === 'right') return value;
  return 'center';
}

/** Tailwind classes for the heading/subtitle wrapper block.
 *  - left:   block flush-left, text aligned left
 *  - center: block horizontally centered (legacy default), text centered
 *  - right:  block flush-right, text aligned right
 *  Pair with `max-w-*` on the same element to constrain block width.
 */
export function headerAlignClasses(align: unknown): string {
  switch (resolveTextAlign(align)) {
    case 'left':
      return 'text-left mr-auto';
    case 'right':
      return 'text-right ml-auto';
    case 'center':
    default:
      return 'text-center mx-auto';
  }
}

/** Tailwind text-align-only utility for when block centering is not desired. */
export function textAlignClass(align: unknown): string {
  switch (resolveTextAlign(align)) {
    case 'left':
      return 'text-left';
    case 'right':
      return 'text-right';
    case 'center':
    default:
      return 'text-center';
  }
}
