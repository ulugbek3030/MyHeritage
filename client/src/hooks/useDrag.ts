import { useEffect } from 'react';

export const useDrag = (viewportRef: React.RefObject<HTMLElement>, contentRef: React.RefObject<HTMLElement>) => {
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    let dragging = false, startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0;

    const onDown = (e: MouseEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['BUTTON', 'A', 'INPUT'].includes(tag)) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      scrollLeft = vp.scrollLeft; scrollTop = vp.scrollTop;
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      vp.scrollLeft = scrollLeft - (e.clientX - startX);
      vp.scrollTop = scrollTop - (e.clientY - startY);
    };
    const onUp = () => { dragging = false; };

    vp.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    let tx = 0, ty = 0, tsl = 0, tst = 0, tdrag = false;
    const onTStart = (e: TouchEvent) => {
      if (vp.dataset.pinching === '1' || e.touches.length !== 1) return;
      tdrag = true;
      tx = e.touches[0].clientX; ty = e.touches[0].clientY;
      tsl = vp.scrollLeft; tst = vp.scrollTop;
    };
    const onTMove = (e: TouchEvent) => {
      if (!tdrag) return;
      // preventDefault so iOS doesn't ALSO run its own native pan in
      // parallel with our manual scrollLeft/Top sets — without this the
      // two compete and the canvas judders. Listener is registered as
      // non-passive (below) so this call actually takes effect.
      e.preventDefault();
      vp.scrollLeft = tsl - (e.touches[0].clientX - tx);
      vp.scrollTop = tst - (e.touches[0].clientY - ty);
    };
    const onTEnd = () => { tdrag = false; };
    vp.addEventListener('touchstart', onTStart, { passive: true });
    vp.addEventListener('touchmove', onTMove, { passive: false });
    vp.addEventListener('touchend', onTEnd, { passive: true });

    return () => {
      vp.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      vp.removeEventListener('touchstart', onTStart);
      vp.removeEventListener('touchmove', onTMove);
      vp.removeEventListener('touchend', onTEnd);
    };
  }, []);
};
