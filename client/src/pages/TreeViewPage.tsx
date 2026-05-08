import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFullTree } from '../api/trees';
import { deletePerson } from '../api/persons';
import { listEvents } from '../api/events';
import type { FullTree, Person, FamilyEvent } from '../types';
import { eventIcon } from '../utils/eventIcons';
import { FamilyTreeLayout } from '../components/tree/FamilyTreeLayout';
import { PersonSheet } from '../components/tree/PersonSheet';
import { AddPersonForm } from '../components/tree/AddPersonForm';
import { EditPersonForm } from '../components/tree/EditPersonForm';
import { BiographyEditor } from '../components/tree/BiographyEditor';
import { ShareModal } from '../components/share/ShareModal';
import { QuickActions } from '../components/home/QuickActions';
import { Skeleton } from '../components/ui/Skeleton';
import { TreeSearch } from '../components/tree/TreeSearch';

export const TreeViewPage = () => {
  const { treeId } = useParams<{ treeId: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<FullTree | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [addOpen, setAddOpen] = useState<Person | null>(null);
  const [editOpen, setEditOpen] = useState<Person | null>(null);
  const [bioOpen, setBioOpen] = useState<Person | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => { if (treeId) getFullTree(treeId).then(setData); }, [treeId]);

  useEffect(() => {
    if (!treeId) return;
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 90 * 86400000).toISOString();
    listEvents(treeId, from, to).then(setEvents).catch(() => {});
  }, [treeId]);

  const reload = () => { if (treeId) getFullTree(treeId).then(setData); };

  // Per-person distinct icons for events in the current calendar month, so the
  // tree mirrors the calendar's month view: a person with two events in the
  // month gets two icons stacked next to their card.
  const personEventIcons = useMemo<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    const month = new Date().getMonth();
    const push = (id: string, icon: string) => {
      const arr = out[id] ?? (out[id] = []);
      if (!arr.includes(icon)) arr.push(icon);
    };
    for (const e of events) {
      if (new Date(e.date).getMonth() !== month) continue;
      const icon = eventIcon(e.type);
      if (e.personId) push(e.personId, icon);
      if (e.personIds) for (const id of e.personIds) push(id, icon);
    }
    return out;
  }, [events]);

  if (!data) return (
    <div style={{padding:24,display:'flex',flexDirection:'column',gap:8}}>
      <Skeleton height={48} radius={14} />
      <Skeleton height={120} radius={14} />
      <Skeleton height={300} radius={14} />
    </div>
  );


  return (
    <div style={{minHeight:'calc(100dvh - var(--safe-top, 0px))',display:'flex',flexDirection:'column'}}>
      <header style={{padding:'16px 18px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid var(--border)'}}>
        <button onClick={() => nav('/')} style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text)'}}>←</button>
        <div style={{flex:1,fontSize:17,fontWeight:800}}>{data.tree.name}</div>
        <button onClick={() => setSearchOpen(true)} aria-label="Поиск" style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text)',marginLeft:6,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
        <button onClick={() => setShareOpen(true)} style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',border:'none',color:'#0a0a0d',fontWeight:800,fontSize:14,marginLeft:6}}>⤴</button>
      </header>
      <QuickActions
        onCalendar={() => nav(`/trees/${treeId}/calendar`)}
        onShare={() => setShareOpen(true)}
        eventCount={events.length}
      />
      <div style={{padding:'24px 12px 24px',flex:1}}>
        <FamilyTreeLayout
          persons={data.persons}
          relationships={data.relationships}
          ownerId={data.tree.ownerPersonId}
          personEventIcons={personEventIcons}
          onPersonClick={(id) => setSelectedPerson(data.persons.find((p) => p.id === id) ?? null)}
          onPlusClick={(id) => { const p = data.persons.find((p) => p.id === id); if (p) setAddOpen(p); }}
        />
      </div>
      <PersonSheet
        open={!!selectedPerson}
        onClose={() => setSelectedPerson(null)}
        person={selectedPerson}
        onEdit={() => { if (selectedPerson) { setEditOpen(selectedPerson); setSelectedPerson(null); } }}
        onEditBio={() => { if (selectedPerson) { setBioOpen(selectedPerson); setSelectedPerson(null); } }}
        onAdd={() => { if (selectedPerson) { setAddOpen(selectedPerson); setSelectedPerson(null); } }}
        onDelete={async () => {
          if (!selectedPerson || !treeId) return;
          const fullName = [selectedPerson.firstName, selectedPerson.lastName].filter(Boolean).join(' ');
          if (!window.confirm(`Удалить ${fullName}? Все связи с этим человеком тоже будут удалены. Действие необратимо.`)) return;
          await deletePerson(treeId, selectedPerson.id);
          setSelectedPerson(null);
          reload();
        }}
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
      {editOpen && (
        <EditPersonForm
          open
          onClose={() => setEditOpen(null)}
          treeId={treeId!}
          person={editOpen}
          onSaved={reload}
        />
      )}
      {bioOpen && (
        <BiographyEditor
          open
          onClose={() => setBioOpen(null)}
          treeId={treeId!}
          person={bioOpen}
          onSaved={reload}
        />
      )}
      {shareOpen && <ShareModal open onClose={() => setShareOpen(false)} treeId={treeId!} existingToken={data.tree.shareToken} />}
      {searchOpen && <TreeSearch persons={data.persons} onSelect={(id) => { document.querySelector(`[data-person-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} onClose={() => setSearchOpen(false)} />}
    </div>
  );
};
