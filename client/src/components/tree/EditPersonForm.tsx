import { useState, useEffect } from 'react';
import type { Person } from '../../types';
import { updatePerson } from '../../api/persons';
import { BottomSheet } from '../ui/BottomSheet';
import { DateWheelPicker } from '../ui/DateWheelPicker';
import '../../styles/form.css';

interface Props {
  open: boolean;
  onClose: () => void;
  treeId: string;
  person: Person;
  onSaved: () => void;
}

export const EditPersonForm = ({ open, onClose, treeId, person, onSaved }: Props) => {
  const [gender, setGender] = useState<'male' | 'female'>(person.gender);
  const [firstName, setFirstName] = useState(person.firstName);
  const [lastName, setLastName] = useState(person.lastName ?? '');
  const [middleName, setMiddleName] = useState(person.middleName ?? '');
  const [maidenName, setMaidenName] = useState(person.maidenName ?? '');
  const [birthDate, setBirthDate] = useState(person.birthDate ?? '');
  const [year, setYear] = useState(person.birthDate ? '' : (person.birthYear ? String(person.birthYear) : ''));
  const [isAlive, setIsAlive] = useState(person.isAlive);
  const [deathDate, setDeathDate] = useState(person.deathDate ?? '');
  const [deathYear, setDeathYear] = useState(person.deathDate ? '' : (person.deathYear ? String(person.deathYear) : ''));
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-sync state if the prop person flips while the sheet is open.
  useEffect(() => {
    setGender(person.gender);
    setFirstName(person.firstName);
    setLastName(person.lastName ?? '');
    setMiddleName(person.middleName ?? '');
    setMaidenName(person.maidenName ?? '');
    setBirthDate(person.birthDate ?? '');
    setYear(person.birthDate ? '' : (person.birthYear ? String(person.birthYear) : ''));
    setIsAlive(person.isAlive);
    setDeathDate(person.deathDate ?? '');
    setDeathYear(person.deathDate ? '' : (person.deathYear ? String(person.deathYear) : ''));
    setPhoto(null);
  }, [person.id]);

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
      });
      if (photo) {
        const { processAvatar, uploadPhoto } = await import('../../utils/imageProcessor');
        const blob = await processAvatar(photo);
        await uploadPhoto(treeId, person.id, blob);
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
        <input className="auth-input" placeholder="Отчество" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />

        <div style={dateLabel}>Дата рождения</div>
        <DateWheelPicker
          value={birthDate}
          onChange={(iso) => { setBirthDate(iso); if (iso) setYear(''); }}
        />
        {!birthDate && (
          <input className="auth-input" placeholder="Или только год (1985)" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        )}

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
            <DateWheelPicker
              value={deathDate}
              onChange={(iso) => { setDeathDate(iso); if (iso) setDeathYear(''); }}
            />
            {!deathDate && (
              <input className="auth-input" placeholder="Или только год (2010)" inputMode="numeric" value={deathYear} onChange={(e) => setDeathYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
            )}
          </>
        )}

        <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="auth-input" />
        <button type="submit" disabled={busy || !firstName.trim()} className="auth-btn">
          {busy ? 'Сохранение…' : 'Сохранить'}
        </button>
      </form>
    </BottomSheet>
  );
};
