import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFullTree } from '../api/trees';
import type { FullTree } from '../types';
import { FamilyTreeLayout } from '../components/tree/FamilyTreeLayout';

export const FullTreePage = () => {
  const { treeId } = useParams<{ treeId: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<FullTree | null>(null);

  useEffect(() => { if (treeId) getFullTree(treeId).then(setData); }, [treeId]);

  if (!data) return <div style={{padding:24}}>Загрузка…</div>;

  return (
    <div style={{height:'calc(100dvh - var(--safe-top, 0px))',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <header style={{padding:'12px 18px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <button onClick={() => nav(-1 as any)} style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text)'}}>←</button>
        <div style={{flex:1,fontSize:15,fontWeight:800}}>{data.tree.name}</div>
        <div style={{color:'var(--text-muted)',fontSize:11}}>{data.persons.length} чел</div>
      </header>
      <div style={{flex:1,padding:8,overflow:'hidden'}}>
        <FamilyTreeLayout persons={data.persons} relationships={data.relationships} ownerId={data.tree.ownerPersonId} />
      </div>
    </div>
  );
};
