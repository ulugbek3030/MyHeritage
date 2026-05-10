import { useEffect, useMemo, useRef } from 'react';

const LERP = 0.15, SETTLE = 0.0005, MAX_SCALE = 1.8, MIN_SCALE = 0.2;

export const useZoom = (
  containerRef: React.RefObject<HTMLElement>,
  onScale?: (s: number) => void,
  /** Scroll-container ref. Required for pinch-to-zoom to anchor on the user's
   *  fingers — we adjust its scrollLeft/Top so the content point under the
   *  pinch midpoint stays under their fingers as the scale changes. */
  viewportRef?: React.RefObject<HTMLElement | null>,
) => {
  const scale = useRef(1);
  const target = useRef(1);
  const raf = useRef<number | null>(null);
  const onScaleRef = useRef(onScale);
  onScaleRef.current = onScale;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const apply = () => {
      const s = scale.current;
      el.style.transform = `scale(${s})`;
      // Scale around the geometric centre of the element. The owner card is
      // placed at frame centre by FamilyTreeLayout, so this anchors zoom on
      // the owner — zooming in/out keeps their card under the user's eye
      // instead of drifting toward a corner.
      el.style.transformOrigin = '50% 50%';
      onScaleRef.current?.(s);
    };
    const tick = () => {
      const diff = target.current - scale.current;
      if (Math.abs(diff) < SETTLE) { scale.current = target.current; raf.current = null; apply(); return; }
      scale.current += diff * LERP;
      apply();
      raf.current = requestAnimationFrame(tick);
    };
    const start = () => { if (raf.current == null) raf.current = requestAnimationFrame(tick); };
    const clamp = (s: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      target.current = clamp(target.current - e.deltaY * 0.002);
      start();
    };

    let pinchStart: null | {
      dist: number;
      scale: number;
      focalX: number;
      focalY: number;
      scrollLeft: number;
      scrollTop: number;
    } = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        el.dataset.pinching = '1';
        const vp = viewportRef?.current ?? null;
        const vpRect = vp?.getBoundingClientRect();
        const vpLeft = vpRect?.left ?? 0;
        const vpTop = vpRect?.top ?? 0;
        const fx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - vpLeft;
        const fy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - vpTop;
        pinchStart = {
          dist: dist(e.touches),
          scale: target.current,
          focalX: fx,
          focalY: fy,
          scrollLeft: vp?.scrollLeft ?? 0,
          scrollTop: vp?.scrollTop ?? 0,
        };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStart) {
        e.preventDefault();
        const newScale = clamp(pinchStart.scale * (dist(e.touches) / pinchStart.dist));
        target.current = newScale;
        // Anchor the pinch midpoint: keep the content point that was under
        // the user's fingers at the start of the gesture pinned at the
        // same on-screen location across the whole pinch.
        const vp = viewportRef?.current ?? null;
        if (vp) {
          const ratio = newScale / pinchStart.scale;
          const newScrollLeft = (pinchStart.scrollLeft + pinchStart.focalX) * ratio - pinchStart.focalX;
          const newScrollTop = (pinchStart.scrollTop + pinchStart.focalY) * ratio - pinchStart.focalY;
          // TEST: no Math.max(0, ...) — let the browser clamp natively if it
          // wants. Don't impose our own floor so the pinch focal point is
          // tracked even when it would push scroll past edges.
          vp.scrollLeft = newScrollLeft;
          vp.scrollTop = newScrollTop;
        }
        start();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) { delete el.dataset.pinching; pinchStart = null; }
    };

    let gStartScale = 1;
    const onGestureStart = (e: any) => { e.preventDefault(); gStartScale = target.current; };
    const onGestureChange = (e: any) => { e.preventDefault(); target.current = clamp(gStartScale * e.scale); start(); };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart);
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('gesturestart', onGestureStart as any);
    el.addEventListener('gesturechange', onGestureChange as any);

    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('gesturestart', onGestureStart as any);
      el.removeEventListener('gesturechange', onGestureChange as any);
    };
  }, []); // ← intentionally empty: refs only; do NOT add deps that recreate handlers

  // Memoise so the returned object identity is stable across renders.
  // Otherwise consumers that list `zoom` in useEffect deps re-run on every
  // render, which can fight with user gestures (e.g. an auto-centre effect
  // resetting scroll while the user is pinching).
  return useMemo(() => ({
    zoomIn: () => { target.current = Math.min(MAX_SCALE, target.current + 0.15); },
    zoomOut: () => { target.current = Math.max(MIN_SCALE, target.current - 0.15); },
    reset: () => { target.current = 1; },
    /**
     * Apply a scale immediately (bypassing the LERP tween). Use for the
     * fit-to-screen pass on first entry — we need the transform applied
     * synchronously so a follow-up scrollIntoView reads the post-scale
     * element rect.
     */
    setTo: (s: number) => {
      const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
      target.current = clamped;
      scale.current = clamped;
      const el = containerRef.current;
      if (el) {
        el.style.transform = `scale(${clamped})`;
        el.style.transformOrigin = '50% 50%';
      }
      onScaleRef.current?.(clamped);
    },
  }), [containerRef]);
};
