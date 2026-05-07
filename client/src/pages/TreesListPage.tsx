import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listTrees, createTree } from '../api/trees';
import type { Tree } from '../types';
import { Skeleton } from '../components/ui/Skeleton';

export const TreesListPage = () => {
  const nav = useNavigate();
  const [trees, setTrees] = useState<(Tree & { personCount: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { listTrees().then(setTrees).finally(() => setLoading(false)); }, []);

  const onCreate = async () => {
    const t = await createTree('Моя семья');
    nav(`/trees/${t.id}`);
  };

  if (loading) return (
    <div style={{padding:24,display:'flex',flexDirection:'column',gap:8}}>
      <Skeleton height={48} radius={14} />
      <Skeleton height={120} radius={14} />
      <Skeleton height={300} radius={14} />
    </div>
  );
  if (trees.length === 0) return (
    <div style={{padding:24,maxWidth:420,margin:'40px auto',textAlign:'center'}}>
      <h1 style={{fontSize:28,fontWeight:800,marginBottom:12}}>Создайте дерево</h1>
      <p style={{color:'var(--text-muted)',marginBottom:24}}>Начнём с вас и ваших ближайших родственников</p>
      <button onClick={onCreate} style={{background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',fontWeight:800,padding:'14px 28px',border:'none',borderRadius:14}}>
        Создать
      </button>
    </div>
  );
  return (
    <div style={{padding:24,maxWidth:420,margin:'0 auto'}}>
      {trees.map((t) => (
        <div key={t.id} onClick={() => nav(`/trees/${t.id}`)} style={{padding:16,background:'var(--surface)',borderRadius:14,border:'1px solid var(--border)',marginBottom:12,cursor:'pointer'}}>
          <div style={{fontWeight:700,fontSize:16}}>{t.name}</div>
          <div style={{color:'var(--text-muted)',fontSize:12,marginTop:4}}>{t.personCount} человек</div>
        </div>
      ))}
    </div>
  );
};
