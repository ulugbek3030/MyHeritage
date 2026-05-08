import type { FamilyEvent } from '../../types';
import { distinctEventIcons } from '../../utils/eventIcons';

const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

export const MonthMini = ({ events, monthOffset = 0, onMonthChange }: { events: FamilyEvent[]; monthOffset?: number; onMonthChange?: (delta: number) => void }) => {
  const today = new Date();
  const view = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  const eventsByDay: Record<number, FamilyEvent[]> = {};
  for (const e of events) {
    const d = new Date(e.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      eventsByDay[day] = [...(eventsByDay[day] ?? []), e];
    }
  }

  const cells: ({ day: number; events: FamilyEvent[] } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, events: eventsByDay[d] ?? [] });
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d: number) => year === today.getFullYear() && month === today.getMonth() && d === today.getDate();

  return (
    <div style={{margin:'0 18px 16px',padding:14,background:'linear-gradient(180deg,#16161a,#0c0c0e)',border:'1px solid var(--border)',borderRadius:18}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontSize:18,fontWeight:800,letterSpacing:'-0.01em'}}>{MONTHS[month]} {year}</div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={() => onMonthChange?.(-1)} style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:18}}>‹</button>
          <button onClick={() => onMonthChange?.(1)} style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:18}}>›</button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6,fontSize:11,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:0.6,fontWeight:700,textAlign:'center',marginBottom:8}}>
        {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6}}>
        {cells.map((c, i) => c === null ? <div key={i} /> : (
          <div key={i} style={{position:'relative',aspectRatio:'1',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:isToday(c.day)?800:600,color:isToday(c.day)?'#0a0a0d':'var(--text)',borderRadius:10,background:isToday(c.day)?'linear-gradient(135deg,var(--accent),var(--accent-hover))':'transparent',gap:1,paddingTop:c.events.length>0?2:0}}>
            <span style={{lineHeight:1}}>{c.day}</span>
            {c.events.length > 0 && (
              <div style={{display:'flex',gap:1,fontSize:15,lineHeight:1}}>
                {/* Distinct event types only — no dupes when multiple kids share a birthday in the same family on the same day. */}
                {distinctEventIcons(c.events).slice(0, 3).map((icon, j) => (
                  <span key={j} aria-hidden="true" style={{filter:isToday(c.day)?'grayscale(0.5) brightness(0.6)':'none'}}>{icon}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
