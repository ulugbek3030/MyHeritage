import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listEvents } from '../api/events';
import type { FamilyEvent } from '../types';
import { EventCard } from '../components/calendar/EventCard';
import { MonthMini } from '../components/calendar/MonthMini';

export const CalendarPage = () => {
  const { treeId } = useParams<{ treeId: string }>();
  const nav = useNavigate();
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'birthday' | 'memorial' | 'anniversary'>('all');
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    if (!treeId) return;
    const from = new Date().toISOString();
    // 365-day window so every birthday in the next year shows up; previously
    // the page was empty if no one's birthday fell in the next 3 months.
    const to = new Date(Date.now() + 365 * 86400000).toISOString();
    listEvents(treeId, from, to).then(setEvents).finally(() => setLoading(false));
  }, [treeId]);

  const filtered = useMemo(() => filter === 'all' ? events : events.filter((e) => e.type === filter || (filter === 'birthday' && e.type === 'child_birthday')), [events, filter]);

  const groups = useMemo(() => {
    const today: FamilyEvent[] = [], week: FamilyEvent[] = [], month: FamilyEvent[] = [], later: FamilyEvent[] = [];
    for (const e of filtered) {
      if (e.daysUntil === 0) today.push(e);
      else if (e.daysUntil <= 7) week.push(e);
      else if (e.daysUntil <= 30) month.push(e);
      else later.push(e);
    }
    return { today, week, month, later };
  }, [filtered]);

  return (
    <div style={{minHeight:'100dvh',display:'flex',flexDirection:'column'}}>
      <header style={{padding:'12px 18px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid var(--border)'}}>
        <button onClick={() => nav(-1 as any)} style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text)'}}>←</button>
        <div style={{flex:1,fontSize:17,fontWeight:800}}>Календарь</div>
      </header>
      <div style={{display:'flex',gap:6,padding:'10px 18px',overflowX:'auto'}}>
        {([['all','Все'],['birthday','🎂 ДР'],['anniversary','💍 Свадьбы'],['memorial','🕯 Память']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} style={{padding:'7px 12px',borderRadius:18,fontSize:11,fontWeight:filter===k?800:600,whiteSpace:'nowrap',background:filter===k?'linear-gradient(135deg,var(--accent),var(--accent-hover))':'rgba(255,255,255,0.04)',color:filter===k?'#0a0a0d':'var(--text)',border:`1px solid ${filter===k?'transparent':'var(--border)'}`}}>{label}</button>
        ))}
      </div>
      <MonthMini events={events} monthOffset={monthOffset} onMonthChange={(d) => setMonthOffset(monthOffset + d)} />
      {loading ? <div style={{padding:24}}>Загрузка…</div> : (
        <div style={{padding:'0 18px 24px',flex:1}}>
          {([['Сегодня', groups.today], ['На этой неделе', groups.week], ['В этом месяце', groups.month], ['Дальше', groups.later]] as const).map(([title, list]) => list.length > 0 && (
            <div key={title}>
              <div style={{fontSize:10,textTransform:'uppercase',fontWeight:800,letterSpacing:1.4,color:'var(--text-dim)',margin:'14px 0 8px'}}>{title} <span style={{background:'rgba(255,255,255,0.06)',color:'var(--text-muted)',padding:'1px 6px',borderRadius:6,fontSize:9,fontWeight:700,letterSpacing:'normal',textTransform:'none'}}>{list.length}</span></div>
              {list.map((e, i) => <EventCard key={`${e.type}-${e.date}-${i}`} event={e} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
