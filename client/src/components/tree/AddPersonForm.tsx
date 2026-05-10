import { useEffect, useMemo, useRef, useState } from 'react';
import type { Person, Relationship } from '../../types';
import { createPerson, type CreatePersonInput } from '../../api/persons';
import { generateMiddleName } from '../../utils/uzNamings';
import { adjustSurnameForGender } from '../../utils/uzNamings';
import { MARITAL_STATUSES } from '../../utils/maritalStatus';
import { BottomSheet } from '../ui/BottomSheet';
import { Silhouette, type SilhouetteKind } from '../ui/Silhouette';
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


export const AddPersonForm = ({ open, onClose, treeId, targetPerson, persons, relationships, onCreated, presetRole }: Props) => {
  // Mirror what `pick()` would compute for a given (mode, gender) so a presetRole
  // arrives with the same smart-surname defaults a manual click would set.
  //   • female parent (mother placeholder)   → lastName = target's surname
  //                                            adjusted to feminine ("Рустамов" → "Рустамова").
  //                                            maidenName empty.
  //   • female spouse                        → same as mother (wife takes
  //                                            husband's surname).
  //   • male parent (father placeholder)     → lastName = target's surname
  //                                            adjusted to masculine.
  //   • female non-parent / non-spouse       → maidenName = feminine form,
  //                                            lastName empty.
  const tLast = targetPerson.lastName ?? '';
  const presetLastName = presetRole
    ? (presetRole.gender === 'male'
        ? adjustSurnameForGender(tLast, 'male')
        : (presetRole.mode === 'parent' || presetRole.mode === 'spouse')
          ? adjustSurnameForGender(tLast, 'female')
          : '')
    : tLast;
  const presetMaidenName = presetRole && presetRole.gender === 'female' && presetRole.mode !== 'parent' && presetRole.mode !== 'spouse'
    ? adjustSurnameForGender(tLast, 'female')
    : '';

  const [step, setStep] = useState<'select' | 'form'>(presetRole ? 'form' : 'select');
  const [mode, setMode] = useState<Mode>(presetRole?.mode ?? 'parent');
  const [gender, setGender] = useState<'male' | 'female'>(presetRole?.gender ?? 'male');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState(presetLastName);
  const [maidenName, setMaidenName] = useState(presetMaidenName);
  // birthType / deathType pick which of the three input modes is shown:
  //   'date'    — full YYYY-MM-DD picker (default)
  //   'year'    — year-only fallback
  //   'unknown' — no input, dates left blank
  const [birthType, setBirthType] = useState<'date' | 'year' | 'unknown'>('date');
  const [birthDate, setBirthDate] = useState<string>(''); // YYYY-MM-DD via <input type="date">
  const [year, setYear] = useState<string>('');           // year-only fallback
  const [isAlive, setIsAlive] = useState(true);
  const [deathType, setDeathType] = useState<'date' | 'year' | 'unknown'>('date');
  const [deathDate, setDeathDate] = useState<string>('');
  const [deathYear, setDeathYear] = useState<string>('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [note, setNote] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [maritalStatus, setMaritalStatus] = useState<string>('');
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

  const spouses: Person[] = useMemo(() => {
    return relationships
      .filter((rr) => rr.category === 'couple' && (rr.person1Id === targetPerson.id || rr.person2Id === targetPerson.id))
      .map((rr) => {
        const otherId = rr.person1Id === targetPerson.id ? rr.person2Id : rr.person1Id;
        return persons.find((p) => p.id === otherId);
      })
      .filter(Boolean) as Person[];
  }, [relationships, persons, targetPerson.id]);
  // The first partner is treated as the canonical "spouse" for the auto-fill
  // hints (middle name from spouse's father, etc). When the user is adding
  // a child, the actual second-parent link is chosen via secondParentId
  // below — defaults to the first partner but can be re-selected when
  // target has multiple.
  const spouse: Person | undefined = spouses[0];

  const [secondParentId, setSecondParentId] = useState<string | null>(spouses[0]?.id ?? null);
  // Re-derive when target changes (different person → different spouse list).
  useEffect(() => {
    setSecondParentId(spouses[0]?.id ?? null);
  }, [targetPerson.id, spouses]);

  const otherParent = existingParents.find((p) => p.gender !== gender);

  // The new person's middleName is built from THEIR father's first name, not
  // targetPerson's father. Cases:
  //   parent: new person IS a parent — no source on hand, leave blank.
  //   sibling: shares targetPerson's father → use that father's name.
  //   child: new person's father is targetPerson (if targetPerson is male)
  //     or targetPerson's male spouse (if targetPerson is female).
  //   spouse: their actual father is rarely in this tree → leave blank for
  //     the user to type.
  const middleNameSource: string | null =
    mode === 'sibling' ? father?.firstName ?? null
    : mode === 'child' ? (
        targetPerson.gender === 'male' ? targetPerson.firstName
        : spouse?.gender === 'male' ? spouse.firstName
        : null
      )
    : null;
  const [middleName, setMiddleName] = useState<string>(generateMiddleName(middleNameSource, gender));
  // Re-derive when the role/gender flips so the user gets sensible defaults
  // each time, but keeps any manual edits within a single role visit.
  const lastAutoKey = useRef<string>(`${mode}|${gender}|${middleNameSource ?? ''}`);
  useEffect(() => {
    const key = `${mode}|${gender}|${middleNameSource ?? ''}`;
    if (lastAutoKey.current !== key) {
      lastAutoKey.current = key;
      setMiddleName(generateMiddleName(middleNameSource, gender));
    }
  }, [mode, gender, middleNameSource]);

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
    // Re-apply the same surname defaults the form opened with so a presetRole
    // (e.g. "Add father") doesn't lose its computed surname on close+reopen.
    setLastName(presetLastName);
    setMaidenName(presetMaidenName);
    setMiddleName(generateMiddleName(middleNameSource, gender));
    setBirthType('date');
    setBirthDate('');
    setYear('');
    setIsAlive(true);
    setDeathType('date');
    setDeathDate('');
    setDeathYear('');
    setPhoto(null);
    setNote('');
    setAddress('');
    setPhone('');
    setMaritalStatus('');
    // When opened with a presetRole the role-picker step is bypassed entirely;
    // skipping back to it would land the user on a meaningless screen.
    setStep(presetRole ? 'form' : 'select');
  };

  const pick = (m: Mode, g: 'male' | 'female') => {
    // Adding a child without a father: the kid would have no father field
    // populated. Block and prompt the user to add the partner first.
    if (m === 'child') {
      const fatherCandidate =
        targetPerson.gender === 'male' ? targetPerson : spouses.find((s) => s.gender === 'male');
      if (!fatherCandidate) {
        alert(`Сначала добавьте отца для ${targetPerson.firstName} — у ребёнка должен быть указан отец.`);
        return;
      }
    }
    setMode(m);
    setGender(g);
    // Smart surname defaults per role:
    //   • male sibling/child/father → inherits target's lastName
    //   • female sibling/daughter   → maidenName = target's lastName (born into family),
    //                                  lastName empty (filled if married)
    //   • female parent (mother)    → lastName = target's lastName adjusted to
    //                                  feminine (assumed family name after marriage),
    //                                  maidenName empty (her birth family unknown)
    //   • female spouse (wife)      → same as mother — takes husband's surname
    //                                  after marriage, maiden left for the user
    //   • male spouse (husband)     → empty (no inheritance from the target)
    const tLast = targetPerson.lastName ?? '';
    if (m === 'spouse' && g === 'male') {
      setLastName('');
      setMaidenName('');
    } else if (g === 'female' && (m === 'parent' || m === 'spouse')) {
      // Wife / mother — inherits family surname adjusted to feminine form.
      // "Рустамов" → "Рустамова". Maiden stays empty: she married in from
      // a different family and the user can fill it in.
      setLastName(adjustSurnameForGender(tLast, 'female'));
      setMaidenName('');
    } else if (g === 'male') {
      // Strip trailing "а" — Рустамова (target female) → Рустамов (new son).
      setLastName(adjustSurnameForGender(tLast, 'male'));
      setMaidenName('');
    } else {
      // Sister / daughter — born into the family. Append "а" for maiden.
      // "Рустамов" (target male) → "Рустамова" (new daughter's maiden).
      setMaidenName(adjustSurnameForGender(tLast, 'female'));
      setLastName('');
    }
    // Brother/sister: pre-fill the year input with the target's birthYear
    // as a sensible default — siblings' DOBs typically cluster within a
    // few years. User can still type a different year or pick a full date.
    if (m === 'sibling' && targetPerson.birthYear) {
      setYear(String(targetPerson.birthYear));
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
        // secondParentId is chosen explicitly in the form when target has
        // multiple partners. Default = first partner; user can switch or
        // clear.
        if (secondParentId && secondParentId !== targetPerson.id) {
          rels.push({ category: 'parent_child', otherPersonId: secondParentId, role: 'child', childRelation: 'biological' });
        }
      } else if (mode === 'spouse') {
        rels.push({ category: 'couple', otherPersonId: targetPerson.id, role: 'spouse', coupleStatus: 'married' });
        // Only auto-link to existing children if the target has NO current
        // spouse. In that case the new partner is plausibly the kids'
        // co-parent (you're filling in real parents, not modelling
        // step-families). When a spouse already exists, the new partner is
        // a second one (polygamy / re-marriage) and the existing children
        // most likely belong to the FIRST partner — auto-linking would
        // wrongly reparent them. The user can attach children explicitly
        // to the new partnership afterwards.
        const targetHasSpouse = relationships.some(
          (r) => r.category === 'couple' && (r.person1Id === targetPerson.id || r.person2Id === targetPerson.id)
        );
        if (!targetHasSpouse) {
          const targetChildren = relationships
            .filter((r) => r.category === 'parent_child' && r.person1Id === targetPerson.id)
            .map((r) => r.person2Id);
          for (const childId of targetChildren) {
            rels.push({ category: 'parent_child', otherPersonId: childId, role: 'parent', childRelation: 'biological' });
          }
        }
      }

      // birthType / deathType control which payload we send:
      //   'date'    → full birthDate + derive birthYear from the year part
      //   'year'    → only birthYear (no birthDate)
      //   'unknown' → nothing
      const fullBirthDate = birthType === 'date' && !!birthDate;
      const fullDeathDate = deathType === 'date' && !!deathDate;
      const effectiveBirthYear = birthType === 'date'
        ? (birthDate ? Number(birthDate.split('-')[0]) : undefined)
        : birthType === 'year'
          ? (year ? Number(year) : undefined)
          : undefined;
      const effectiveDeathYear = deathType === 'date'
        ? (deathDate ? Number(deathDate.split('-')[0]) : undefined)
        : deathType === 'year'
          ? (deathYear ? Number(deathYear) : undefined)
          : undefined;

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
        address: address.trim() || undefined,
        // Force a leading "+" so all stored phones share the same format
        // (the dropdown in «Расширить древо» and the tunnel-icon lookup
        // both key off exact phone string match).
        phone: phone.trim() ? (phone.trim().startsWith('+') ? phone.trim() : '+' + phone.trim().replace(/^\++/, '')) : undefined,
        maritalStatus: maritalStatus || undefined,
        relationships: rels,
      });
      // Photo upload is best-effort — see EditPersonForm for the why.
      if (photo) {
        try {
          const { processAvatar, uploadPhoto } = await import('../../utils/imageProcessor');
          const blob = await processAvatar(photo);
          await uploadPhoto(treeId, newPerson.id, blob);
        } catch (photoErr) {
          console.error('[AddPerson] photo upload failed', photoErr);
          alert('Человек добавлен, но фото загрузить не удалось. Попробуйте JPG/PNG/WEBP до 5 МБ.');
        }
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
              // Preset opens the form directly with no role-picker behind it,
              // so "Back" should dismiss the sheet rather than land the user
              // on a step they were never meant to see.
              onClick={presetRole ? handleClose : () => setStep('select')}
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

          {/* Auto-couple notice removed for parent mode: there's always at
              most ONE other parent, so the notice is just noise. The
              coupling still happens in onSubmit. */}
          {mode === 'sibling' && existingParents.length > 0 && (
            <div style={{ padding: '10px 12px', marginBottom: 14, borderRadius: 12, background: 'linear-gradient(180deg,#1c1409,#0e0a04)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 11, color: 'var(--text)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2 }}>Общие родители</span>{' '}
              {existingParents.map((p) => p.firstName).join(' + ')}
            </div>
          )}
          {mode === 'child' && spouses.length > 0 && (
            <div style={{ padding: '10px 12px', marginBottom: 14, borderRadius: 12, background: 'linear-gradient(180deg,#1c1409,#0e0a04)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 11, color: 'var(--text)' }}>
              <div style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>2-й родитель</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {spouses.map((sp) => {
                  const active = secondParentId === sp.id;
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setSecondParentId(active ? null : sp.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: active ? 'rgba(251,191,36,0.16)' : 'rgba(255,255,255,0.04)',
                        color: active ? 'var(--accent)' : 'var(--text)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {active ? '✓ ' : ''}{sp.firstName}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setSecondParentId(null)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: secondParentId === null ? '1px solid var(--text-muted)' : '1px solid var(--border)',
                    background: secondParentId === null ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  без 2-го
                </button>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit}>
            {/* Gender selector visible only for the spouse role — for parent/
                sibling/child the role-picker has already locked the correct
                gender (отец = male, мать = female, etc.) and re-asking just
                creates a chance for inconsistent input. */}
            {mode === 'spouse' && (
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
            )}

            {/* No autoFocus on open — the user explicitly didn't want the
                keyboard popping up the moment the form appears (it pushes
                the form around and obscures fields). They tap the field
                they want to fill. */}
            <input className="auth-input" placeholder="Имя" value={firstName} onChange={(e) => setFirstName(e.target.value)} />

            {gender === 'female' && (
              <input className="auth-input" placeholder="Девичья фамилия" value={maidenName} onChange={(e) => setMaidenName(e.target.value)} />
            )}
            <input
              className="auth-input"
              placeholder={gender === 'female' ? 'Фамилия (если другая после замужества)' : 'Фамилия'}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <input
              className="auth-input"
              placeholder="Отчество"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
            />

            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: 0.2 }}>Дата рождения</div>
            <div style={{ display: 'flex', gap: 18, marginBottom: 10, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input type="radio" name="birthType" checked={birthType === 'date'} onChange={() => setBirthType('date')} style={{ accentColor: 'var(--accent)' }} />
                Полная дата
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input type="radio" name="birthType" checked={birthType === 'year'} onChange={() => setBirthType('year')} style={{ accentColor: 'var(--accent)' }} />
                Только год
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input type="radio" name="birthType" checked={birthType === 'unknown'} onChange={() => setBirthType('unknown')} style={{ accentColor: 'var(--accent)' }} />
                Неизвестно
              </label>
            </div>
            {birthType === 'date' && (
              <input
                type="date"
                className="auth-input"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
            )}
            {birthType === 'year' && (
              <input
                className="auth-input"
                placeholder="Год (1985)"
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
                <div style={{ display: 'flex', gap: 18, marginBottom: 10, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                    <input type="radio" name="deathType" checked={deathType === 'date'} onChange={() => setDeathType('date')} style={{ accentColor: 'var(--accent)' }} />
                    Полная дата
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                    <input type="radio" name="deathType" checked={deathType === 'year'} onChange={() => setDeathType('year')} style={{ accentColor: 'var(--accent)' }} />
                    Только год
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                    <input type="radio" name="deathType" checked={deathType === 'unknown'} onChange={() => setDeathType('unknown')} style={{ accentColor: 'var(--accent)' }} />
                    Неизвестно
                  </label>
                </div>
                {deathType === 'date' && (
                  <input
                    type="date"
                    className="auth-input"
                    value={deathDate}
                    onChange={(e) => setDeathDate(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                  />
                )}
                {deathType === 'year' && (
                  <input
                    className="auth-input"
                    placeholder="Год (2010)"
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

            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: 0.2 }}>Телефон</div>
            <input
              className="auth-input"
              type="tel"
              inputMode="tel"
              placeholder="+998901234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: 0.2 }}>Домашний адрес</div>
            <input
              className="auth-input"
              placeholder="Город, улица, дом, квартира…"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />

            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: 0.2 }}>Семейное положение</div>
            <select
              className="auth-input"
              value={maritalStatus}
              onChange={(e) => setMaritalStatus(e.target.value)}
            >
              <option value="">— не указано —</option>
              {MARITAL_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

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
