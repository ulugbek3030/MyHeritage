import { useEffect } from 'react';
import type { Person } from '../../types';

interface Props {
  open: boolean;
  position: { x: number; y: number } | null;
  person: Person;
  hasUpcomingBirthday?: boolean;
  onClose: () => void;
  onGift: () => void;
  onGoBirthday: () => void;
  onEdit: () => void;
  onAddRelative: () => void;
  onHide: () => void;
  onDelete: () => void;
}

export const LongPressMenu = ({ open, position, person, hasUpcomingBirthday, onClose, onGift, onGoBirthday, onEdit, onAddRelative, onHide, onDelete }: Props) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !position) return null;

  const items: Array<{ icon?: string; label?: string; onClick?: () => void; primary?: boolean; danger?: boolean; type?: 'divider' }> = [
    ...(hasUpcomingBirthday && person.isAlive ? [{ icon: '🎂', label: 'Подарить торт', onClick: onGift, primary: true }] : []),
    { icon: '📅', label: 'Перейти к событию', onClick: onGoBirthday },
    { icon: '✎', label: 'Редактировать', onClick: onEdit },
    { icon: '+', label: 'Добавить родственника', onClick: onAddRelative },
    { type: 'divider' },
    { icon: '⊘', label: 'Скрыть в дереве', onClick: onHide },
    { icon: '🗑', label: 'Удалить', onClick: onDelete, danger: true },
  ];

  const x = Math.min(position.x, window.innerWidth - 200);
  const y = Math.min(position.y, window.innerHeight - 280);

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:40,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(2px)'}} />
      <div onClick={(e) => e.stopPropagation()} style={{position:'fixed',left:x,top:y,zIndex:50,background:'rgba(15,15,20,0.95)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:6,minWidth:180,boxShadow:'0 18px 48px rgba(0,0,0,0.6)'}}>
        {items.map((it, i) => it.type === 'divider' ? (
          <div key={i} style={{height:1,background:'rgba(255,255,255,0.06)',margin:'4px 6px'}} />
        ) : (
          <button key={i} onClick={() => { it.onClick?.(); onClose(); }} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,fontSize:12,fontWeight:600,color:it.danger?'#f87171':it.primary?'var(--accent)':'var(--text)',background:it.primary?'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(245,158,11,0.08))':'transparent',border:it.primary?'1px solid rgba(251,191,36,0.2)':'none',width:'100%',cursor:'pointer'}}>
            <span style={{width:22,height:22,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,borderRadius:6,background:it.primary?'linear-gradient(135deg,var(--accent),var(--accent-hover))':it.danger?'rgba(248,113,113,0.1)':'rgba(255,255,255,0.04)',color:it.primary?'#0a0a0d':'inherit'}}>{it.icon}</span>
            <span style={{flex:1,textAlign:'left'}}>{it.label}</span>
          </button>
        ))}
      </div>
    </>
  );
};
