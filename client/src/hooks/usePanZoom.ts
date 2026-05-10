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
     * Auto-fit + auto-centre on the OWNER, ensuring the surrounding bbox
     * (cards + placeholders) still fits in the viewport.
     *   - `ownerX`, `ownerY` (unscaled frame coords) land at the viewport
     *     centre, shifted by `offsetY` screen-px (e.g. 50 → owner ends
     *     up 50px below centre, leaving room for placeholders above).
     *   - `boxLeft/Top/Right/Bottom` describe the full content bbox.
     *     Scale is picked per-side so the farthest edge from the owner
     *     fits with `padding` px of breathing room, capped at 1× (never
     *     zoom in past natural size).
     * Used on first paint and when the canvas reshapes (person added /
     * removed).
     */
    fitAndCentreOnOwner: (
      ownerX: number,
      ownerY: number,
      boxLeft: number,
      boxTop: number,
      boxRight: number,
      boxBottom: number,
      padding = 40,
      offsetY = 0,
    ) => {
      const vp = viewportRef.current;
      if (!vp || !vp.clientWidth || !vp.clientHeight) return;
      // EFFECTIVE viewport size: vp's CSS box can be much taller than the
      // user's actual visible window (tree-stage has min-height: 75dvh +
      // flex-stretch). On those devices vp.clientHeight is e.g. 1585px
      // while window.innerHeight is ~900 — using clientHeight directly
      // dropped the owner into the middle of the off-screen lower half.
      // We use the intersection of the tree-stage rect with the screen
      // viewport so "vp centre" means "screen centre".
      const rect = vp.getBoundingClientRect();
      const winH = typeof window !== 'undefined' ? window.innerHeight : vp.clientHeight;
      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(winH, rect.bottom);
      const visibleH = Math.max(1, visibleBottom - visibleTop);
      // Centre of the visible band, expressed in tree-stage-local px
      // (i.e. relative to rect.top, which is where the frame's natural
      // top sits at translate=0).
      const visibleCY = (visibleTop + visibleBottom) / 2 - rect.top;
      const vpW = vp.clientWidth;

      // Picks the largest scale that lets the whole content bbox fit in
      // the VISIBLE band with `padding` px of breathing room on each
      // side. Capped at 1× (never zoom past natural size). Floored at
      // 0.45 so postage-stamp trees stay readable.
      const boxW = Math.max(1, boxRight - boxLeft);
      const boxH = Math.max(1, boxBottom - boxTop);
      const fitH = (visibleH - 2 * padding) / boxH;
      const fitW = (vpW - 2 * padding) / boxW;
      const AUTOFIT_MIN = 0.45;
      const newScale = Math.max(AUTOFIT_MIN, Math.min(MAX_SCALE, Math.min(fitH, fitW, 1)));
      scale.current = newScale;
      // Place the OWNER's frame-coord at (vp centre X, visibleCY +
      // offsetY). With offsetY < 0 the owner sits above the visible
      // centre — top of the tree gets more room.
      tx.current = vpW / 2 - ownerX * newScale;
      ty.current = visibleCY + offsetY - ownerY * newScale;
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
