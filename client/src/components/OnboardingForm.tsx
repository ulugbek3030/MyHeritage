import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as treesApi from '../api/trees';
import * as personsApi from '../api/persons';
import { processAvatarClient } from '../utils/imageProcessor';

type BirthMode = 'unknown' | 'year' | 'full';

interface OnboardingFormProps {
  onComplete?: (treeId: string) => void;
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
    <div className={`onb-chips${small ? ' onb-chips-sm' : ''}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`onb-chip${opt.value === value ? ' active' : ''}${chipClass ? ' ' + chipClass(opt.value) : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function OnboardingForm({ onComplete }: OnboardingFormProps) {
  const navigate = useNavigate();

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [birthMode, setBirthMode] = useState<BirthMode>('unknown');
  const [birthYear, setBirthYear] = useState('');
  const [birthDate, setBirthDate] = useState('');

  // Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Smart crop + resize + compress on client side
      const processed = await processAvatarClient(file);
      setPhotoFile(processed);
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(processed);
    } catch {
      // Fallback: use original file
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;

    setSaving(true);
    setError('');

    try {
      // 1. Create tree
      const treeName = 'Семейное Древо' + (lastName.trim() ? ' ' + lastName.trim() : '');
      const tree = await treesApi.createTree(treeName);

      // 2. Create person (owner)
      const person = await personsApi.createPerson(tree.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        middleName: middleName.trim() || null,
        gender,
        birthDate: birthMode === 'full' && birthDate ? birthDate : null,
        birthYear: birthMode === 'year' && birthYear ? parseInt(birthYear) : null,
        birthDateKnown: birthMode === 'full',
        isAlive: true,
      });

      // 3. Set ownerPersonId on tree
      await treesApi.updateTree(tree.id, { ownerPersonId: person.id });

      // 4. Upload photo if present
      if (photoFile) {
        try {
          await personsApi.uploadPersonPhoto(tree.id, person.id, photoFile);
        } catch {
          // Photo upload failed, but tree/person created — continue
          console.warn('Photo upload failed, skipping');
        }
      }

      // 5. Navigate to tree
      if (onComplete) {
        onComplete(tree.id);
      } else {
        navigate(`/trees/${tree.id}`, { replace: true });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка при создании');
      setSaving(false);
    }
  };

  return (
    <div className="onboarding-card">
      <div className="onboarding-header">
        <div className="onboarding-icon">👋</div>
        <h2>Добро пожаловать!</h2>
        <p>Добавьте себя — первого члена семьи</p>
      </div>

      <form onSubmit={handleSubmit} className="onboarding-form">
        {error && <div className="onboarding-error">{error}</div>}

        {/* Photo upload */}
        <div className="onb-photo-section">
          <div
            className={`onb-photo-circle${photoPreview ? ' has-photo' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Фото" />
            ) : (
              <div className="onb-photo-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>Фото</span>
              </div>
            )}
          </div>
          {photoPreview && (
            <button type="button" className="onb-photo-remove" onClick={removePhoto}>
              Удалить
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* Gender */}
        <div className="onb-field">
          <label className="onb-label">Пол</label>
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

        {/* Names */}
        <div className="onb-field">
          <label className="onb-label">Имя *</label>
          <input
            type="text"
            className="onb-input"
            placeholder="Ваше имя"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="onb-field">
          <label className="onb-label">Фамилия</label>
          <input
            type="text"
            className="onb-input"
            placeholder="Фамилия"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>

        <div className="onb-field">
          <label className="onb-label">Отчество</label>
          <input
            type="text"
            className="onb-input"
            placeholder="Отчество"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
          />
        </div>

        {/* Birth date */}
        <div className="onb-field">
          <label className="onb-label">Дата рождения</label>
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
            <div style={{ marginTop: 8 }}>
              <input
                type="number"
                className="onb-input"
                placeholder="Год, напр. 1985"
                min={1800}
                max={2030}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
              />
            </div>
          )}
          {birthMode === 'full' && (
            <div style={{ marginTop: 8 }}>
              <input
                type="date"
                className="onb-input"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Submit */}
        <button type="submit" className="onb-submit" disabled={saving}>
          {saving ? (
            <>
              <span className="spinner-sm" /> Создаём...
            </>
          ) : (
            'Создать древо'
          )}
        </button>
      </form>
    </div>
  );
}
