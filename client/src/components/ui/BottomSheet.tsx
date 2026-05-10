import { useEffect, useRef, type ReactNode } from 'react';

export const BottomSheet = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    // Make sure the sheet always opens scrolled to the top — otherwise iOS
    // can leave it mid-scrolled when a focused input from a previous open
    // pushed the position down.
    if (panelRef.current) panelRef.current.scrollTop = 0;
    // Cleanup runs both on `open` flipping false AND on unmount — PersonSheet
    // returns null when the user closes it, which unmounts BottomSheet
    // synchronously without giving the effect a chance to fire with open=false.
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Block iOS / Click WebView's auto-scroll-to-focused-input. When the
  // user taps a field the browser yanks the panel's scrollTop to bring
  // the input into view; without this fix the form ended up stuck at a
  // random scroll position and the top fields were hidden.
  //
  // Strategy: snapshot scrollTop on focusin, then re-assert it on every
  // scroll event for the next ~600ms — iOS's deferred scroll-into-view
  // happens AFTER focus, often 100-400ms later. Concurrent USER scroll
  // (touchstart on the panel) cancels the lock so manual gestures aren't
  // fought against.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    let userScrolling = false;
    let lockUntil = 0;
    let lockedScrollTop = 0;

    const onTouchStart = () => { userScrolling = true; };
    const onTouchEnd = () => {
      // Brief grace period — iOS sometimes fires deferred scrolls a few
      // frames after touchend that aren't really the user's intent.
      setTimeout(() => { userScrolling = false; }, 50);
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      // Anchor at the current scroll position. Re-assert it on every
      // scroll for the next 600ms to catch iOS's deferred adjustment.
      lockedScrollTop = panel.scrollTop;
      lockUntil = Date.now() + 600;
    };

    const onScroll = () => {
      if (userScrolling) return;
      if (Date.now() > lockUntil) return;
      if (panel.scrollTop !== lockedScrollTop) {
        panel.scrollTop = lockedScrollTop;
      }
    };

    panel.addEventListener('focusin', onFocusIn);
    panel.addEventListener('scroll', onScroll, { passive: true });
    panel.addEventListener('touchstart', onTouchStart, { passive: true });
    panel.addEventListener('touchend', onTouchEnd, { passive: true });
    panel.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      panel.removeEventListener('focusin', onFocusIn);
      panel.removeEventListener('scroll', onScroll);
      panel.removeEventListener('touchstart', onTouchStart);
      panel.removeEventListener('touchend', onTouchEnd);
      panel.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [open]);
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'stretch',
        background: 'rgba(0,0,0,0.55)',
        // Don't let the backdrop itself scroll when the on-screen keyboard
        // pushes content around — the keyboard chrome was treating the
        // backdrop as a scrollable parent and yanking the sheet around.
        overflow: 'hidden',
        // Block native pinch on the sheet too; the panel uses pan-y only
        // for its own vertical scroll.
        touchAction: 'none',
      }}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          // svh = "small viewport height": the stable minimum size that
          // ignores the iOS address bar AND on-screen keyboard, so the
          // panel doesn't resize/jump when an input focuses. dvh used to
          // shrink under the keyboard and the user saw the sheet "moving".
          height: '100svh',
          overflowY: 'auto',
          // Keep scroll contained: don't bounce past the panel edges and
          // don't propagate scroll back to the page underneath.
          overscrollBehavior: 'contain',
          // Allow only vertical pan inside the panel — no native pinch,
          // no horizontal slide that could leak to the tree behind.
          touchAction: 'pan-y',
          // Stop iOS Safari from auto-scrolling the panel above the
          // address bar when an input is focused (it tries to "bring the
          // input into view" by treating the panel as a scrollable
          // ancestor — combined with svh that scrolling looks like the
          // sheet is sliding away).
          WebkitOverflowScrolling: 'touch',
          background: 'linear-gradient(180deg,var(--surface),var(--bg))',
          padding: 'calc(18px + var(--safe-top, 0px)) 28px 28px',
          animation: 'sheetIn 220ms cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {children}
      </div>
      <style>{`@keyframes sheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
};
