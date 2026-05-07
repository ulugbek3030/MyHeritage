export const Breadcrumbs = ({ items }: { items: { label: string; onClick?: () => void }[] }) => (
  <div style={{padding:'6px 18px',fontSize:10,color:'var(--text-dim)'}}>
    {items.map((it, i) => (
      <span key={i}>
        {i > 0 && <span style={{margin:'0 4px'}}>›</span>}
        <span onClick={it.onClick} style={{cursor: it.onClick ? 'pointer' : 'default', color: i === items.length - 1 ? 'var(--accent)' : 'var(--text-dim)', fontWeight: i === items.length - 1 ? 700 : 500}}>{it.label}</span>
      </span>
    ))}
  </div>
);
