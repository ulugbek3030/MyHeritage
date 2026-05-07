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

/**
 * Human-figure silhouettes — adult/child × male/female.
 * Single solid shape per kind (no outlines), filled via currentColor so the
 * parent button tints by gender. Each variant has:
 *   • head with subtle jawline (not a perfect circle)
 *   • visible neck taper between head and shoulders
 *   • shoulders that slope organically into the torso
 *   • female variants add a hair frame that extends down past the shoulders
 *   • child variants have a larger head:body ratio (~1:1.4) for cuter proportions
 */
const Silhouette = ({ kind }: { kind: 'adult-male' | 'adult-female' | 'child-male' | 'child-female' }) => {
  switch (kind) {
    case 'adult-male':
      return (
        <svg viewBox="0 0 64 64" width="44" height="44" fill="currentColor" aria-hidden="true">
          {/* head: subtle jaw narrowing toward chin */}
          <path d="M 32 5 C 25 5, 22 10, 22 18 L 22 23 C 22 30, 26 33, 32 33 C 38 33, 42 30, 42 23 L 42 18 C 42 10, 39 5, 32 5 Z" />
          {/* visible neck + sloping shoulders + torso */}
          <path d="M 28 35 C 28 37, 26 37, 24 38 C 14 40, 6 46, 6 54 L 6 64 L 58 64 L 58 54 C 58 46, 50 40, 40 38 C 38 37, 36 37, 36 35 Z" />
        </svg>
      );
    case 'adult-female':
      return (
        <svg viewBox="0 0 64 64" width="44" height="44" fill="currentColor" aria-hidden="true">
          {/* hair: long, drops past shoulders to chest level on both sides */}
          <path d="M 32 3 C 21 3, 15 11, 15 21 L 15 36 C 15 41, 16 45, 18 48 L 18 64 L 24 64 L 24 50 C 24 47, 25 45, 27 44 L 37 44 C 39 45, 40 47, 40 50 L 40 64 L 46 64 L 46 48 C 48 45, 49 41, 49 36 L 49 21 C 49 11, 43 3, 32 3 Z" />
          {/* head with subtle jaw, sits inside the hair frame */}
          <path d="M 32 7 C 25 7, 22 12, 22 19 L 22 25 C 22 31, 26 34, 32 34 C 38 34, 42 31, 42 25 L 42 19 C 42 12, 39 7, 32 7 Z" />
          {/* neck + narrower shoulders + torso */}
          <path d="M 28 36 C 28 38, 26 38, 24 39 C 16 41, 10 47, 10 54 L 10 64 L 54 64 L 54 54 C 54 47, 48 41, 40 39 C 38 38, 36 38, 36 36 Z" />
        </svg>
      );
    case 'child-male':
      return (
        <svg viewBox="0 0 64 64" width="44" height="44" fill="currentColor" aria-hidden="true">
          {/* larger round head, soft chin */}
          <path d="M 32 5 C 23 5, 19 11, 19 21 L 19 27 C 19 35, 24 39, 32 39 C 40 39, 45 35, 45 27 L 45 21 C 45 11, 41 5, 32 5 Z" />
          {/* short neck + compact shoulders */}
          <path d="M 28 41 C 28 42, 27 42, 26 43 C 18 45, 14 50, 14 56 L 14 64 L 50 64 L 50 56 C 50 50, 46 45, 38 43 C 37 42, 36 42, 36 41 Z" />
        </svg>
      );
    case 'child-female':
      return (
        <svg viewBox="0 0 64 64" width="44" height="44" fill="currentColor" aria-hidden="true">
          {/* fuller hair frame around bigger child head, hair drops to shoulders */}
          <path d="M 32 4 C 21 4, 16 11, 16 22 L 16 36 C 16 41, 18 45, 20 48 L 20 64 L 25 64 L 25 52 C 25 50, 26 48, 28 47 L 36 47 C 38 48, 39 50, 39 52 L 39 64 L 44 64 L 44 48 C 46 45, 48 41, 48 36 L 48 22 C 48 11, 43 4, 32 4 Z" />
          {/* head sits inside hair frame */}
          <path d="M 32 9 C 24 9, 21 14, 21 22 L 21 28 C 21 35, 25 39, 32 39 C 39 39, 43 35, 43 28 L 43 22 C 43 14, 40 9, 32 9 Z" />
          {/* short neck + compact shoulders */}
          <path d="M 28 41 C 28 43, 26 43, 25 43 C 18 45, 14 50, 14 56 L 14 64 L 50 64 L 50 56 C 50 50, 46 45, 39 43 C 38 43, 36 43, 36 41 Z" />
        </svg>
      );
  }
};

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
                <div style={{ position: 'relative', width: 64, height: 64 }}>
                  <div
                    style={{
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
                      overflow: 'hidden',
                      color: o.gender === 'female' ? 'rgba(244,114,182,0.65)' : 'rgba(96,165,250,0.65)',
                    }}
                  >
                    <Silhouette kind={`${o.mode === 'child' ? 'child' : 'adult'}-${o.gender}` as 'adult-male' | 'adult-female' | 'child-male' | 'child-female'} />
                  </div>
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      bottom: -3,
                      right: -3,
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
                      pointerEvents: 'none',
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
