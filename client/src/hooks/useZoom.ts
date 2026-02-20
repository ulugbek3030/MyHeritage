/**
 * useZoom — provides zoom control callbacks via react-zoom-pan-pinch.
 *
 * The library handles ALL touch/gesture/wheel events natively:
 *   1. Desktop trackpad pinch (Ctrl+Wheel)
 *   2. macOS/iOS Safari gesture events
 *   3. Mobile Android/iOS touch pinch-to-zoom
 *   4. Mouse drag to pan
 *   5. Touch drag to pan (one finger)
 *
 * This hook simply stores the library's API ref so that ZoomControls
 * buttons (zoomIn/zoomOut/zoomReset) can call the library methods.
 */
import { useRef, useCallback } from 'react';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';

export function useZoom() {
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);

  const setTransformRef = useCallback((ref: ReactZoomPanPinchRef) => {
    transformRef.current = ref;
  }, []);

  const zoomIn = useCallback(() => {
    transformRef.current?.zoomIn(0.3, 200);
  }, []);

  const zoomOut = useCallback(() => {
    transformRef.current?.zoomOut(0.3, 200);
  }, []);

  const zoomReset = useCallback(() => {
    transformRef.current?.resetTransform(200);
  }, []);

  return { zoomIn, zoomOut, zoomReset, setTransformRef, transformRef };
}
