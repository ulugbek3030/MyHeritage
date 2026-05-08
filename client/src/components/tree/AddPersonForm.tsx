import { useState, useMemo } from 'react';
import type { Person, Relationship } from '../../types';
import { createPerson, type CreatePersonInput } from '../../api/persons';
import { generateMiddleName } from '../../utils/uzNamings';
import { adjustSurnameForGender } from '../../utils/uzNamings';
import { BottomSheet } from '../ui/BottomSheet';
import { Silhouette, type SilhouetteKind } from '../ui/Silhouette';
import { DateWheelPicker } from '../ui/DateWheelPicker';
import '../../styles/form.css';

type Mode = 'parent' | 'sibling' | 'child' | 'spouse';

interface Props {
  open: boolean;
  onClose: () => void;
  treeId: string;
  targetPerson: Person;
  persons: Person[];
  relationships: Relationship[];
  onCreated: () => void;
  /**
   * If set, the form skips the role-picker step and opens directly on the
   * "fill details" step with the chosen mode + gender. Used when the user
   * clicks an "Add father" / "Add mother" placeholder above an existing
   * card — they've already chosen what they want to add.
   */
  presetRole?: { mode: Mode; gender: 'male' | 'female' };
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
  const [birthDate, setBirthDate] = useState<string>(''); // YYYY-MM-DD via <input type="date">
  const [year, setYear] = useState<string>('');           // year-only fallback
  const [isAlive, setIsAlive] = useState(true);
  const [deathDate, setDeathDate] = useState<string>('');
  const [deathYear, setDeathYear] = useState<string>('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [note, setNote] = useState<string>('');
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
    { key: 'partner', label: 'Добавить\nпартнёра', mode: 'spouse', gender: targetPerson.gender === 'male' ? 'female' : 'male', visible: true },
    { key: 'father', label: 'Добавить\nотца', mode: 'parent', gender: 'male', visible: !father },
    { key: 'mother', label: 'Добавить\nмать', mode: 'parent', gender: 'female', visible: !mother },
    { key: 'brother', label: 'Добавить\nбрата', mode: 'sibling', gender: 'male', visible: hasParents },
    { key: 'sister', label: 'Добавить\nсестру', mode: 'sibling', gender: 'female', visible: hasParents },
    { key: 'son', label: 'Добавить\nсына', mode: 'child', gender: 'male', visible: true },
    { key: 'daughter', label: 'Добавить\nдочь', mode: 'child', gender: 'female', visible: true },
  ];

  const reset = () => {
    setFirstName('');
    setLastName(targetPerson.lastName ?? '');
    setMaidenName('');
    setBirthDate('');
    setYear('');
    setIsAlive(true);
    setDeathDate('');
    setDeathYear('');
    setPhoto(null);
    setNote('');
    setStep('select');
  };

  const pick = (m: Mode, g: 'male' | 'female') => {
    setMode(m);
    setGender(g);
    // Smart surname defaults per role:
    //   • male sibling/child/father → inherits target's lastName
    //   • female sibling/daughter   → maidenName = target's lastName (born into family),
    //                                  lastName empty (filled if married)
    //   • female parent (mother)    → maidenName empty (unknown), lastName empty
    const tLast = targetPerson.lastName ?? '';
    if (g === 'male') {
      // Strip trailing "а" — Рустамова (target female) → Рустамов (new son).
      setLastName(adjustSurnameForGender(tLast, 'male'));
      setMaidenName('');
    } else if (m === 'parent') {
      setLastName('');
      setMaidenName('');
    } else {
      // Append "а" — Рустамов (target male) → Рустамова (new daughter's maiden).
      setMaidenName(adjustSurnameForGender(tLast, 'female'));
      setLastName('');
    }
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
      } else if (mode === 'spouse') {
        rels.push({ category: 'couple', otherPersonId: targetPerson.id, role: 'spouse', coupleStatus: 'married' });
      }

      // birthDate / deathDate are already ISO strings (YYYY-MM-DD) from
      // <input type="date">. If only year is provided, store as birthYear.
      const fullBirthDate = !!birthDate;
      const fullDeathDate = !!deathDate;
      const effectiveBirthYear = fullBirthDate
        ? Number(birthDate.split('-')[0])
        : (year ? Number(year) : undefined);
      const effectiveDeathYear = fullDeathDate
        ? Number(deathDate.split('-')[0])
        : (deathYear ? Number(deathYear) : undefined);

      // For unmarried women, lastName falls back to maidenName so display logic
      // (which prefers lastName) shows the right surname.
      const effectiveLastName = lastName.trim() || (gender === 'female' ? maidenName.trim() : '');

