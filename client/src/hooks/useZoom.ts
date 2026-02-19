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
  // TRACKPAD ZOOM — wheel + gesture handlers
  // ---------------------------------------------------------------
  // CRITICAL FIX: This effect MUST have empty deps [] so that
  // event listeners are attached ONCE and NEVER re-created.
  // Previous bug: deps included [clampScale, startZoomAnim] which
  // are useCallback refs that change on every render, causing
  // listeners to be removed and re-added constantly, which breaks
  // trackpad pinch-to-zoom on macOS.
  //
  // Solution: define clamp/anim logic inline using only refs and
  // DOM elements (which are stable). onScaleChange is stored in
  // onScaleChangeRef so the handler always reads the latest value.
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

    // Trackpad pinch on macOS Chrome/Firefox sends wheel events with ctrlKey=true
    // Mouse Ctrl+Wheel also triggers this
    function handleWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const factor = 1 - e.deltaY * 0.004;
        targetScaleRef.current = clamp(targetScaleRef.current * factor);
        startAnim();
      }
    }

    // Safari gesturechange for native pinch-to-zoom (macOS Safari)
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

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    viewport.addEventListener('gesturestart', handleGestureStart as EventListener, { passive: false });
    viewport.addEventListener('gesturechange', handleGestureChange as EventListener, { passive: false });

    return () => {
      viewport.removeEventListener('wheel', handleWheel);
      viewport.removeEventListener('gesturestart', handleGestureStart as EventListener);
      viewport.removeEventListener('gesturechange', handleGestureChange as EventListener);
    };
    // INTENTIONALLY empty deps — handlers use only refs and DOM elements.
    // This ensures listeners are attached ONCE and never re-created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { zoomIn, zoomOut, zoomReset, getScale };
}
