export const FAB = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} style={{position:'fixed',bottom:24,right:24,width:56,height:56,background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',borderRadius:18,border:'none',fontSize:26,fontWeight:800,color:'#0a0a0d',boxShadow:'0 8px 24px rgba(251,191,36,0.4)',cursor:'pointer',zIndex:20}}>+</button>
);
