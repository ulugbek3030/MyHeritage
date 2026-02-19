import { useState, useMemo } from 'react';
import type {
  Person,
  Relationship,
  CoupleStatus,
  ChildRelation,
} from '../../types';

/* ───── Types ───── */
type RelType = 'child' | 'pair' | 'sibling' | 'parent';
type BirthMode = 'unknown' | 'year' | 'full';
type AliveStatus = 'alive' | 'deceased';
type DeathMode = 'unknown' | 'year' | 'full';

interface AddPersonFormProps {
  /** The person from whose card the "+" was clicked */
  targetPerson: Person;
  /** All persons in the tree (for second-parent dropdown) */
  persons: Person[];
  /** All relationships in the tree */
  relationships: Relationship[];
  /** Loading state while saving */
  saving?: boolean;
  /** Submit handler */
  onSubmit: (data: AddPersonFormData) => void;
  /** Close handler */
  onClose: () => void;
}

export interface AddPersonFormData {
  firstName: string;
  lastName: string;
  middleName: string;
  gender: 'male' | 'female';
  birthDate: string | null;
  birthYear: number | null;
  birthDateKnown: boolean;
  isAlive: boolean;
  deathDate: string | null;
  deathYear: number | null;
  deathDateKnown: boolean;
  note: string;
  /** Relationship to the target person */
  relType: RelType;
  coupleStatus: CoupleStatus | null;
  childRelation: ChildRelation | null;
  /** For child: ID of the second parent (or '__none__' or '__new__') */
  secondParentId: string | null;
  /** For __new__ second parent: their name */
  newParentName: string;
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

/* ───── Main component ───── */
export default function AddPersonForm({
  targetPerson,
  persons,
  relationships,
  saving,
  onSubmit,
  onClose,
}: AddPersonFormProps) {
  // --- Form state ---
  const [relType, setRelType] = useState<RelType>('child');
  const [coupleStatus, setCoupleStatus] = useState<CoupleStatus>('married');
  const [childRelation, setChildRelation] = useState<ChildRelation>('biological');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [birthMode, setBirthMode] = useState<BirthMode>('unknown');
  const [birthYear, setBirthYear] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [aliveStatus, setAliveStatus] = useState<AliveStatus>('alive');
  const [deathMode, setDeathMode] = useState<DeathMode>('unknown');
  const [deathYear, setDeathYear] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [note, setNote] = useState('');
  const [secondParentId, setSecondParentId] = useState<string>('');
  const [newParentName, setNewParentName] = useState('');

  // --- Find existing partners for the target person ---
  const partners = useMemo(() => {
    const result: { id: string; name: string; divorced: boolean }[] = [];
    for (const rel of relationships) {
      if (rel.category !== 'couple') continue;
      let partnerId: string | null = null;
      if (rel.person1Id === targetPerson.id) partnerId = rel.person2Id;
      if (rel.person2Id === targetPerson.id) partnerId = rel.person1Id;
      if (!partnerId) continue;
      const partner = persons.find((p) => p.id === partnerId);
      if (partner) {
        result.push({
          id: partner.id,
          name: [partner.firstName, partner.lastName].filter(Boolean).join(' '),
          divorced: rel.coupleStatus === 'divorced',
        });
      }
    }
    return result;
  }, [targetPerson, persons, relationships]);

  // Auto-select first partner when switching to child mode
  const effectiveSecondParent = secondParentId || (partners.length > 0 ? partners[0].id : '__none__');

  // --- Gender labels based on relType ---
  const genderLabels =
    relType === 'child'
      ? { male: 'Сын', female: 'Дочь' }
      : { male: 'Мужской', female: 'Женский' };

  // --- Second parent hint ---
  const secondParentHint = useMemo(() => {
    const name = [targetPerson.firstName].filter(Boolean).join(' ');
    if (targetPerson.gender === 'male') {
      return `Вы добавляете ребёнка для ${name} (отец). Укажите мать:`;
    }
    return `Вы добавляете ребёнка для ${name} (мать). Укажите отца:`;
  }, [targetPerson]);

  const secondParentLabel =
    targetPerson.gender === 'male' ? 'Мать ребёнка' : 'Отец ребёнка';

  // --- Handle submit ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;

    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleName: middleName.trim(),
      gender,
      birthDate: birthMode === 'full' && birthDate ? birthDate : null,
      birthYear: birthMode === 'year' && birthYear ? parseInt(birthYear) : null,
      birthDateKnown: birthMode === 'full',
      isAlive: aliveStatus === 'alive',
      deathDate: aliveStatus === 'deceased' && deathMode === 'full' && deathDate ? deathDate : null,
      deathYear: aliveStatus === 'deceased' && deathMode === 'year' && deathYear ? parseInt(deathYear) : null,
      deathDateKnown: aliveStatus === 'deceased' && deathMode === 'full',
      note: note.trim(),
      relType,
      coupleStatus: relType === 'pair' ? coupleStatus : null,
      childRelation: relType === 'child' ? childRelation : null,
      secondParentId: relType === 'child' ? effectiveSecondParent : null,
      newParentName: newParentName.trim(),
    });
  };

  const targetName = [targetPerson.firstName, targetPerson.lastName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="popup-overlay active" onClick={onClose}>
      <div className="popup add-form-popup" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="add-form-header">
          <button className="popup-close" onClick={onClose}>
            &times;
          </button>
          <div className="add-form-title">Новый родственник</div>
          <div className="add-form-subtitle">Связь с: {targetName}</div>
        </div>

        {/* Body */}
        <div className="popup-body">
          <form onSubmit={handleSubmit}>
            {/* === Relationship type === */}
            <div className="form-group">
              <label className="form-label">Тип связи</label>
              <ChipGroup
                options={[
                  { value: 'child' as RelType, label: 'Ребёнок' },
                  { value: 'pair' as RelType, label: 'Пара' },
                  { value: 'sibling' as RelType, label: 'Брат/Сестра' },
                  { value: 'parent' as RelType, label: 'Родитель' },
                ]}
                value={relType}
                onChange={(v) => {
                  setRelType(v);
                  if (v !== 'child') setSecondParentId('');
                }}
              />

              {/* Pair type */}
              {relType === 'pair' && (
                <div className="form-conditional">
                  <label className="form-label" style={{ marginTop: 10 }}>
                    Тип отношений
                  </label>
                  <ChipGroup
                    small
                    chipClass={() => 'pair-chip'}
                    options={[
                      { value: 'married' as CoupleStatus, label: 'Муж / Жена' },
                      { value: 'civil' as CoupleStatus, label: 'Гражданский брак' },
                      { value: 'dating' as CoupleStatus, label: 'Встречаются' },
                      { value: 'divorced' as CoupleStatus, label: 'Разведены' },
                      { value: 'widowed' as CoupleStatus, label: 'Смерть супруга(и)' },
                      { value: 'other' as CoupleStatus, label: 'Другое' },
                    ]}
                    value={coupleStatus}
                    onChange={setCoupleStatus}
                  />
                </div>
              )}

              {/* Child type + second parent */}
              {relType === 'child' && (
                <div className="form-conditional">
                  <label className="form-label" style={{ marginTop: 10 }}>
                    Тип ребёнка
                  </label>
                  <ChipGroup
                    small
                    chipClass={() => 'child-chip'}
                    options={[
                      { value: 'biological' as ChildRelation, label: 'Родной' },
                      { value: 'adopted' as ChildRelation, label: 'Усыновлён / Удочерена' },
                      { value: 'foster' as ChildRelation, label: 'Приёмный' },
                      { value: 'guardianship' as ChildRelation, label: 'Опекунство' },
                      { value: 'stepchild' as ChildRelation, label: 'Пасынок / Падчерица' },
                    ]}
                    value={childRelation}
                    onChange={setChildRelation}
                  />

                  {/* Second parent block */}
                  <div className="second-parent-block" style={{ marginTop: 10 }}>
                    <label className="form-label">{secondParentLabel}</label>
                    <div className="second-parent-hint">{secondParentHint}</div>
                    <select
                      className="form-input form-select"
                      value={effectiveSecondParent}
                      onChange={(e) => setSecondParentId(e.target.value)}
                    >
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.divorced ? ' (разведены)' : ''}
                        </option>
                      ))}
                      {partners.length > 0 && (
                        <option disabled>───────────</option>
                      )}
                      <option value="__new__">+ Добавить нового родителя</option>
                      <option value="__none__">Без второго родителя</option>
                    </select>
                    {effectiveSecondParent === '__new__' && (
                      <div style={{ marginTop: 8 }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="ФИО нового родителя"
                          value={newParentName}
                          onChange={(e) => setNewParentName(e.target.value)}
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* === Gender === */}
            <div className="form-group">
              <label className="form-label">Пол</label>
              <ChipGroup
                options={[
                  { value: 'male' as const, label: genderLabels.male },
                  { value: 'female' as const, label: genderLabels.female },
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
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Добавить
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
