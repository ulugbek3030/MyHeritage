export const NudgeProgress = ({ pct, hint }: { pct: number; hint: string }) => {
  if (pct >= 80) return null;
  const dash = 88, offset = dash * (1 - pct / 100);
  return (
    <div style={{margin:'0 18px 14px',padding:'11px 14px',borderRadius:14,background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12}}>
      <div style={{position:'relative',width:36,height:36}}>
        <svg width={36} height={36} viewBox="0 0 36 36" style={{transform:'rotate(-90deg)'}}>
          <circle cx={18} cy={18} r={14} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
          <circle cx={18} cy={18} r={14} fill="none" stroke="var(--accent)" strokeWidth={3} strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'var(--accent)'}}>{pct}%</div>
      </div>
      <div style={{flex:1,fontSize:11,color:'var(--text-muted)',lineHeight:1.35}}>Дерево заполнено на <b style={{color:'var(--text)'}}>{pct}%</b><br/>{hint}</div>
    </div>
  );
};
