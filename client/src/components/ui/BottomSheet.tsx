import { useEffect, type ReactNode } from 'react';

export const BottomSheet = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) => {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    // Cleanup runs both on `open` flipping false AND on unmount — PersonSheet
    // returns null when the user closes it, which unmounts BottomSheet
    // synchronously without giving the effect a chance to fire with open=false.
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'stretch',background:'rgba(0,0,0,0.55)'}}>
      <div onClick={(e) => e.stopPropagation()} style={{width:'100%',height:'100dvh',overflowY:'auto',background:'linear-gradient(180deg,var(--surface),var(--bg))',padding:'calc(18px + var(--safe-top, 0px)) 28px 28px',animation:'sheetIn 220ms cubic-bezier(0.32,0.72,0,1)'}}>
        {children}
      </div>
      <style>{`@keyframes sheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
};
