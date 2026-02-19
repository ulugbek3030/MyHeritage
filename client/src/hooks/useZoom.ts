import { useRef, useCallback, useEffect } from 'react';

const MAX_SCALE = 1.8;
const LERP = 0.15;
const SETTLE = 0.0005;

export function useZoom(
  containerRef: React.RefObject<HTMLDivElement | null>,
  viewportRef: React.RefObject<HTMLDivElement | null>,
  onScaleChange?: () => void
) {
  const scaleRef = useRef(1);
  const targetScaleRef = useRef(1);
  const animatingRef = useRef(false);
  const drawTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Store onScaleChange in a ref so the wheel handler never goes stale
  const onScaleChangeRef = useRef(onScaleChange);
  onScaleChangeRef.current = onScaleChange;

  /** Dynamic min scale: fit entire tree into viewport (no smaller) */
  const getMinScale = useCallback(() => {
    const viewport = viewportRef.current;
    const container = containerRef.current;
    if (!viewport || !container) return 0.5;
    const fitW = viewport.clientWidth / container.scrollWidth;
    const fitH = viewport.clientHeight / container.scrollHeight;
    return Math.min(fitW, fitH);
  }, [viewportRef, containerRef]);

  const clampScale = useCallback((v: number) => {
    return Math.min(MAX_SCALE, Math.max(getMinScale(), v));
  }, [getMinScale]);

  const applyTransform = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.style.transform = `scale(${scaleRef.current})`;
    }
  }, [containerRef]);

  const zoomLoop = useCallback(() => {
    const diff = targetScaleRef.current - scaleRef.current;
    if (Math.abs(diff) < SETTLE) {
      scaleRef.current = targetScaleRef.current;
      applyTransform();
      animatingRef.current = false;
      clearTimeout(drawTimerRef.current);
      drawTimerRef.current = setTimeout(() => {
        onScaleChangeRef.current?.();
      }, 50);
      return;
    }
    scaleRef.current += diff * LERP;
    applyTransform();
    requestAnimationFrame(zoomLoop);
  }, [applyTransform]);

  const startZoomAnim = useCallback(() => {
    if (!animatingRef.current) {
      animatingRef.current = true;
      requestAnimationFrame(zoomLoop);
    }
  }, [zoomLoop]);

  const zoomIn = useCallback(() => {
    targetScaleRef.current = clampScale(targetScaleRef.current + 0.15);
    startZoomAnim();
  }, [clampScale, startZoomAnim]);

  const zoomOut = useCallback(() => {
    targetScaleRef.current = clampScale(targetScaleRef.current - 0.15);
    startZoomAnim();
  }, [clampScale, startZoomAnim]);

  const zoomReset = useCallback(() => {
    targetScaleRef.current = 1;
    startZoomAnim();
  }, [startZoomAnim]);

  const getScale = useCallback(() => scaleRef.current, []);

  // ═══════════════════════════════════════════════════════════════
  // UNIVERSAL ZOOM — wheel + gesture + touch pinch
  // ---------------------------------------------------------------
  // Supports ALL platforms:
  //   1. Desktop trackpad pinch: Ctrl+Wheel (Chrome/Firefox/Edge)
  //   2. macOS Safari trackpad: gesturestart/gesturechange
  //   3. Mobile iOS/Android: touchstart/touchmove/touchend (2 fingers)
  //
  // CRITICAL FIX: This effect MUST have empty deps [] so that
  // event listeners are attached ONCE and NEVER re-created.
  // All logic uses refs and DOM elements (stable references).
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const viewport = viewportRef.current;
    const container = containerRef.current;
    if (!viewport || !container) return;

    // Inline clamp — reads fresh dimensions from DOM every call
    function clamp(v: number): number {
      const vw = viewport!.clientWidth;
      const vh = viewport!.clientHeight;
      const sw = container!.scrollWidth;
      const sh = container!.scrollHeight;
      const minScale = Math.min(vw / sw, vh / sh);
      return Math.min(MAX_SCALE, Math.max(minScale, v));
    }

    function applyScale() {
      container!.style.transform = `scale(${scaleRef.current})`;
    }

    function loop() {
      const diff = targetScaleRef.current - scaleRef.current;
      if (Math.abs(diff) < SETTLE) {
        scaleRef.current = targetScaleRef.current;
        applyScale();
        animatingRef.current = false;
        clearTimeout(drawTimerRef.current);
        drawTimerRef.current = setTimeout(() => {
          onScaleChangeRef.current?.();
        }, 50);
        return;
      }
      scaleRef.current += diff * LERP;
      applyScale();
      requestAnimationFrame(loop);
    }

    function startAnim() {
      if (!animatingRef.current) {
        animatingRef.current = true;
        requestAnimationFrame(loop);
      }
    }

    // ── 1. Desktop: Trackpad pinch (Ctrl+Wheel) and mouse Ctrl+Wheel ──
    function handleWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const factor = 1 - e.deltaY * 0.004;
        targetScaleRef.current = clamp(targetScaleRef.current * factor);
        startAnim();
      }
    }

    // ── 2. macOS Safari: native gesture events ──
    function handleGestureChange(e: any) {
      e.preventDefault();
      e.stopPropagation();
      targetScaleRef.current = clamp(targetScaleRef.current * e.scale);
      e.scale = 1; // reset so it's always relative
      startAnim();
    }

    function handleGestureStart(e: Event) {
      e.preventDefault();
    }

    // ── 3. Mobile (iOS / Android): touch pinch-to-zoom ──
    // When 2 fingers are down, compute distance between them
    // and zoom proportionally. Sets data-pinching on viewport
    // so useDrag knows to ignore touch-drag during pinch.
    let initialPinchDist = 0;
    let pinchScaleBase = 1;

    function getTouchDist(t1: Touch, t2: Touch): number {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        initialPinchDist = getTouchDist(e.touches[0], e.touches[1]);
        pinchScaleBase = targetScaleRef.current;
        viewport!.dataset.pinching = '1';
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && initialPinchDist > 0) {
        e.preventDefault();
        const currentDist = getTouchDist(e.touches[0], e.touches[1]);
        const ratio = currentDist / initialPinchDist;
        targetScaleRef.current = clamp(pinchScaleBase * ratio);
        startAnim();
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        initialPinchDist = 0;
        delete viewport!.dataset.pinching;
      }
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    viewport.addEventListener('gesturestart', handleGestureStart as EventListener, { passive: false });
    viewport.addEventListener('gesturechange', handleGestureChange as EventListener, { passive: false });
    viewport.addEventListener('touchstart', handleTouchStart, { passive: false });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', handleTouchEnd);

    return () => {
      viewport.removeEventListener('wheel', handleWheel);
      viewport.removeEventListener('gesturestart', handleGestureStart as EventListener);
      viewport.removeEventListener('gesturechange', handleGestureChange as EventListener);
      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchmove', handleTouchMove);
      viewport.removeEventListener('touchend', handleTouchEnd);
    };
    // INTENTIONALLY empty deps — handlers use only refs and DOM elements.
    // This ensures listeners are attached ONCE and never re-created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { zoomIn, zoomOut, zoomReset, getScale };
}
