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
  const drawTimerRef = useRef<ReturnType<typeof setTimeout>>();

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
        onScaleChange?.();
      }, 50);
      return;
    }
    scaleRef.current += diff * LERP;
    applyTransform();
    requestAnimationFrame(zoomLoop);
  }, [applyTransform, onScaleChange]);

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

  // Wheel handler for trackpad pinch & Ctrl+Wheel zoom
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Trackpad pinch on macOS sends wheel events with ctrlKey=true
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = 1 - e.deltaY * 0.004;
        targetScaleRef.current = clampScale(targetScaleRef.current * factor);
        startZoomAnim();
      }
    };

    // Safari gesturechange for native pinch-to-zoom
    const handleGestureChange = (e: any) => {
      e.preventDefault();
      targetScaleRef.current = clampScale(targetScaleRef.current * e.scale);
      // Reset gesture scale so it's always relative
      e.scale = 1;
      startZoomAnim();
    };

    const handleGestureStart = (e: Event) => {
      e.preventDefault();
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    viewport.addEventListener('gesturestart', handleGestureStart as EventListener, { passive: false });
    viewport.addEventListener('gesturechange', handleGestureChange as EventListener, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleWheel);
      viewport.removeEventListener('gesturestart', handleGestureStart as EventListener);
      viewport.removeEventListener('gesturechange', handleGestureChange as EventListener);
    };
  }, [viewportRef, clampScale, startZoomAnim]);

  return { zoomIn, zoomOut, zoomReset, getScale };
}
