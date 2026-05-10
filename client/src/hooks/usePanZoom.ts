import { useEffect, useMemo, useRef } from 'react';

/**
 * Transform-based pan + zoom for an "infinite canvas" feel — no scroll
 * container required, no clamping at frame edges. Drag in any direction
 * works regardless of zoom level; pinch zoom anchors on the finger
 * midpoint so the content under the user's fingers stays fixed.
 *
 *   tx, ty = pixel offset added to every point in the panned element
 *   s      = uniform scale applied around the element's top-left
 *
 *   point_on_screen = point_in_frame * s + (tx, ty) + vpRect.{left,top}
 *
 * `frameRef` is the element that gets `transform: translate(...) scale(...)`.
 * `viewportRef` is the outer container that captures touch / mouse events
 * and against which finger positions are measured.
 *
 * The hook returns `{ centreOn(x, y) }` so callers can position a specific
 * frame-coord at the viewport centre on first paint or when the canvas
 * shape changes (someone added/removed).
 */
const MIN_SCALE = 0.2;
const MAX_SCALE = 1.8;

export const usePanZoom = (
  frameRef: React.RefObject<HTMLElement | null>,
  viewportRef: React.RefObject<HTMLElement | null>,
) => {
  const tx = useRef(0);
  const ty = useRef(0);
  const scale = useRef(1);

  const apply = () => {
    const fr = frameRef.current;
    if (!fr) return;
    fr.style.transform = `translate(${tx.current}px, ${ty.current}px) scale(${scale.current})`;
    fr.style.transformOrigin = '0 0';
  };

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    let dragging = false;
    let dragStartFx = 0, dragStartFy = 0;
    let dragStartTx = 0, dragStartTy = 0;

    type Pinch = {
      startDist: number;
      startScale: number;
      // Content-coord under the finger midpoint (frame-local px BEFORE scale).
      contentX: number;
      contentY: number;
      // Finger midpoint in viewport-local px. Stays the anchor — that point
      // in the frame stays under the fingers throughout the pinch.
      fx: number;
      fy: number;
    };
    let pinch: Pinch | null = null;

    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) => ({
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2,
    });

    const clamp = (s: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        dragging = false;
        const m = mid(e.touches);
        const vpRect = vp.getBoundingClientRect();
        const fx = m.x - vpRect.left;
        const fy = m.y - vpRect.top;
        pinch = {
          startDist: dist(e.touches),
          startScale: scale.current,
          contentX: (fx - tx.current) / scale.current,
          contentY: (fy - ty.current) / scale.current,
          fx,
          fy,
        };
      } else if (e.touches.length === 1 && !pinch) {
        // Skip drag-start when the touch lands on a button/link — users
        // expect a tap on those to do its thing without panning.
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag && ['BUTTON', 'A', 'INPUT', 'SELECT'].includes(tag)) return;
        dragging = true;
        dragStartFx = e.touches[0].clientX;
        dragStartFy = e.touches[0].clientY;
        dragStartTx = tx.current;
        dragStartTy = ty.current;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinch) {
        // preventDefault so iOS doesn't run a competing native pinch — even
        // with touch-action CSS the listener has to be non-passive for this
        // to take effect.
        e.preventDefault();
        const newScale = clamp(pinch.startScale * (dist(e.touches) / pinch.startDist));
        scale.current = newScale;
        // Anchor the finger midpoint: the content-coord that was under the
        // fingers at pinch-start must stay there on every move.
        tx.current = pinch.fx - pinch.contentX * newScale;
        ty.current = pinch.fy - pinch.contentY * newScale;
        apply();
      } else if (e.touches.length === 1 && dragging) {
        e.preventDefault();
        tx.current = dragStartTx + (e.touches[0].clientX - dragStartFx);
        ty.current = dragStartTy + (e.touches[0].clientY - dragStartFy);
        apply();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
      if (e.touches.length === 0) dragging = false;
    };

    // Mouse / desktop fallback. Window-level move/up so a drag started in
    // the canvas keeps tracking even when the cursor leaves the element.
    const onMouseDown = (e: MouseEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag && ['BUTTON', 'A', 'INPUT', 'SELECT'].includes(tag)) return;
      dragging = true;
      dragStartFx = e.clientX;
      dragStartFy = e.clientY;
      dragStartTx = tx.current;
      dragStartTy = ty.current;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      tx.current = dragStartTx + (e.clientX - dragStartFx);
      ty.current = dragStartTy + (e.clientY - dragStartFy);
      apply();
    };
    const onMouseUp = () => { dragging = false; };

    // Desktop wheel zoom (cmd/ctrl + scroll).
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const vpRect = vp.getBoundingClientRect();
      const fx = e.clientX - vpRect.left;
      const fy = e.clientY - vpRect.top;
      const cx = (fx - tx.current) / scale.current;
      const cy = (fy - ty.current) / scale.current;
      const newScale = clamp(scale.current - e.deltaY * 0.002);
      scale.current = newScale;
      tx.current = fx - cx * newScale;
      ty.current = fy - cy * newScale;
      apply();
    };

    vp.addEventListener('touchstart', onTouchStart, { passive: true });
    vp.addEventListener('touchmove', onTouchMove, { passive: false });
    vp.addEventListener('touchend', onTouchEnd, { passive: true });
    vp.addEventListener('touchcancel', onTouchEnd, { passive: true });
    vp.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    vp.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      vp.removeEventListener('touchstart', onTouchStart);
      vp.removeEventListener('touchmove', onTouchMove);
      vp.removeEventListener('touchend', onTouchEnd);
      vp.removeEventListener('touchcancel', onTouchEnd);
      vp.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      vp.removeEventListener('wheel', onWheel);
    };
  }, []); // refs only — handlers don't need to recreate

  // Memoise so callers depending on the returned object identity don't
  // re-run on every render.
  return useMemo(() => ({
    /**
     * Position the frame so `(x, y)` (in unscaled frame coords) lands at
     * the viewport's geometric centre. Used for first-paint auto-centre
     * and for re-centring when the canvas reshapes.
     */
    centreOn: (x: number, y: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const s = scale.current;
      tx.current = vp.clientWidth / 2 - x * s;
      ty.current = vp.clientHeight / 2 - y * s;
      apply();
    },
    /**
     * Auto-fit + auto-centre on a bounding box (in unscaled frame coords).
     *   - Picks a scale that fits the box in the viewport with `padding`
     *     px of breathing room on each side, capped at 1× (we never zoom
     *     IN past the natural size — large tree → smaller; small tree →
     *     stays at 1).
     *   - Translates the frame so the box centre lands at the viewport
     *     centre, optionally shifted by `offsetY` screen-px (so the user
     *     can land owner-card slightly below dead centre, leaving room
     *     above for the "Add father" placeholders).
     * Used on first paint and when the canvas reshapes (person added /
     * removed).
     */
    fitAndCentreOnBox: (
      x: number,
      y: number,
      width: number,
      height: number,
      padding = 40,
      offsetY = 0,
    ) => {
      const vp = viewportRef.current;
      if (!vp || !vp.clientWidth || !vp.clientHeight) return;
      const safeW = Math.max(1, width);
      const safeH = Math.max(1, height);
      const fit = Math.min(
        (vp.clientWidth - 2 * padding) / safeW,
        (vp.clientHeight - 2 * padding) / safeH,
        1,
      );
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fit));
      scale.current = newScale;
      const cx = x + width / 2;
      const cy = y + height / 2;
      tx.current = vp.clientWidth / 2 - cx * newScale;
      ty.current = vp.clientHeight / 2 + offsetY - cy * newScale;
      apply();
    },
    /** Reset zoom to 1 and re-apply the current translate. */
    resetZoom: () => {
      scale.current = 1;
      apply();
    },
    /** Read-only snapshot for diagnostics. */
    state: () => ({ tx: tx.current, ty: ty.current, scale: scale.current }),
  }), [viewportRef]);
};
