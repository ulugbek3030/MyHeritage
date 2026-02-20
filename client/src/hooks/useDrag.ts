import { useRef, useEffect, useCallback } from 'react';

export function useDrag(
  viewportRef: React.RefObject<HTMLDivElement | null>,
  enabled = true
) {
  const isDragging = useRef(false);
  const dragMoved = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startScrollLeft = useRef(0);
  const startScrollTop = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    // ── Mouse drag (desktop) ──
    const handleMouseDown = (e: MouseEvent) => {
      // Only drag with left button, not on interactive elements
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, a, .popup-overlay')) return;

      e.preventDefault(); // Prevent native text/image drag
      isDragging.current = true;
      dragMoved.current = false;
      startX.current = e.pageX;
      startY.current = e.pageY;
      startScrollLeft.current = viewport.scrollLeft;
      startScrollTop.current = viewport.scrollTop;
      viewport.classList.add('dragging');
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const dx = e.pageX - startX.current;
      const dy = e.pageY - startY.current;
      // Only mark as moved if dragged more than 3px (prevents accidental flag on click)
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragMoved.current = true;
      }
      viewport.scrollLeft = startScrollLeft.current - dx;
      viewport.scrollTop = startScrollTop.current - dy;
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      viewport.classList.remove('dragging');
    };

    // ── Touch drag (mobile — one finger pan) ──
    // Skip drag if pinch-zoom is in progress (data-pinching set by useZoom)
    let touchDragging = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, a, .popup-overlay')) return;

      touchDragging = true;
      dragMoved.current = false;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      startScrollLeft.current = viewport.scrollLeft;
      startScrollTop.current = viewport.scrollTop;
    };

    const handleTouchMove = (e: TouchEvent) => {
      // If pinching (2 fingers) or not single-touch dragging, skip
      if (viewport.dataset.pinching || e.touches.length !== 1 || !touchDragging) return;

      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragMoved.current = true;
      }

      viewport.scrollLeft = startScrollLeft.current - dx;
      viewport.scrollTop = startScrollTop.current - dy;
    };

    const handleTouchEnd = () => {
      touchDragging = false;
    };

    viewport.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    viewport.addEventListener('touchstart', handleTouchStart, { passive: true });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: true });
    viewport.addEventListener('touchend', handleTouchEnd);

    return () => {
      viewport.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchmove', handleTouchMove);
      viewport.removeEventListener('touchend', handleTouchEnd);
    };
  }, [viewportRef, enabled]);

  /**
   * Returns true if the last mousedown-mouseup cycle included a drag.
   * Card click handler should check this to avoid opening popup after drag.
   */
  const wasDragged = useCallback(() => dragMoved.current, []);

  return { wasDragged };
}
