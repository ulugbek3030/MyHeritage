import { useState, useRef, useEffect } from 'react';
import type { Person } from '../../types';
import type { CreatePersonData } from '../../api/persons';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

/* ───── Types ───── */
type BirthMode = 'unknown' | 'year' | 'full';
type AliveStatus = 'alive' | 'deceased';
type DeathMode = 'unknown' | 'year' | 'full';

interface EditPersonFormProps {
  person: Person;
  treeId: string;
  saving: boolean;
  onSubmit: (data: Partial<CreatePersonData>, photoFile?: File) => void;
  onClose: () => void;
}

/* ───── Chip selector helper ───── */
function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  small,
  chipClass,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
  chipClass?: (v: T) => string;
}) {
  return (
    <div className={`form-chips${small ? ' form-chips-sm' : ''}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`chip${opt.value === value ? ' active' : ''}${chipClass ? ' ' + chipClass(opt.value) : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ───── Helper: determine birth/death mode from person data ───── */
function getBirthMode(person: Person): BirthMode {
  if (person.birthDateKnown && person.birthDate) return 'full';
  if (person.birthYear) return 'year';
  return 'unknown';
}

function getDeathMode(person: Person): DeathMode {
  if (person.deathDateKnown && person.deathDate) return 'full';
  if (person.deathYear) return 'year';
  return 'unknown';
}

/* ───── Camera icon SVG ───── */
const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

/* ───── Person avatar placeholder SVG ───── */
const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

/* ───── Main component ───── */
export default function EditPersonForm({
  person,
  saving,
  onSubmit,
  onClose,
}: EditPersonFormProps) {
  // Pre-populate from person
  const [gender, setGender] = useState<'male' | 'female'>(person.gender);
  const [firstName, setFirstName] = useState(person.firstName);
  const [lastName, setLastName] = useState(person.lastName || '');
  const [middleName, setMiddleName] = useState(person.middleName || '');
  const [maidenName, setMaidenName] = useState(person.maidenName || '');

  const [birthMode, setBirthMode] = useState<BirthMode>(getBirthMode(person));
  const [birthYear, setBirthYear] = useState(person.birthYear?.toString() || '');
  const [birthDate, setBirthDate] = useState(
    person.birthDate ? person.birthDate.slice(0, 10) : ''
  );

  const [aliveStatus, setAliveStatus] = useState<AliveStatus>(
    person.isAlive ? 'alive' : 'deceased'
  );
  const [deathMode, setDeathMode] = useState<DeathMode>(getDeathMode(person));
  const [deathYear, setDeathYear] = useState(person.deathYear?.toString() || '');
  const [deathDate, setDeathDate] = useState(
    person.deathDate ? person.deathDate.slice(0, 10) : ''
  );

  const [note, setNote] = useState(person.note || '');

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Existing photo URL
  const existingPhotoUrl = person.photoUrl
    ? (person.photoUrl.startsWith('http') ? person.photoUrl : `${API_BASE}${person.photoUrl}`)
    : null;

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  // --- Handle submit ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;

    const data: Partial<CreatePersonData> = {
      firstName: firstName.trim(),
      lastName: lastName.trim() || null,
      middleName: middleName.trim() || null,
      maidenName: maidenName.trim() || null,
      gender,
      birthDate: birthMode === 'full' && birthDate ? birthDate : null,
      birthYear: birthMode === 'year' && birthYear ? parseInt(birthYear) : null,
      birthDateKnown: birthMode === 'full',
      isAlive: aliveStatus === 'alive',
      deathDate: aliveStatus === 'deceased' && deathMode === 'full' && deathDate ? deathDate : null,
      deathYear: aliveStatus === 'deceased' && deathMode === 'year' && deathYear ? parseInt(deathYear) : null,
      deathDateKnown: aliveStatus === 'deceased' && deathMode === 'full',
      note: note.trim() || null,
    };

    onSubmit(data, photoFile || undefined);
  };

  const personName = [person.firstName, person.lastName].filter(Boolean).join(' ');

  // Which photo to display: new file > existing
  const displayPhoto = photoPreview || existingPhotoUrl;

  return (
    <div className="popup-overlay active" onClick={onClose}>
      <div className="popup add-form-popup" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="add-form-header">
          <button className="popup-close" onClick={onClose}>
            &times;
          </button>
          <div className="add-form-title">Редактировать</div>
          <div className="add-form-subtitle">{personName}</div>
        </div>

        {/* Body */}
        <div className="popup-body">
          <form onSubmit={handleSubmit}>
            {/* === Photo === */}
            <div className="form-group edit-photo-section">
              <div
                className={`edit-photo-preview ${gender}`}
                onClick={() => fileInputRef.current?.click()}
              >
                {displayPhoto ? (
                  <img src={displayPhoto} alt={person.firstName} />
                ) : (
                  <PersonIcon />
                )}
                <div className="edit-photo-overlay">
                  <CameraIcon />
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoChange}
              />
              <button
                type="button"
                className="edit-photo-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                {displayPhoto ? 'Изменить фото' : 'Добавить фото'}
              </button>
            </div>

            {/* === Gender === */}
            <div className="form-group">
              <label className="form-label">Пол</label>
              <ChipGroup
                options={[
                  { value: 'male' as const, label: 'Мужской' },
                  { value: 'female' as const, label: 'Женский' },
                ]}
                value={gender}
                onChange={setGender}
                chipClass={(v) => (v === 'male' ? 'male-chip' : 'female-chip')}
              />
            </div>

            <div className="form-divider" />

            {/* === Names === */}
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Фамилия</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Рустамов(а)"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Имя *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Имя"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Отчество</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Отчество"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Девичья фамилия</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Если менялась"
                  value={maidenName}
                  onChange={(e) => setMaidenName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-divider" />

            {/* === Birth date === */}
            <div className="form-group">
              <label className="form-label">Дата рождения</label>
              <ChipGroup
                small
                options={[
                  { value: 'unknown' as BirthMode, label: 'Не знаю' },
                  { value: 'year' as BirthMode, label: 'Только год' },
                  { value: 'full' as BirthMode, label: 'Полная дата' },
                ]}
                value={birthMode}
                onChange={setBirthMode}
              />
              {birthMode === 'year' && (
                <div className="form-conditional">
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Год, напр. 1985"
                    min={1800}
                    max={2030}
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                  />
                </div>
              )}
              {birthMode === 'full' && (
                <div className="form-conditional">
                  <input
                    type="date"
                    className="form-input"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* === Alive / Death === */}
            <div className="form-group">
              <label className="form-label">Статус</label>
              <ChipGroup
                options={[
                  { value: 'alive' as AliveStatus, label: 'Жив(а)' },
                  { value: 'deceased' as AliveStatus, label: 'Умер(ла)' },
                ]}
                value={aliveStatus}
                onChange={setAliveStatus}
                chipClass={(v) => (v === 'alive' ? 'alive-chip' : 'deceased-chip')}
              />
              {aliveStatus === 'deceased' && (
                <div className="form-conditional">
                  <ChipGroup
                    small
                    options={[
                      { value: 'unknown' as DeathMode, label: 'Не знаю когда' },
                      { value: 'year' as DeathMode, label: 'Только год' },
                      { value: 'full' as DeathMode, label: 'Полная дата' },
                    ]}
                    value={deathMode}
                    onChange={setDeathMode}
                  />
                  {deathMode === 'year' && (
                    <div className="form-conditional">
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Год, напр. 2009"
                        min={1800}
                        max={2030}
                        value={deathYear}
                        onChange={(e) => setDeathYear(e.target.value)}
                      />
                    </div>
                  )}
                  {deathMode === 'full' && (
                    <div className="form-conditional">
                      <input
                        type="date"
                        className="form-input"
                        value={deathDate}
                        onChange={(e) => setDeathDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-divider" />

            {/* === Note === */}
            <div className="form-group">
              <label className="form-label">Примечание</label>
              <textarea
                className="form-input form-textarea"
                placeholder="Доп. информация..."
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {/* === Submit === */}
            <button type="submit" className="form-submit" disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner-sm" /> Сохранение...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Сохранить
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
