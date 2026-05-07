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

interface RoleOption {
  key: string;
  label: string;
  mode: Mode;
  gender: 'male' | 'female';
  visible: boolean;
}

export const AddPersonForm = ({ open, onClose, treeId, targetPerson, persons, relationships, onCreated }: Props) => {
  const [step, setStep] = useState<'select' | 'form'>('select');
  const [mode, setMode] = useState<Mode>('parent');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState(targetPerson.lastName ?? '');
  const [maidenName, setMaidenName] = useState('');
  const [year, setYear] = useState<string>('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const hasParents = useMemo(
    () => relationships.some((r) => r.category === 'parent_child' && r.person2Id === targetPerson.id),
    [relationships, targetPerson.id]
  );

  const existingParents = useMemo(
    () =>
      relationships
        .filter((r) => r.category === 'parent_child' && r.person2Id === targetPerson.id)
        .map((r) => persons.find((p) => p.id === r.person1Id))
        .filter(Boolean) as Person[],
    [relationships, persons, targetPerson.id]
  );

  const father = existingParents.find((p) => p.gender === 'male');
  const mother = existingParents.find((p) => p.gender === 'female');

  const middleName = mode !== 'parent' ? generateMiddleName(father?.firstName ?? null, gender) : '';

  const spouse: Person | undefined = useMemo(() => {
    const r = relationships.find(
      (rr) => rr.category === 'couple' && (rr.person1Id === targetPerson.id || rr.person2Id === targetPerson.id)
    );
    if (!r) return undefined;
    const otherId = r.person1Id === targetPerson.id ? r.person2Id : r.person1Id;
    return persons.find((p) => p.id === otherId);
  }, [relationships, persons, targetPerson.id]);

  const otherParent = existingParents.find((p) => p.gender !== gender);

  const targetFullName = [targetPerson.firstName, targetPerson.lastName, targetPerson.middleName]
    .filter(Boolean)
    .join(' ');

  const options: RoleOption[] = [
    { key: 'father', label: 'Добавить отца', mode: 'parent', gender: 'male', visible: !father },
    { key: 'mother', label: 'Добавить мать', mode: 'parent', gender: 'female', visible: !mother },
    { key: 'brother', label: 'Добавить брата', mode: 'sibling', gender: 'male', visible: hasParents },
    { key: 'sister', label: 'Добавить сестру', mode: 'sibling', gender: 'female', visible: hasParents },
    { key: 'son', label: 'Добавить сына', mode: 'child', gender: 'male', visible: true },
    { key: 'daughter', label: 'Добавить дочь', mode: 'child', gender: 'female', visible: true },
  ];

  const reset = () => {
    setFirstName('');
    setLastName(targetPerson.lastName ?? '');
    setMaidenName('');
    setYear('');
    setPhoto(null);
    setStep('select');
  };

  const pick = (m: Mode, g: 'male' | 'female') => {
    setMode(m);
    setGender(g);
    setStep('form');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

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
        maidenName: gender === 'female' ? maidenName.trim() || undefined : undefined,
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
      handleClose();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <BottomSheet open={open} onClose={handleClose}>
      {step === 'select' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <button
              onClick={handleClose}
              type="button"
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text)', fontSize: 16, cursor: 'pointer' }}
              aria-label="Закрыть"
            >
              ←
            </button>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>
              Добавьте родственника
              {targetFullName && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{targetFullName}</div>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, padding: '14px 4px 4px' }}>
            {options.filter((o) => o.visible).map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => pick(o.mode, o.gender)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 4px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(251,191,36,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(251,191,36,0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background:
                      o.gender === 'female'
                        ? 'linear-gradient(135deg, rgba(244,114,182,0.18), rgba(244,114,182,0.04))'
                        : 'linear-gradient(135deg, rgba(96,165,250,0.18), rgba(96,165,250,0.04))',
                    border: `1px solid ${o.gender === 'female' ? 'rgba(244,114,182,0.35)' : 'rgba(96,165,250,0.35)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                    color: o.gender === 'female' ? '#f472b6' : '#60a5fa',
                  }}
                >
                  {o.gender === 'female' ? '♀' : '♂'}
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                      color: '#0a0a0d',
                      fontSize: 14,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid var(--surface)',
                      boxShadow: '0 2px 8px rgba(251,191,36,0.4)',
                    }}
                  >
                    +
                  </span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>{o.label}</div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <button
              onClick={() => setStep('select')}
              type="button"
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text)', fontSize: 16, cursor: 'pointer' }}
              aria-label="Назад"
            >
              ←
            </button>
            <div style={{ flex: 1, fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>
              {options.find((o) => o.mode === mode && o.gender === gender)?.label ?? 'Добавить'}
            </div>
          </div>

          {mode === 'parent' && otherParent && (
            <div style={{ padding: '10px 12px', marginBottom: 14, borderRadius: 12, background: 'linear-gradient(180deg,#1c1409,#0e0a04)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 11, color: 'var(--text)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2 }}>Авто-couple</span>{' '}
              с <b>{otherParent.firstName}</b> ({otherParent.gender === 'male' ? 'отцом' : 'матерью'})
            </div>
          )}
          {mode === 'sibling' && existingParents.length > 0 && (
            <div style={{ padding: '10px 12px', marginBottom: 14, borderRadius: 12, background: 'linear-gradient(180deg,#1c1409,#0e0a04)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 11, color: 'var(--text)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2 }}>Общие родители</span>{' '}
              {existingParents.map((p) => p.firstName).join(' + ')}
            </div>
          )}
          {mode === 'child' && spouse && (
            <div style={{ padding: '10px 12px', marginBottom: 14, borderRadius: 12, background: 'linear-gradient(180deg,#1c1409,#0e0a04)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 11, color: 'var(--text)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2 }}>2-й родитель</span>{' '}
              <b>{spouse.firstName}</b>
            </div>
          )}

          <form onSubmit={onSubmit}>
            <input className="auth-input" placeholder="Имя" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
            <input className="auth-input" placeholder="Фамилия" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            {gender === 'female' && (
              <input className="auth-input" placeholder="Девичья фамилия" value={maidenName} onChange={(e) => setMaidenName(e.target.value)} />
            )}
            {middleName && <input className="auth-input" placeholder="Отчество" value={middleName} readOnly />}
            <input className="auth-input" placeholder="Год рождения" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="auth-input" />
            <button type="submit" disabled={busy || !firstName.trim()} className="auth-btn">
              {busy ? 'Сохранение…' : 'Добавить'}
            </button>
          </form>
        </>
      )}
    </BottomSheet>
  );
};
