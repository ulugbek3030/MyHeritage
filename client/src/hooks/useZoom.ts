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
  //   2. macOS/iOS Safari: gesturestart/gesturechange
  //   3. Mobile Android + fallback: touchstart/touchmove/touchend
  //
  // iOS Safari SPECIFICS:
  //   - iOS Safari fires gesturestart/gesturechange for pinch, NOT
  //     regular touch events. So we handle BOTH gesture + touch.
  //   - Global document-level gesturestart preventDefault blocks
  //     native iOS page zoom before it starts.
  //   - viewport meta: user-scalable=no, maximum-scale=1
  //   - CSS: touch-action: none on .tree-viewport
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

    // Track whether gesture events fired (iOS Safari) to avoid
    // double-handling with touch events
    let gestureActive = false;

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

    // ── 2. Safari (macOS + iOS): gesture events ──
    // On iOS Safari, pinch fires gesturestart/gesturechange instead of
    // touch events. We handle it here and set gestureActive flag so
    // touch handlers don't double-process.
    function handleGestureStart(e: any) {
      e.preventDefault();
      gestureActive = true;
      viewport!.dataset.pinching = '1';
    }

    function handleGestureChange(e: any) {
      e.preventDefault();
      e.stopPropagation();
      targetScaleRef.current = clamp(targetScaleRef.current * e.scale);
      e.scale = 1; // reset so it's always relative
      startAnim();
    }

    function handleGestureEnd(e: any) {
      e.preventDefault();
      gestureActive = false;
      delete viewport!.dataset.pinching;
    }

    // Global document-level gesturestart handler to prevent iOS
    // native page zoom from even starting
    function handleDocGestureStart(e: Event) {
      e.preventDefault();
    }

    // ── 3. Mobile (Android + iOS fallback): touch pinch-to-zoom ──
    // On Android, pinch comes through touch events.
    // On iOS, gesture events handle it (above), but we keep touch
    // handlers as fallback. gestureActive flag prevents doubling.
    let initialPinchDist = 0;
    let pinchScaleBase = 1;

    function getTouchDist(t1: Touch, t2: Touch): number {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function handleTouchStart(e: TouchEvent) {
      if (gestureActive) return; // iOS Safari handles via gesture events
      if (e.touches.length === 2) {
        e.preventDefault();
        initialPinchDist = getTouchDist(e.touches[0], e.touches[1]);
        pinchScaleBase = targetScaleRef.current;
        viewport!.dataset.pinching = '1';
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (gestureActive) return; // iOS Safari handles via gesture events
      if (e.touches.length === 2) {
        e.preventDefault();
        if (initialPinchDist === 0) {
          // Pinch started mid-gesture (first finger was already down)
          initialPinchDist = getTouchDist(e.touches[0], e.touches[1]);
          pinchScaleBase = targetScaleRef.current;
          viewport!.dataset.pinching = '1';
          return;
        }
        const currentDist = getTouchDist(e.touches[0], e.touches[1]);
        const ratio = currentDist / initialPinchDist;
        targetScaleRef.current = clamp(pinchScaleBase * ratio);
        startAnim();
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        initialPinchDist = 0;
        if (!gestureActive) {
          delete viewport!.dataset.pinching;
        }
      }
    }

    // Attach all listeners
    viewport.addEventListener('wheel', handleWheel, { passive: false });

    // Gesture events (Safari macOS + iOS)
    viewport.addEventListener('gesturestart', handleGestureStart as EventListener, { passive: false });
    viewport.addEventListener('gesturechange', handleGestureChange as EventListener, { passive: false });
    viewport.addEventListener('gestureend', handleGestureEnd as EventListener, { passive: false });

    // Global gesturestart to block iOS native zoom entirely
    document.addEventListener('gesturestart', handleDocGestureStart as EventListener, { passive: false });

    // Touch events (Android + iOS fallback)
    viewport.addEventListener('touchstart', handleTouchStart, { passive: false });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', handleTouchEnd);

    return () => {
      viewport.removeEventListener('wheel', handleWheel);
      viewport.removeEventListener('gesturestart', handleGestureStart as EventListener);
      viewport.removeEventListener('gesturechange', handleGestureChange as EventListener);
      viewport.removeEventListener('gestureend', handleGestureEnd as EventListener);
      document.removeEventListener('gesturestart', handleDocGestureStart as EventListener);
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
