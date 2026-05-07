import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFullTree } from '../api/trees';
import type { FullTree, Person } from '../types';
import { FamilyTreeLayout } from '../components/tree/FamilyTreeLayout';
import { PersonSheet } from '../components/tree/PersonSheet';
import { AddPersonForm } from '../components/tree/AddPersonForm';
import { ShareModal } from '../components/share/ShareModal';

export const TreeViewPage = () => {
  const { treeId } = useParams<{ treeId: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<FullTree | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [addOpen, setAddOpen] = useState<Person | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => { if (treeId) getFullTree(treeId).then(setData); }, [treeId]);

  const reload = () => { if (treeId) getFullTree(treeId).then(setData); };

  if (!data) return <div style={{padding:24}}>Загрузка дерева…</div>;

  return (
    <div style={{minHeight:'100dvh',display:'flex',flexDirection:'column'}}>
      <header style={{padding:'16px 18px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid var(--border)'}}>
        <button onClick={() => nav('/')} style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text)'}}>←</button>
        <div style={{flex:1,fontSize:17,fontWeight:800}}>{data.tree.name}</div>
        <button onClick={() => nav(`/trees/${treeId}/full`)} style={{fontSize:12,color:'var(--accent)',background:'transparent',border:'none'}}>Полное →</button>
        <button onClick={() => setShareOpen(true)} style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',border:'none',color:'#0a0a0d',fontWeight:800,fontSize:14,marginLeft:6}}>⤴</button>
      </header>
      <div style={{padding:'12px 12px 24px',flex:1}}>
        <FamilyTreeLayout
          persons={data.persons}
          relationships={data.relationships}
          ownerId={data.tree.ownerPersonId}
          onPersonClick={(id) => setSelectedPerson(data.persons.find((p) => p.id === id) ?? null)}
          onPlusClick={(id) => { const p = data.persons.find((p) => p.id === id); if (p) setAddOpen(p); }}
        />
      </div>
      <PersonSheet
        open={!!selectedPerson}
        onClose={() => setSelectedPerson(null)}
        person={selectedPerson}
        onEdit={() => {}}
        onAdd={() => { if (selectedPerson) { setAddOpen(selectedPerson); setSelectedPerson(null); } }}
        onDelete={() => {}}
      />
      {addOpen && (
        <AddPersonForm
          open
          onClose={() => setAddOpen(null)}
          treeId={treeId!}
          targetPerson={addOpen}
          persons={data.persons}
          relationships={data.relationships}
          onCreated={reload}
        />
      )}
      {shareOpen && <ShareModal open onClose={() => setShareOpen(false)} treeId={treeId!} existingToken={data.tree.shareToken} />}
    </div>
  );
};
