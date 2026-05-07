import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFullTree } from '../api/trees';
import { listEvents } from '../api/events';
import type { FullTree, Person, FamilyEvent } from '../types';
import { FamilyTreeLayout } from '../components/tree/FamilyTreeLayout';
import { PersonSheet } from '../components/tree/PersonSheet';
import { AddPersonForm } from '../components/tree/AddPersonForm';
import { ShareModal } from '../components/share/ShareModal';
import { Hero } from '../components/home/Hero';
import { NudgeProgress } from '../components/home/NudgeProgress';
import { QuickActions } from '../components/home/QuickActions';
import { FAB } from '../components/home/FAB';

export const TreeViewPage = () => {
  const { treeId } = useParams<{ treeId: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<FullTree | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [addOpen, setAddOpen] = useState<Person | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [events, setEvents] = useState<FamilyEvent[]>([]);

  useEffect(() => { if (treeId) getFullTree(treeId).then(setData); }, [treeId]);

  useEffect(() => {
    if (!treeId) return;
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 90 * 86400000).toISOString();
    listEvents(treeId, from, to).then(setEvents).catch(() => {});
  }, [treeId]);

  const reload = () => { if (treeId) getFullTree(treeId).then(setData); };

  if (!data) return <div style={{padding:24}}>Загрузка дерева…</div>;

  const upcoming = events.filter((e) => e.daysUntil >= 0).sort((a, b) => a.daysUntil - b.daysUntil)[0] ?? null;
  const pct = Math.min(100, Math.round((data.persons.length / 45) * 100));

  return (
    <div style={{minHeight:'100dvh',display:'flex',flexDirection:'column'}}>
      <header style={{padding:'16px 18px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid var(--border)'}}>
        <button onClick={() => nav('/')} style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text)'}}>←</button>
        <div style={{flex:1,fontSize:17,fontWeight:800}}>{data.tree.name}</div>
        <button onClick={() => nav(`/trees/${treeId}/full`)} style={{fontSize:12,color:'var(--accent)',background:'transparent',border:'none'}}>Полное →</button>
        <button onClick={() => setShareOpen(true)} style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',border:'none',color:'#0a0a0d',fontWeight:800,fontSize:14,marginLeft:6}}>⤴</button>
      </header>
      <Hero
        event={upcoming}
        onOpenCta={() => upcoming?.personId && setSelectedPerson(data.persons.find((p) => p.id === upcoming.personId) ?? null)}
      />
      <NudgeProgress pct={pct} hint={data.persons.length < 13 ? '+ бабушка раскроет 6 родственников' : '+ дядя по матери раскроет ещё ветку'} />
      <div style={{padding:'12px 12px 24px',flex:1}}>
        <FamilyTreeLayout
          persons={data.persons}
          relationships={data.relationships}
          ownerId={data.tree.ownerPersonId}
          onPersonClick={(id) => setSelectedPerson(data.persons.find((p) => p.id === id) ?? null)}
          onPlusClick={(id) => { const p = data.persons.find((p) => p.id === id); if (p) setAddOpen(p); }}
        />
      </div>
      <QuickActions
        onCalendar={() => nav(`/trees/${treeId}/calendar`)}
        onShare={() => setShareOpen(true)}
        onGifts={() => alert('История подарков — Phase 2')}
        eventCount={events.length}
      />
      <FAB onClick={() => data.tree.ownerPersonId && setAddOpen(data.persons.find((p) => p.id === data.tree.ownerPersonId) ?? null)} />
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
