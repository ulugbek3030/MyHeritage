import { useState, useMemo } from 'react';
import type { Person } from '../../types';

export const TreeSearch = ({ persons, onSelect, onClose }: { persons: Person[]; onSelect: (id: string) => void; onClose: () => void }) => {
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    if (!q.trim()) return [];
    const needle = q.toLowerCase();
    return persons.filter((p) =>
      [p.firstName, p.lastName, p.middleName, p.maidenName].some((f) => f?.toLowerCase().includes(needle))
    ).slice(0, 20);
  }, [q, persons]);

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:40,background:'rgba(0,0,0,0.6)',padding:'40px 18px',backdropFilter:'blur(2px)'}}>
      <div onClick={(e) => e.stopPropagation()} style={{maxWidth:560,margin:'0 auto',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:18,padding:14}}>
        <input autoFocus placeholder="Найти родственника…" value={q} onChange={(e) => setQ(e.target.value)} className="auth-input" style={{marginBottom:8}} />
        {matches.map((p) => (
          <button key={p.id} onClick={() => { onSelect(p.id); onClose(); }} style={{display:'flex',gap:10,padding:'10px 12px',width:'100%',borderRadius:10,background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)',color:'var(--text)',marginBottom:4,cursor:'pointer',alignItems:'center'}}>
            <span style={{width:30,height:30,borderRadius:'50%',background:p.gender==='female'?'rgba(244,114,182,0.15)':'rgba(96,165,250,0.15)',color:p.gender==='female'?'#f472b6':'#60a5fa',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>{p.firstName[0]}</span>
            <span style={{flex:1,textAlign:'left'}}>
              <div style={{fontWeight:700,fontSize:13}}>{[p.firstName, p.lastName].filter(Boolean).join(' ')}</div>
              <div style={{fontSize:10,color:'var(--text-muted)'}}>{p.birthYear ?? '–'}{p.isAlive ? '' : ` – ${p.deathYear ?? '–'}`}</div>
            </span>
          </button>
        ))}
        {q && matches.length === 0 && <div style={{padding:12,textAlign:'center',color:'var(--text-muted)',fontSize:12}}>Не найдено</div>}
      </div>
    </div>
  );
};
