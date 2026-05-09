import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFullTree } from '../api/trees';
import { deletePerson } from '../api/persons';
import type { FullTree, Person } from '../types';
import { FamilyTreeLayout } from '../components/tree/FamilyTreeLayout';
import { PersonSheet } from '../components/tree/PersonSheet';
import { AddPersonForm } from '../components/tree/AddPersonForm';
import { EditPersonForm } from '../components/tree/EditPersonForm';
import { BiographyEditor } from '../components/tree/BiographyEditor';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { reachableFromRoot, computeRelation } from '../utils/subfamilyTransform';

export const SubfamilyPage = () => {
  const { treeId, personId } = useParams<{ treeId: string; personId: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<FullTree | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [addOpen, setAddOpen] = useState<Person | null>(null);
  const [addPreset, setAddPreset] = useState<{ mode: 'parent'; gender: 'male' | 'female' } | null>(null);
  const [editOpen, setEditOpen] = useState<Person | null>(null);
  const [bioOpen, setBioOpen] = useState<Person | null>(null);
  const [deletePending, setDeletePending] = useState<Person | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { if (treeId) getFullTree(treeId).then(setData); }, [treeId]);

  const reload = () => { if (treeId) getFullTree(treeId).then(setData); };

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
        <button
          onClick={() => nav(-1)}
          aria-label="Назад"
          style={{width:34,height:34,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',border:'none',fontSize:15,fontWeight:800,boxShadow:'0 0 14px rgba(251,191,36,0.4)',cursor:'pointer'}}
        >←</button>
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

      {relation && (
        <div style={{position:'fixed',bottom:18,right:18,fontSize:11,color:'var(--accent)',background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.3)',padding:'7px 11px',borderRadius:8,fontWeight:700,boxShadow:'0 4px 14px rgba(0,0,0,0.4)'}}>
          вы — {relation}<br/><span style={{fontSize:9,color:'var(--text-dim)',fontWeight:500}}>в этом дереве</span>
        </div>
      )}
    </div>
  );
};
