import type { FamilyEvent } from '../../types';

export const Hero = ({ event, onOpenCta }: { event: FamilyEvent | null; onOpenCta?: () => void }) => {
  if (!event) return (
    <div style={{margin:'0 18px 14px',padding:'16px 18px',borderRadius:22,background:'radial-gradient(140% 100% at 0% 0%,rgba(96,165,250,0.12),transparent 65%),linear-gradient(180deg,#0e1219,#060a0e)',border:'1px solid rgba(96,165,250,0.2)'}}>
      <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:1.5,color:'#60a5fa',marginBottom:6}}>Подсказка</div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Добавьте бабушку</div>
      <div style={{fontSize:11,color:'var(--text-muted)'}}>Раскроет ещё несколько родственников</div>
    </div>
  );
  return (
    <div style={{margin:'0 18px 14px',padding:'16px 18px',borderRadius:22,background:'radial-gradient(140% 100% at 0% 0%,rgba(251,191,36,0.22),transparent 65%),linear-gradient(180deg,#1c1409,#0e0a04)',border:'1px solid rgba(251,191,36,0.22)'}}>
      <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:1.5,color:'var(--accent)',marginBottom:8}}>Через {event.daysUntil} дн</div>
      <div style={{fontSize:20,fontWeight:800,marginBottom:6,letterSpacing:'-0.02em'}}>{event.type === 'memorial' ? 'Годовщина памяти' : event.type === 'anniversary' ? 'Годовщина свадьбы' : 'День рождения'}</div>
      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:14}}>{event.meta.name}{event.meta.ageOnEvent ? ` · ${event.meta.ageOnEvent} лет` : ''}{event.meta.yearsAgo ? ` · ${event.meta.yearsAgo} лет назад` : ''}</div>
      <button onClick={onOpenCta} style={{width:'100%',padding:12,background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',border:'none',borderRadius:14,fontWeight:800}}>Подробнее</button>
    </div>
  );
};
