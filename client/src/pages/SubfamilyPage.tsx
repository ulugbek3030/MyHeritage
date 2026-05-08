import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFullTree } from '../api/trees';
import type { FullTree, Person } from '../types';
import { FamilyTreeLayout } from '../components/tree/FamilyTreeLayout';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { reachableFromRoot, computeRelation } from '../utils/subfamilyTransform';

export const SubfamilyPage = () => {
  const { treeId, personId } = useParams<{ treeId: string; personId: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<FullTree | null>(null);

  useEffect(() => { if (treeId) getFullTree(treeId).then(setData); }, [treeId]);

  const root: Person | undefined = data?.persons.find((p) => p.id === personId);
  const reachable = useMemo(() => data && personId ? reachableFromRoot(personId, data.relationships, 3) : new Set<string>(), [data, personId]);

  const filteredPersons = useMemo(() => data ? data.persons.filter((p) => reachable.has(p.id)) : [], [data, reachable]);
  const filteredRels = useMemo(() => data ? data.relationships.filter((r) => reachable.has(r.person1Id) && reachable.has(r.person2Id)) : [], [data, reachable]);

  const relation = useMemo(() =>
    data && data.tree.ownerPersonId && personId
      ? computeRelation(personId, data.tree.ownerPersonId, data.relationships)
      : null,
    [data, personId]
  );

  if (!data || !root) return <div style={{padding:24}}>Загрузка…</div>;
  return (
    <div style={{minHeight:'calc(100dvh - var(--safe-top, 0px))',display:'flex',flexDirection:'column'}}>
      <header style={{padding:'10px 18px',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid var(--border)'}}>
        <button onClick={() => nav(`/trees/${treeId}`)} style={{width:34,height:34,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',border:'none',fontSize:15,fontWeight:800,boxShadow:'0 0 14px rgba(251,191,36,0.4)'}}>←</button>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:800}}>Семья: {root.firstName}</div>
          <Breadcrumbs items={[{ label: 'Моё дерево', onClick: () => nav(`/trees/${treeId}`) }, { label: root.firstName }]} />
        </div>
      </header>

      <div style={{flex:1,padding:'12px 12px 24px'}}>
        <FamilyTreeLayout
          persons={filteredPersons}
          relationships={filteredRels}
          ownerId={root.id}
        />
      </div>

      {relation && (
        <div style={{position:'fixed',bottom:18,right:18,fontSize:11,color:'var(--accent)',background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.3)',padding:'7px 11px',borderRadius:8,fontWeight:700,boxShadow:'0 4px 14px rgba(0,0,0,0.4)'}}>
          вы — {relation}<br/><span style={{fontSize:9,color:'var(--text-dim)',fontWeight:500}}>в этом дереве</span>
        </div>
      )}
    </div>
  );
};
