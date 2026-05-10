import { useState, useEffect, useMemo } from 'react';
import type { Person, Relationship } from '../../types';
import { updatePerson } from '../../api/persons';
import { createRelationship, deleteRelationship } from '../../api/relationships';
import { BottomSheet } from '../ui/BottomSheet';
import '../../styles/form.css';

interface Props {
  open: boolean;
  onClose: () => void;
  treeId: string;
  person: Person;
  /** Full tree person + relationship lists. Used to show / edit parents. */
  persons?: Person[];
  relationships?: Relationship[];
  onSaved: () => void;
}

export const EditPersonForm = ({ open, onClose, treeId, person, persons, relationships, onSaved }: Props) => {
  const [gender, setGender] = useState<'male' | 'female'>(person.gender);
  const [firstName, setFirstName] = useState(person.firstName);
  const [lastName, setLastName] = useState(person.lastName ?? '');
  const [middleName, setMiddleName] = useState(person.middleName ?? '');
  const [maidenName, setMaidenName] = useState(person.maidenName ?? '');
  // Server may serialise PG DATE columns as a full ISO timestamp
  // ("YYYY-MM-DDT00:00:00.000Z"); the wheel-picker / save path want only
  // the YYYY-MM-DD prefix.
  const isoDate = (v?: string | null) => (v ? v.slice(0, 10) : '');
  const [birthDate, setBirthDate] = useState(isoDate(person.birthDate));
  const [year, setYear] = useState(person.birthDate ? '' : (person.birthYear ? String(person.birthYear) : ''));
  const [isAlive, setIsAlive] = useState(person.isAlive);
  const [deathDate, setDeathDate] = useState(isoDate(person.deathDate));
  const [deathYear, setDeathYear] = useState(person.deathDate ? '' : (person.deathYear ? String(person.deathYear) : ''));
  const [photo, setPhoto] = useState<File | null>(null);
  const [note, setNote] = useState<string>(person.note ?? '');
  const [address, setAddress] = useState<string>(person.address ?? '');
  const [busy, setBusy] = useState(false);

  // Existing parent links + candidate list for "attach another parent".
  const parentLinks = useMemo(() =>
    (relationships ?? []).filter((r) => r.category === 'parent_child' && r.person2Id === person.id),
    [relationships, person.id]
  );
  const currentParents = useMemo(
    () => parentLinks.map((r) => (persons ?? []).find((p) => p.id === r.person1Id)).filter(Boolean) as Person[],
    [parentLinks, persons]
  );
  const hasFather = currentParents.some((p) => p.gender === 'male');
  const hasMother = currentParents.some((p) => p.gender === 'female');
  // Candidates = persons not already a parent and not the person themselves.
  const parentCandidates = useMemo(() => {
    if (!persons) return [];
    const currentIds = new Set(currentParents.map((p) => p.id));
    return persons.filter((p) => p.id !== person.id && !currentIds.has(p.id));
  }, [persons, currentParents, person.id]);
  const [parentBusy, setParentBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerGender, setPickerGender] = useState<'male' | 'female' | null>(null);

  // Re-sync state if the prop person flips while the sheet is open.
  useEffect(() => {
    setGender(person.gender);
    setFirstName(person.firstName);
    setLastName(person.lastName ?? '');
    setMiddleName(person.middleName ?? '');
    setMaidenName(person.maidenName ?? '');
    setBirthDate(isoDate(person.birthDate));
    setYear(person.birthDate ? '' : (person.birthYear ? String(person.birthYear) : ''));
    setIsAlive(person.isAlive);
    setDeathDate(isoDate(person.deathDate));
    setDeathYear(person.deathDate ? '' : (person.deathYear ? String(person.deathYear) : ''));
    setPhoto(null);
    setNote(person.note ?? '');
    setAddress(person.address ?? '');
  }, [person.id]);

  const attachParent = async (parentId: string) => {
    setParentBusy(true);
    try {
      await createRelationship(treeId, {
        category: 'parent_child',
        person1Id: parentId,
        person2Id: person.id,
        childRelation: 'biological',
      });
      onSaved();
      setPickerOpen(false);
      setPickerGender(null);
    } catch (err) {
      console.error('[EditPerson] attach parent failed', err);
      const msg = err instanceof Error ? err.message : 'неизвестная ошибка';
      alert(`Не удалось прикрепить родителя: ${msg}`);
    } finally {
      setParentBusy(false);
    }
  };

  const detachParent = async (parentPersonId: string) => {
    const link = parentLinks.find((r) => r.person1Id === parentPersonId);
    if (!link) return;
    setParentBusy(true);
    try {
      await deleteRelationship(treeId, link.id);
      onSaved();
    } catch (err) {
      console.error('[EditPerson] detach parent failed', err);
      const msg = err instanceof Error ? err.message : 'неизвестная ошибка';
      alert(`Не удалось отвязать родителя: ${msg}`);
    } finally {
      setParentBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fullBirthDate = !!birthDate;
      const fullDeathDate = !!deathDate;
      const effectiveBirthYear = fullBirthDate
        ? Number(birthDate.split('-')[0])
        : (year ? Number(year) : undefined);
      const effectiveDeathYear = fullDeathDate
        ? Number(deathDate.split('-')[0])
        : (deathYear ? Number(deathYear) : undefined);

      await updatePerson(treeId, person.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        middleName: middleName.trim() || undefined,
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
      });
      // Photo upload is best-effort and isolated from the main save: if the
      // user picks a HEIC the browser can't decode, or the server rejects the
      // mime type, we still want the rest of their edits to land. Without
      // this split the whole sheet hung on "Сохранение…" and looked broken.
      if (photo) {
        try {
          const { processAvatar, uploadPhoto } = await import('../../utils/imageProcessor');
          const blob = await processAvatar(photo);
          await uploadPhoto(treeId, person.id, blob);
        } catch (photoErr) {
          console.error('[EditPerson] photo upload failed', photoErr);
          alert('Данные сохранены, но фото загрузить не удалось. Попробуйте JPG/PNG/WEBP до 5 МБ.');
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('[EditPerson] save failed', err);
      const msg = err instanceof Error ? err.message : 'неизвестная ошибка';
      alert(`Не удалось сохранить: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const radioStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer' };
  const dateLabel: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: 0.2 };

  const targetFullName = [person.firstName, person.lastName, person.middleName].filter(Boolean).join(' ');

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button
          onClick={onClose}
          type="button"
          style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text)', fontSize: 16, cursor: 'pointer' }}
          aria-label="Закрыть"
        >
          ←
        </button>
        <div style={{ flex: 1, fontSize: 17, fontWeight: 800, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
          Редактирование {targetFullName && <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{targetFullName}</span>}
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div style={{ display: 'flex', gap: 18, marginBottom: 14 }}>
          <label style={radioStyle}>
            <input type="radio" name="edit-gender" checked={gender === 'male'} onChange={() => setGender('male')} style={{ accentColor: 'var(--accent)' }} />
            Мужчина
          </label>
          <label style={radioStyle}>
            <input type="radio" name="edit-gender" checked={gender === 'female'} onChange={() => setGender('female')} style={{ accentColor: 'var(--accent)' }} />
            Женщина
          </label>
        </div>

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
        <input className="auth-input" placeholder="Отчество" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />

        <div style={dateLabel}>Дата рождения</div>
        <input
          type="date"
          className="auth-input"
          value={birthDate}
          onChange={(e) => { setBirthDate(e.target.value); if (e.target.value) setYear(''); }}
          max={new Date().toISOString().slice(0, 10)}
        />
        <div style={{ fontSize: 11, color: 'var(--text-dim)', margin: '-6px 4px 6px', textAlign: 'center' }}>или, если точная дата неизвестна — только год:</div>
        <input
          className="auth-input"
          placeholder="Год (1985)"
          inputMode="numeric"
          value={year}
          onChange={(e) => { setYear(e.target.value.replace(/\D/g, '').slice(0, 4)); if (e.target.value) setBirthDate(''); }}
        />

        <div style={{ display: 'flex', gap: 18, marginBottom: 14 }}>
          <label style={radioStyle}>
            <input type="radio" name="edit-alive" checked={isAlive} onChange={() => setIsAlive(true)} style={{ accentColor: 'var(--accent)' }} />
            {gender === 'female' ? 'Жива' : 'Жив'}
          </label>
          <label style={radioStyle}>
            <input type="radio" name="edit-alive" checked={!isAlive} onChange={() => setIsAlive(false)} style={{ accentColor: 'var(--accent)' }} />
            {gender === 'female' ? 'Умерла' : 'Умер'}
          </label>
        </div>

        {!isAlive && (
          <>
            <div style={dateLabel}>Дата смерти</div>
            <input
              type="date"
              className="auth-input"
              value={deathDate}
              onChange={(e) => { setDeathDate(e.target.value); if (e.target.value) setDeathYear(''); }}
              max={new Date().toISOString().slice(0, 10)}
            />
            <div style={{ fontSize: 11, color: 'var(--text-dim)', margin: '-6px 4px 6px', textAlign: 'center' }}>или только год:</div>
            <input
              className="auth-input"
              placeholder="Год (2010)"
              inputMode="numeric"
              value={deathYear}
              onChange={(e) => { setDeathYear(e.target.value.replace(/\D/g, '').slice(0, 4)); if (e.target.value) setDeathDate(''); }}
            />
          </>
        )}

        <div style={dateLabel}>Короткое описание</div>
        <textarea
          className="auth-input"
          placeholder="Чем занимается, где работает, любимое блюдо…"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ resize: 'vertical', minHeight: 70, fontFamily: 'inherit', lineHeight: 1.4 }}
        />

        <div style={dateLabel}>Домашний адрес</div>
        <input
          className="auth-input"
          placeholder="Город, улица, дом, квартира…"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        {persons && relationships && (
          <>
            <div style={dateLabel}>Родители</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {currentParents.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Не указаны</div>
              )}
              {currentParents.map((p) => (
                <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 700 }}>
                  {p.gender === 'female' ? '♀' : '♂'} {p.firstName}{p.lastName ? ' ' + p.lastName : ''}
                  <button
                    type="button"
                    onClick={() => detachParent(p.id)}
                    disabled={parentBusy}
                    aria-label={`Отвязать ${p.firstName}`}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: parentBusy ? 'not-allowed' : 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {!hasFather && (
                <button
                  type="button"
                  onClick={() => { setPickerGender('male'); setPickerOpen(true); }}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px dashed rgba(96,165,250,0.45)', background: 'rgba(96,165,250,0.06)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  + прикрепить отца
                </button>
              )}
              {!hasMother && (
                <button
                  type="button"
                  onClick={() => { setPickerGender('female'); setPickerOpen(true); }}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px dashed rgba(244,114,182,0.45)', background: 'rgba(244,114,182,0.06)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  + прикрепить мать
                </button>
              )}
            </div>
            {pickerOpen && (
              <div style={{ marginBottom: 14, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Выберите {pickerGender === 'male' ? 'отца' : 'мать'}
                  </div>
                  <button type="button" onClick={() => setPickerOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                  {parentCandidates.filter((c) => !pickerGender || c.gender === pickerGender).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => attachParent(c.id)}
                      disabled={parentBusy}
                      style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', color: 'var(--text)', fontSize: 13, cursor: parentBusy ? 'not-allowed' : 'pointer' }}
                    >
                      {c.gender === 'female' ? '♀' : '♂'} {c.firstName}{c.lastName ? ' ' + c.lastName : ''}{c.birthYear ? ` · ${c.birthYear}` : ''}
                    </button>
                  ))}
                  {parentCandidates.filter((c) => !pickerGender || c.gender === pickerGender).length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 4px' }}>
                      Нет подходящих людей в дереве. Сначала добавьте {pickerGender === 'male' ? 'мужчину' : 'женщину'}.
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <div style={dateLabel}>Фото</div>
        <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="auth-input" />
        <button type="submit" disabled={busy || !firstName.trim()} className="auth-btn">
          {busy ? 'Сохранение…' : 'Сохранить'}
        </button>
      </form>
    </BottomSheet>
  );
};
