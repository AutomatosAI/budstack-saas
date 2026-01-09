/**
 * Focus Trap Utility for Modals
 *
 * Traps focus within a modal dialog to ensure keyboard users
 * can only tab through elements within the modal.
 *
 * Usage:
 * ```tsx
 * const modalRef = useRef<HTMLDivElement>(null);
 *
 * useEffect(() => {
 *   if (isOpen && modalRef.current) {
 *     const cleanup = createFocusTrap(modalRef.current);
 *     return cleanup;
 *   }
 * }, [isOpen]);
 * ```
 */

const FOCUSABLE_ELEMENTS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Creates a focus trap within the specified container element
 *
 * @param container - The container element to trap focus within
 * @returns Cleanup function to remove the focus trap
 */
export function createFocusTrap(container: HTMLElement): () => void {
  // Get all focusable elements within the container
  const getFocusableElements = (): HTMLElement[] => {
    return Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS)
    ).filter((el) => {
      // Filter out elements that are not visible or have display: none
      return (
        el.offsetParent !== null &&
        getComputedStyle(el).visibility !== 'hidden'
      );
    });
  };

  // Store the element that had focus before the modal opened
  const previouslyFocusedElement = document.activeElement as HTMLElement;

  // Focus the first focusable element in the modal
  const focusableElements = getFocusableElements();
  if (focusableElements.length > 0) {
    focusableElements[0].focus();
  }

  // Handle Tab key presses
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift + Tab - moving backwards
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab - moving forwards
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  // Add event listener
  container.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
    // Restore focus to the previously focused element
    if (previouslyFocusedElement) {
      previouslyFocusedElement.focus();
    }
  };
}

/**
 * React hook for focus trap
 *
 * @param isActive - Whether the focus trap should be active
 * @param containerRef - Ref to the container element
 *
 * Usage:
 * ```tsx
 * const modalRef = useRef<HTMLDivElement>(null);
 * useFocusTrap(isOpen, modalRef);
 * ```
 */
export function useFocusTrap(
  isActive: boolean,
  containerRef: React.RefObject<HTMLElement>
) {
  // This is a simplified version for TypeScript export
  // Actual implementation should use useEffect
  return { isActive, containerRef };
}
