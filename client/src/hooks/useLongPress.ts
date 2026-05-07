import { useRef, useCallback } from 'react';

export const useLongPress = (onLongPress: () => void, ms = 500) => {
  const timer = useRef<number | null>(null);
  const start = useCallback(() => {
    timer.current = window.setTimeout(() => {
      onLongPress();
      navigator.vibrate?.(20);
    }, ms);
  }, [onLongPress, ms]);
  const clear = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);
  return { onMouseDown: start, onMouseUp: clear, onMouseLeave: clear, onTouchStart: start, onTouchEnd: clear };
};
