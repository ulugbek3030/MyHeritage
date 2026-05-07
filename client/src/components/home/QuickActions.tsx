export const QuickActions = ({ onCalendar, onShare, onGifts, eventCount }: { onCalendar: () => void; onShare: () => void; onGifts: () => void; eventCount: number }) => (
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,margin:'0 18px 18px'}}>
    {[
      { onClick: onCalendar, icon: '📅', name: 'Календарь', sub: `${eventCount} событий`, badge: eventCount > 0 ? eventCount : null, color: '#60a5fa' },
      { onClick: onShare, icon: '⤴', name: 'Поделиться', sub: 'деревом', badge: null, color: 'gold' },
      { onClick: onGifts, icon: '🎁', name: 'Подарки', sub: 'история', badge: null, color: '#f472b6' },
    ].map((qa, i) => (
      <button key={i} onClick={qa.onClick} style={{padding:'12px 8px',background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)',borderRadius:16,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:6,color:'var(--text)'}}>
        <div style={{position:'relative',width:36,height:36,borderRadius:11,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,...(qa.color === 'gold' ? { background: 'linear-gradient(135deg,var(--accent),var(--accent-hover))', color: '#0a0a0d' } : { background: `${qa.color}1f`, color: qa.color, border: `1px solid ${qa.color}33` })}}>
          {qa.icon}
          {qa.badge && <span style={{position:'absolute',top:-3,right:-3,background:'var(--accent)',color:'#0a0a0d',fontSize:8,fontWeight:800,borderRadius:8,padding:'1px 5px',border:'2px solid #0a0a0d'}}>{qa.badge}</span>}
        </div>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:'-0.01em'}}>{qa.name}</div>
        <div style={{fontSize:9,color:'var(--text-dim)'}}>{qa.sub}</div>
      </button>
    ))}
  </div>
);