      const newPerson = await createPerson(treeId, {
        firstName: firstName.trim(),
        lastName: effectiveLastName || undefined,
        middleName: middleName || undefined,
        maidenName: gender === 'female' ? maidenName.trim() || undefined : undefined,
        gender,
        birthYear: effectiveBirthYear,
        birthDate: fullBirthDate ? birthDate : undefined,
        birthDateKnown: fullBirthDate,
        isAlive,
        deathYear: !isAlive ? effectiveDeathYear : undefined,
        deathDate: !isAlive && fullDeathDate ? deathDate : undefined,
        deathDateKnown: !isAlive && fullDeathDate,
        note: note.trim() || undefined,
        relationships: rels,
      });
      if (photo) {
        const { processAvatar, uploadPhoto } = await import('../../utils/imageProcessor');
        const blob = await processAvatar(photo);
        await uploadPhoto(treeId, newPerson.id, blob);
      }
      onCreated();
      handleClose();
    } catch (err) {
      console.error('[AddPerson] save failed', err);
      const msg = err instanceof Error ? err.message : 'неизвестная ошибка';
      alert(`Не удалось сохранить: ${msg}`);
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
            <div style={{ flex: 1, fontSize: 17, fontWeight: 800, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
              Добавьте родственника {targetFullName && <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{targetFullName}</span>}
            </div>
          </div>

          {(() => {
            // Two centred rows:
            //   • Row 1: partner + EITHER parents (if not yet added) OR siblings
            //     (if target already has parents). Siblings hidden when there are
            //     no parents to link to; parent options hidden once both exist.
            //   • Row 2: children.
            const visible = options.filter((o) => o.visible);
            const partner = visible.filter((o) => o.mode === 'spouse');
            const upperFamily = visible.filter((o) => o.mode === 'parent' || o.mode === 'sibling');
            const lower = visible.filter((o) => o.mode === 'child');
            const rows = [[...partner, ...upperFamily], lower].filter((r) => r.length > 0);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 40, padding: '28px 4px 16px' }}>
                {rows.map((row, ri) => (
                  <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
                    {row.map((o) => {
              const accent = o.gender === 'female' ? 'rgba(244,114,182,0.65)' : 'rgba(96,165,250,0.65)';
              const ring = o.gender === 'female' ? 'rgba(244,114,182,0.3)' : 'rgba(96,165,250,0.3)';
              const wash = o.gender === 'female'
                ? 'linear-gradient(135deg, rgba(244,114,182,0.14), rgba(244,114,182,0.03))'
                : 'linear-gradient(135deg, rgba(96,165,250,0.14), rgba(96,165,250,0.03))';
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => pick(o.mode, o.gender)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    padding: '6px 0',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ position: 'relative', width: 80, height: 80 }}>
                    <div
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: wash,
                        border: `1px solid ${ring}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        color: accent,
                      }}
                    >
                      <Silhouette kind={(o.mode === 'parent' ? 'older' : o.mode === 'child' ? 'child' : 'adult') + '-' + o.gender as SilhouetteKind} />
                    </div>
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                        color: '#0a0a0d',
                        fontSize: 18,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid var(--surface)',
                        boxShadow: '0 2px 10px rgba(251,191,36,0.45)',
                        pointerEvents: 'none',
                      }}
                    >
                      +
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', lineHeight: 1.25, whiteSpace: 'pre-line' }}>{o.label}</div>
                </button>
              );
            })}
                  </div>
                ))}
              </div>
            );
          })()}
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
            {/* Gender override (role pre-selects, but user can flip if mistake) */}
            <div style={{ display: 'flex', gap: 18, marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input type="radio" name="gender" checked={gender === 'male'} onChange={() => setGender('male')} style={{ accentColor: 'var(--accent)' }} />
                Мужчина
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input type="radio" name="gender" checked={gender === 'female'} onChange={() => setGender('female')} style={{ accentColor: 'var(--accent)' }} />
                Женщина
              </label>
            </div>

            <input className="auth-input" placeholder="Имя" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />

            {gender === 'female' && (
              <input className="auth-input" placeholder="Девичья фамилия" value={maidenName} onChange={(e) => setMaidenName(e.target.value)} />
            )}
            <input
              className="auth-input"
              placeholder={gender === 'female' ? 'Фамилия (если другая после замужества)' : 'Фамилия'}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            {middleName && <input className="auth-input" placeholder="Отчество" value={middleName} readOnly />}

            {/* Birth date — custom wheel-picker (iPhone-style spinners). */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: 0.2 }}>Дата рождения</div>
            <DateWheelPicker
              value={birthDate}
              onChange={(iso) => { setBirthDate(iso); if (iso) setYear(''); }}
            />
            {!birthDate && (
              <input
                className="auth-input"
                placeholder="Или только год (1985)"
                inputMode="numeric"
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            )}

            {/* Alive / Deceased toggle */}
            <div style={{ display: 'flex', gap: 18, marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input type="radio" name="alive" checked={isAlive} onChange={() => setIsAlive(true)} style={{ accentColor: 'var(--accent)' }} />
                {gender === 'female' ? 'Жива' : 'Жив'}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input type="radio" name="alive" checked={!isAlive} onChange={() => setIsAlive(false)} style={{ accentColor: 'var(--accent)' }} />
                {gender === 'female' ? 'Умерла' : 'Умер'}
              </label>
            </div>

            {!isAlive && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: 0.2 }}>Дата смерти</div>
                <DateWheelPicker
                  value={deathDate}
                  onChange={(iso) => { setDeathDate(iso); if (iso) setDeathYear(''); }}
                />
                {!deathDate && (
                  <input
                    className="auth-input"
                    placeholder="Или только год (2010)"
                    inputMode="numeric"
                    value={deathYear}
                    onChange={(e) => setDeathYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                )}
              </>
            )}

            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: 0.2 }}>Короткое описание</div>
            <textarea
              className="auth-input"
              placeholder="Чем занимается, где работает, любимое блюдо…"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ resize: 'vertical', minHeight: 70, fontFamily: 'inherit', lineHeight: 1.4 }}
            />

            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: 0.2 }}>Фото</div>
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
