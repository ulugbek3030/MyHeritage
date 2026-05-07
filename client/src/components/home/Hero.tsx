import type { FamilyEvent } from '../../types';

interface Props { event: FamilyEvent | null; onOpenCta?: () => void; treeFillPct?: number; }

export const Hero = ({ event, onOpenCta, treeFillPct = 0 }: Props) => {
  // Onboarding state — нет события, дерево < 30%
  if (!event && treeFillPct < 30) return (
    <div style={{margin:'0 18px 14px',padding:'16px 18px',borderRadius:22,background:'radial-gradient(140% 100% at 0% 0%,rgba(96,165,250,0.12),transparent 65%),linear-gradient(180deg,#0e1219,#060a0e)',border:'1px solid rgba(96,165,250,0.2)'}}>
      <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:1.5,color:'#60a5fa',marginBottom:6}}>Подсказка</div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Добавьте бабушку</div>
      <div style={{fontSize:11,color:'var(--text-muted)'}}>Раскроет ещё несколько родственников</div>
    </div>
  );
  if (!event) return null;

  const isMemorial = event.type === 'memorial';
  const isAnniversary = event.type === 'anniversary';

  const styles = isMemorial
    ? { bg: 'linear-gradient(180deg,#1a1a1f,#0a0a0d)', accent: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.08)' }
    : isAnniversary
      ? { bg: 'radial-gradient(140% 100% at 0% 0%,rgba(244,114,182,0.18),transparent 65%),linear-gradient(180deg,#1a0e15,#0d0709)', accent: '#f472b6', border: 'rgba(244,114,182,0.22)' }
      : { bg: 'radial-gradient(140% 100% at 0% 0%,rgba(251,191,36,0.22),transparent 65%),linear-gradient(180deg,#1c1409,#0e0a04)', accent: 'var(--accent)', border: 'rgba(251,191,36,0.22)' };

  const tagText = isMemorial ? 'Сегодня годовщина' : `Через ${event.daysUntil} дн`;
  const titleText = isMemorial ? 'Помянём' : isAnniversary ? 'Годовщина свадьбы' : 'День рождения';
  const ctaText = isAnniversary ? 'Поздравить пару' : 'Подробнее';

  return (
    <div style={{margin:'0 18px 14px',padding:'16px 18px',borderRadius:22,background:styles.bg,border:`1px solid ${styles.border}`}}>
      <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:1.5,color:styles.accent,marginBottom:8}}>{tagText}</div>
      <div style={{fontSize:20,fontWeight:800,marginBottom:6,letterSpacing:'-0.02em'}}>{titleText}</div>
      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:14}}>
        {event.meta.name}
        {event.meta.ageOnEvent ? ` · ${event.meta.ageOnEvent} лет` : ''}
        {event.meta.yearsAgo ? ` · ${event.meta.yearsAgo} лет назад` : ''}
      </div>
      {!isMemorial && <button onClick={onOpenCta} style={{width:'100%',padding:12,background:isAnniversary?'linear-gradient(135deg,#f472b6,#db2777)':'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',border:'none',borderRadius:14,fontWeight:800}}>{ctaText}</button>}
    </div>
  );
};
