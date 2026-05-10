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
import { Loader } from '../components/ui/Loader';
import { TreeSearch } from '../components/tree/TreeSearch';
import { BottomSheet } from '../components/ui/BottomSheet';

export const TreeViewPage = () => {
  const { treeId } = useParams<{ treeId: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<FullTree | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [addOpen, setAddOpen] = useState<Person | null>(null);
  // When set, AddPersonForm skips the role-picker step and lands directly on
  // the form (used by the "Add father" / "Add mother" placeholders above
  // parentless cards).
  const [addPreset, setAddPreset] = useState<{ mode: 'parent'; gender: 'male' | 'female' } | null>(null);
  const [editOpen, setEditOpen] = useState<Person | null>(null);
  // window.confirm is blocked in Click's WebView, so deletion uses a custom
  // BottomSheet confirm rendered below.
  const [deletePending, setDeletePending] = useState<Person | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bioOpen, setBioOpen] = useState<Person | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  // Tracks any active fetch (initial load or post-mutation reload). Used to
  // show the Loader overlay so the user has feedback during the network +
  // re-layout cycle that can otherwise look like a frozen screen.
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!treeId) return;
    setBusy(true);
    getFullTree(treeId).then(setData).finally(() => setBusy(false));
  }, [treeId]);

  useEffect(() => {
    if (!treeId) return;
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 90 * 86400000).toISOString();
    listEvents(treeId, from, to).then(setEvents).catch(() => {});
  }, [treeId]);

  const reload = () => {
    if (!treeId) return;
    setBusy(true);
    getFullTree(treeId).then(setData).finally(() => setBusy(false));
  };

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
      <header style={{padding:'0 18px 16px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid var(--border)'}}>
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
          onPlusClick={(id) => { const p = data.persons.find((p) => p.id === id); if (p) { setAddPreset(null); setAddOpen(p); } }}
          onAddParent={(id, gender) => {
            const p = data.persons.find((pp) => pp.id === id);
            if (!p) return;
            setAddPreset({ mode: 'parent', gender });
            setAddOpen(p);
          }}
          onDiveSubfamily={(id) => nav(`/trees/${treeId}/dive/${id}`)}
        />
      </div>
      <PersonSheet
        open={!!selectedPerson}
        onClose={() => setSelectedPerson(null)}
        person={selectedPerson}
        isOwner={!!selectedPerson && selectedPerson.id === data.tree.ownerPersonId}
        onEdit={() => { if (selectedPerson) { setEditOpen(selectedPerson); setSelectedPerson(null); } }}
        onEditBio={() => { if (selectedPerson) { setBioOpen(selectedPerson); setSelectedPerson(null); } }}
        onAdd={() => { if (selectedPerson) { setAddOpen(selectedPerson); setSelectedPerson(null); } }}
        onDelete={() => {
          if (!selectedPerson) return;
          setDeletePending(selectedPerson);
          setSelectedPerson(null);
        }}
      />
      {addOpen && (
        <AddPersonForm
          open
          onClose={() => { setAddOpen(null); setAddPreset(null); }}
          treeId={treeId!}
          targetPerson={addOpen}
          persons={data.persons}
          relationships={data.relationships}
          onCreated={reload}
          presetRole={addPreset ?? undefined}
        />
      )}
      {editOpen && (
        <EditPersonForm
          open
          onClose={() => setEditOpen(null)}
          treeId={treeId!}
          person={editOpen}
          persons={data.persons}
          relationships={data.relationships}
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
      <Loader visible={busy} label="Загружаем дерево…" />
      {deletePending && (() => {
        const fullName = [deletePending.firstName, deletePending.lastName].filter(Boolean).join(' ');
        const close = () => { if (!deleting) setDeletePending(null); };
        const confirm = async () => {
          if (!treeId || !deletePending) return;
          setDeleting(true);
          try {
            await deletePerson(treeId, deletePending.id);
            setDeletePending(null);
            reload();
          } catch (e) {
            console.error('[delete] failed', e);
            const msg = e instanceof Error ? e.message : 'неизвестная ошибка';
            alert(`Не удалось удалить: ${msg}`);
          } finally { setDeleting(false); }
        };
        return (
          <BottomSheet open onClose={close}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, padding: '24px 8px 8px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Удалить {fullName}?</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 320 }}>
                Все связи с этим человеком тоже будут удалены. Действие необратимо.
              </div>
              <button
                onClick={confirm}
                disabled={deleting}
                style={{ width: '100%', padding: 14, marginTop: 12, background: '#f87171', color: '#0a0a0d', border: 'none', borderRadius: 14, fontWeight: 800, fontSize: 16, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? 'Удаление…' : 'Удалить'}
              </button>
              <button
                onClick={close}
                disabled={deleting}
                style={{ width: '100%', padding: 14, background: 'rgba(255,255,255,0.04)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: deleting ? 'not-allowed' : 'pointer' }}
              >
                Отмена
              </button>
            </div>
          </BottomSheet>
        );
      })()}
    </div>
  );
};
