import type { FamilyEvent } from '../../types';
import { eventIcon } from '../../utils/eventIcons';

const TAGS: Record<FamilyEvent['type'], string> = { birthday: 'ДР', child_birthday: 'ДР', memorial: 'Память', anniversary: 'Свадьба' };

export const EventCard = ({ event }: { event: FamilyEvent }) => {
  const urgent = event.daysUntil <= 7;
  return (
    <div style={{display:'flex',gap:12,padding:12,borderRadius:14,background:urgent?'rgba(251,191,36,0.06)':'rgba(255,255,255,0.03)',border:`1px solid ${urgent?'rgba(251,191,36,0.3)':'var(--border)'}`,marginBottom:6,alignItems:'center'}}>
      <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{eventIcon(event.type)}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:800,letterSpacing:'-0.01em'}}>{event.meta.name} <span style={{fontSize:9,color:urgent?'var(--accent)':'var(--text-muted)',fontWeight:800,marginLeft:4,padding:'2px 6px',borderRadius:4,background:urgent?'rgba(251,191,36,0.15)':'rgba(255,255,255,0.06)'}}>{TAGS[event.type]}</span></div>
        <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{event.type === 'memorial' ? `${event.meta.yearsAgo} лет как ушёл` : event.type === 'anniversary' ? `${event.meta.yearsAgo} лет вместе` : `${event.meta.ageOnEvent} лет`}</div>
      </div>
      <div style={{fontSize:11,fontWeight:800,color:urgent?'var(--accent)':'var(--text-dim)',whiteSpace:'nowrap'}}>{event.daysUntil === 0 ? 'сегодня' : `${event.daysUntil} дн`}</div>
    </div>
  );
};
