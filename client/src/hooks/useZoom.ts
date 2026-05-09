import { useEffect, useRef } from 'react';

const LERP = 0.15, SETTLE = 0.0005, MAX_SCALE = 1.8, MIN_SCALE = 0.2;

export const useZoom = (containerRef: React.RefObject<HTMLElement>, onScale?: (s: number) => void) => {
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
      el.style.transformOrigin = 'top left';
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

    let pinchStartDist = 0, pinchStartScale = 1;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        el.dataset.pinching = '1';
        pinchStartDist = dist(e.touches);
        pinchStartScale = target.current;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDist) {
        e.preventDefault();
        target.current = clamp(pinchStartScale * (dist(e.touches) / pinchStartDist));
        start();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) { delete el.dataset.pinching; pinchStartDist = 0; }
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

  return {
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
        el.style.transformOrigin = 'top left';
      }
      onScaleRef.current?.(clamped);
    },
  };
};
