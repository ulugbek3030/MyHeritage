import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listTrees, createTree } from '../api/trees';
import { Skeleton } from '../components/ui/Skeleton';

/**
 * Root route. Click Family is single-tree per user — we never show a list.
 * If the user has a tree, jump straight into it. Otherwise show a single
 * "create" empty state.
 */
export const TreesListPage = () => {
  const nav = useNavigate();
  const [hasNoTrees, setHasNoTrees] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTrees()
      .then((trees) => {
        if (trees.length > 0) nav(`/trees/${trees[0].id}`, { replace: true });
        else setHasNoTrees(true);
      })
      .finally(() => setLoading(false));
  }, [nav]);

  const onCreate = async () => {
    const t = await createTree('Моя семья');
    nav(`/trees/${t.id}`, { replace: true });
  };

  if (loading || !hasNoTrees) return (
    <div style={{padding:24,display:'flex',flexDirection:'column',gap:8}}>
      <Skeleton height={48} radius={14} />
      <Skeleton height={120} radius={14} />
      <Skeleton height={300} radius={14} />
    </div>
  );
  return (
    <div style={{padding:24,maxWidth:420,margin:'40px auto',textAlign:'center'}}>
      <h1 style={{fontSize:28,fontWeight:800,marginBottom:12}}>Создайте дерево</h1>
      <p style={{color:'var(--text-muted)',marginBottom:24}}>Начнём с вас и ваших ближайших родственников</p>
      <button onClick={onCreate} style={{background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',fontWeight:800,padding:'14px 28px',border:'none',borderRadius:14}}>
        Создать
      </button>
    </div>
  );
};
