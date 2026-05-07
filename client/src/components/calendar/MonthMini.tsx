import type { FamilyEvent } from '../../types';

const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

const dotColor = (e: FamilyEvent) => e.type === 'memorial' ? '#71717a' : e.type === 'anniversary' ? '#f472b6' : e.type === 'child_birthday' ? '#60a5fa' : '#fbbf24';

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
        <div style={{fontSize:13,fontWeight:800,letterSpacing:'-0.01em'}}>{MONTHS[month]} {year}</div>
        <div style={{display:'flex',gap:6}}>
          <button onClick={() => onMonthChange?.(-1)} style={{width:24,height:24,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text-muted)',cursor:'pointer'}}>‹</button>
          <button onClick={() => onMonthChange?.(1)} style={{width:24,height:24,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text-muted)',cursor:'pointer'}}>›</button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,fontSize:9,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:0.6,fontWeight:700,textAlign:'center',marginBottom:6}}>
        {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
        {cells.map((c, i) => c === null ? <div key={i} /> : (
          <div key={i} style={{position:'relative',aspectRatio:'1',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:isToday(c.day)?800:600,color:isToday(c.day)?'#0a0a0d':'var(--text)',borderRadius:8,background:isToday(c.day)?'linear-gradient(135deg,var(--accent),var(--accent-hover))':'transparent'}}>
            {c.day}
            {c.events.length > 0 && (
              <div style={{position:'absolute',bottom:3,left:'50%',transform:'translateX(-50%)',display:'flex',gap:2}}>
                {c.events.slice(0, 3).map((e, j) => <span key={j} style={{width:4,height:4,borderRadius:'50%',background:isToday(c.day)?'#0a0a0d':dotColor(e)}} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
