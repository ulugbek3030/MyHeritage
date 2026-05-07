import { useState, useMemo } from 'react';
import type { Person, Relationship } from '../../types';
import { createPerson, type CreatePersonInput } from '../../api/persons';
import { generateMiddleName } from '../../utils/uzNamings';
import { BottomSheet } from '../ui/BottomSheet';
import '../../styles/form.css';

type Mode = 'parent' | 'sibling' | 'child';

interface Props {
  open: boolean;
  onClose: () => void;
  treeId: string;
  targetPerson: Person;
  persons: Person[];
  relationships: Relationship[];
  onCreated: () => void;
}

export const AddPersonForm = ({ open, onClose, treeId, targetPerson, persons, relationships, onCreated }: Props) => {
  const [mode, setMode] = useState<Mode>('parent');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState(targetPerson.lastName ?? '');
  const [maidenName, setMaidenName] = useState('');
  const [year, setYear] = useState<string>('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const hasParents = useMemo(() =>
    relationships.some((r) => r.category === 'parent_child' && r.person2Id === targetPerson.id),
    [relationships, targetPerson.id]
  );

  const existingParents = useMemo(() =>
    relationships
      .filter((r) => r.category === 'parent_child' && r.person2Id === targetPerson.id)
      .map((r) => persons.find((p) => p.id === r.person1Id))
      .filter(Boolean) as Person[],
    [relationships, persons, targetPerson.id]
  );

  const father = existingParents.find((p) => p.gender === 'male');
  const middleName = mode !== 'parent' ? generateMiddleName(father?.firstName ?? null, gender) : '';

  // Clean spouse derivation (the plan's `.let && ` was a typo)
  const spouse: Person | undefined = useMemo(() => {
    const r = relationships.find((rr) => rr.category === 'couple' && (rr.person1Id === targetPerson.id || rr.person2Id === targetPerson.id));
    if (!r) return undefined;
    const otherId = r.person1Id === targetPerson.id ? r.person2Id : r.person1Id;
    return persons.find((p) => p.id === otherId);
  }, [relationships, persons, targetPerson.id]);

  const otherParent = existingParents.find((p) => p.gender !== gender);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const rels: NonNullable<CreatePersonInput['relationships']> = [];

      if (mode === 'parent') {
        rels.push({ category: 'parent_child', otherPersonId: targetPerson.id, role: 'parent', childRelation: 'biological' });
        if (otherParent) rels.push({ category: 'couple', otherPersonId: otherParent.id, role: 'spouse', coupleStatus: 'married' });
      } else if (mode === 'sibling') {
        for (const p of existingParents) {
          rels.push({ category: 'parent_child', otherPersonId: p.id, role: 'child', childRelation: 'biological' });
        }
      } else if (mode === 'child') {
        rels.push({ category: 'parent_child', otherPersonId: targetPerson.id, role: 'child', childRelation: 'biological' });
        if (spouse) rels.push({ category: 'parent_child', otherPersonId: spouse.id, role: 'child', childRelation: 'biological' });
      }

      const newPerson = await createPerson(treeId, {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        middleName: middleName || undefined,
        maidenName: gender === 'female' ? (maidenName.trim() || undefined) : undefined,
        gender,
        birthYear: year ? Number(year) : undefined,
        relationships: rels,
      });
      if (photo) {
        const { processAvatar, uploadPhoto } = await import('../../utils/imageProcessor');
        const blob = await processAvatar(photo);
        await uploadPhoto(treeId, newPerson.id, blob);
      }
      onCreated();
      onClose();
    } finally { setBusy(false); }
  };

  if (!open) return null;
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{fontSize:18,fontWeight:800,marginBottom:14}}>Добавить родственника</div>

      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
        {(['parent', hasParents ? 'sibling' : null, 'child'].filter(Boolean) as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{padding:'8px 14px',borderRadius:14,border:`1px solid ${mode===m?'rgba(251,191,36,0.4)':'var(--border)'}`,background:mode===m?'rgba(251,191,36,0.12)':'rgba(255,255,255,0.04)',color:mode===m?'var(--accent)':'var(--text)',fontWeight:700,fontSize:12}}>
            {m === 'parent' ? 'Родитель' : m === 'sibling' ? 'Брат / Сестра' : 'Ребёнок'}
          </button>
        ))}
      </div>

      <div style={{display:'flex',gap:8,marginBottom:14}}>
        <button type="button" onClick={() => setGender('male')} style={{flex:1,padding:'10px',borderRadius:12,border:`1px solid ${gender==='male'?'rgba(96,165,250,0.5)':'var(--border)'}`,background:gender==='male'?'rgba(96,165,250,0.1)':'rgba(255,255,255,0.04)',color:'var(--text)',fontWeight:700}}>♂ {mode==='parent'?'Отец':mode==='sibling'?'Брат':'Сын'}</button>
        <button type="button" onClick={() => setGender('female')} style={{flex:1,padding:'10px',borderRadius:12,border:`1px solid ${gender==='female'?'rgba(244,114,182,0.5)':'var(--border)'}`,background:gender==='female'?'rgba(244,114,182,0.1)':'rgba(255,255,255,0.04)',color:'var(--text)',fontWeight:700}}>♀ {mode==='parent'?'Мать':mode==='sibling'?'Сестра':'Дочь'}</button>
      </div>

      {(mode === 'parent' && otherParent) && (
        <div style={{padding:'10px 12px',marginBottom:14,borderRadius:12,background:'linear-gradient(180deg,#1c1409,#0e0a04)',border:'1px solid rgba(251,191,36,0.25)',fontSize:11,color:'var(--text)'}}>
          <span style={{color:'var(--accent)',fontWeight:800,fontSize:9,textTransform:'uppercase',letterSpacing:1.2}}>Авто-couple</span>{' '}
          с <b>{otherParent.firstName}</b> ({otherParent.gender === 'male' ? 'отцом' : 'матерью'})
        </div>
      )}
      {(mode === 'sibling' && existingParents.length > 0) && (
        <div style={{padding:'10px 12px',marginBottom:14,borderRadius:12,background:'linear-gradient(180deg,#1c1409,#0e0a04)',border:'1px solid rgba(251,191,36,0.25)',fontSize:11,color:'var(--text)'}}>
          <span style={{color:'var(--accent)',fontWeight:800,fontSize:9,textTransform:'uppercase',letterSpacing:1.2}}>Общие родители</span>{' '}
          {existingParents.map((p) => p.firstName).join(' + ')}
        </div>
      )}
      {(mode === 'child' && spouse) && (
        <div style={{padding:'10px 12px',marginBottom:14,borderRadius:12,background:'linear-gradient(180deg,#1c1409,#0e0a04)',border:'1px solid rgba(251,191,36,0.25)',fontSize:11,color:'var(--text)'}}>
          <span style={{color:'var(--accent)',fontWeight:800,fontSize:9,textTransform:'uppercase',letterSpacing:1.2}}>2-й родитель</span>{' '}
          <b>{spouse.firstName}</b>
        </div>
      )}

      <form onSubmit={onSubmit}>
        <input className="auth-input" placeholder="Имя" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input className="auth-input" placeholder="Фамилия" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        {gender === 'female' && <input className="auth-input" placeholder="Девичья фамилия" value={maidenName} onChange={(e) => setMaidenName(e.target.value)} />}
        {middleName && <input className="auth-input" placeholder="Отчество" value={middleName} readOnly />}
        <input className="auth-input" placeholder="Год рождения" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="auth-input" />
        <button type="submit" disabled={busy || !firstName.trim()} className="auth-btn">{busy ? 'Сохранение…' : 'Добавить'}</button>
      </form>
    </BottomSheet>
  );
};
