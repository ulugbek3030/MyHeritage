import { useEffect, type ReactNode } from 'react';

export const BottomSheet = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) => {
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; }, [open]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'flex-end',background:'rgba(0,0,0,0.55)'}}>
      <div onClick={(e) => e.stopPropagation()} style={{width:'100%',maxWidth:560,margin:'0 auto',background:'linear-gradient(180deg,var(--surface),var(--bg))',border:'1px solid var(--border)',borderBottom:'none',borderRadius:'24px 24px 0 0',padding:'12px 20px 22px',animation:'sheetIn 220ms cubic-bezier(0.32,0.72,0,1)'}}>
        <div style={{width:36,height:4,background:'rgba(255,255,255,0.18)',borderRadius:2,margin:'0 auto 14px'}} />
        {children}
      </div>
      <style>{`@keyframes sheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
};
