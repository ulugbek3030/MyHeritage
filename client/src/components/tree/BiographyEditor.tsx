import { useEffect, useState } from 'react';
import type { Person } from '../../types';
import { updatePerson } from '../../api/persons';

interface Props {
  open: boolean;
  onClose: () => void;
  treeId: string;
  person: Person;
  onSaved: () => void;
}

/**
 * Full-screen biography editor. Bigger textarea than the inline field in
 * EditPersonForm so long life stories can be typed/pasted comfortably.
 * Saves to person.note via the standard updatePerson API.
 */
export const BiographyEditor = ({ open, onClose, treeId, person, onSaved }: Props) => {
  const [text, setText] = useState(person.note ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setText(person.note ?? ''); }, [person.id, person.note]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const fullName = [person.firstName, person.lastName, person.middleName].filter(Boolean).join(' ');

  const onSave = async () => {
    setBusy(true);
    try {
      await updatePerson(treeId, person.id, { note: text.trim() || undefined });
      onSaved();
      onClose();
    } catch (err) {
      console.error('[Bio] save failed', err);
      alert('Не удалось сохранить биографию: ' + (err instanceof Error ? err.message : 'неизвестная ошибка'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'linear-gradient(180deg, var(--surface), var(--bg))', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
        <button onClick={onClose} type="button" aria-label="Назад" style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}>←</button>
        <div style={{ flex: 1, fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>
          Описание
          {fullName && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{fullName}</div>}
        </div>
        <button onClick={onSave} disabled={busy} style={{ padding: '10px 18px', background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))', color: '#0a0a0d', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
          {busy ? 'Сохранение…' : 'Сохранить'}
        </button>
      </header>
      <div style={{ flex: 1, padding: '16px 18px 24px', overflowY: 'auto' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Где родился, чем занимается, важные события, увлечения, профессия, привычки, истории…"
          autoFocus
          style={{
            width: '100%',
            minHeight: 'calc(100dvh - 200px)',
            padding: 16,
            fontSize: 16,
            lineHeight: 1.55,
            color: 'var(--text)',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            fontFamily: 'inherit',
            resize: 'vertical',
            outline: 'none',
          }}
        />
      </div>
    </div>
  );
};
