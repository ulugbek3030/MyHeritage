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

    viewport.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      viewport.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [viewportRef, enabled]);

  /**
   * Returns true if the last mousedown-mouseup cycle included a drag.
   * Card click handler should check this to avoid opening popup after drag.
   */
  const wasDragged = useCallback(() => dragMoved.current, []);

  return { wasDragged };
}
