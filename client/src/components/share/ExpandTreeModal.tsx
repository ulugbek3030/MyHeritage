// "Расширить древо" — modal for requesting reciprocal tree-view access from
// another Click user via their phone number.
//
// Flow:
//   1. Open → fetch identification status. If user is NOT identified in
//      Click yet, show an error pointing them to the profile button on the
//      main page (Click's identification gate is mandatory before they can
//      see anyone else's tree).
//   2. If identified → show:
//        - any incoming requests with Accept / Decline buttons,
//        - any outgoing pending requests with a Cancel button,
//        - the new-request form (phone + optional message).
//   3. Sending a request shows a confirmation about the RECIPROCAL access
//      grant: accepting means BOTH users see each other's trees.
import { useEffect, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import {
  getIdentificationStatus,
  createAccessRequest,
  listIncomingRequests,
  listOutgoingRequests,
  listGrantedTrees,
  acceptAccessRequest,
  declineAccessRequest,
  cancelAccessRequest,
  type TreeAccessRequest,
  type GrantedTree,
} from '../../api/treeAccess';
import '../../styles/form.css';

/** A person from the user's tree, surfaced as an option in the
 *  "Выбрать из родственников" dropdown. `phone` is optional — when
 *  present, the modal prefills the editable phone field after the user
 *  picks; when null, the user types it manually. */
export interface RelativeOption {
  id: string;
  name: string;
  phone: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-fills the phone field — used when the user clicks "Запросить
   *  доступ к древу" on a specific person card. */
  initialPhone?: string | null;
  /** Relatives in the user's tree with phone numbers. Renders a dropdown
   *  before the phone input so the user can pick one instead of typing. */
  relatives?: RelativeOption[];
}

/**
 * Force a "+" prefix on the phone. Trims whitespace, strips any stray
 * leading "+" duplicates ("++998" → "+998"). Empty stays empty.
 */
const withPlus = (raw: string | null | undefined): string => {
  const t = (raw ?? '').trim();
  if (!t) return '';
  return t.startsWith('+') ? t : '+' + t.replace(/^\++/, '');
};

/**
 * Valid request phone: leading "+" followed by 9-15 digits. Mirrors the
 * server's validator regex so the submit button only enables when the
 * server will actually accept the value.
 */
const isValidPhone = (raw: string): boolean => /^\+\d{9,15}$/.test(raw.trim());

export const ExpandTreeModal = ({ open, onClose, initialPhone, relatives }: Props) => {
  const [loading, setLoading] = useState(true);
  const [isIdentified, setIsIdentified] = useState<boolean | null>(null);
  const [incoming, setIncoming] = useState<TreeAccessRequest[]>([]);
  const [outgoing, setOutgoing] = useState<TreeAccessRequest[]>([]);
  // Approved grants — by design they're reciprocal, so this is also the
  // set of users whose tree the caller can view.
  const [grants, setGrants] = useState<GrantedTree[]>([]);
  const [phone, setPhone] = useState(withPlus(initialPhone) || '+998');
  // Track the dropdown selection separately from the phone input so the
  // <select> visually shows what was picked (with value="" it was
  // always snapping back to the placeholder).
  const [pickedRelativeId, setPickedRelativeId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      // Identification status is still fetched so the read-out / future
      // gate has its value, but it no longer blocks the rest of the
      // request flow — we always fetch incoming + outgoing.
      const [status, inc, out, gr] = await Promise.all([
        getIdentificationStatus().catch(() => ({ isIdentified: false })),
        listIncomingRequests().catch(() => []),
        listOutgoingRequests().catch(() => []),
        listGrantedTrees().catch(() => []),
      ]);
      setIsIdentified(status.isIdentified);
      setIncoming(inc);
      setOutgoing(out.filter((r) => r.status === 'pending'));
      setGrants(gr);
    } catch (e) {
      console.error('[ExpandTree] failed to load', e);
      setError('Не удалось загрузить запросы. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      refresh();
      // Re-seed phone field every time the modal re-opens — if the caller
      // passes a new initialPhone (e.g. opening from a different person
      // card), prefer that over whatever the user last typed.
      if (initialPhone) setPhone(withPlus(initialPhone));
      setPickedRelativeId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPhone]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSubmitNotice(null);
    try {
      // Always send the phone in "+XXX..." form regardless of what the
      // user typed (they might omit the +, paste with spaces, etc.).
      await createAccessRequest(withPlus(phone), message.trim() || undefined);
      setSubmitNotice('Запрос отправлен. Когда другой пользователь подтвердит, вы оба получите доступ к деревьям друг друга.');
      setPhone('+998');
      setPickedRelativeId('');
      setMessage('');
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg.includes('Invalid phone') ? 'Неверный формат номера телефона.' : 'Не удалось отправить запрос.');
    } finally {
      setBusy(false);
    }
  };

  const onAccept = async (id: string) => {
    setBusy(true); setError(null);
    try { await acceptAccessRequest(id); await refresh(); }
    catch { setError('Не удалось принять запрос.'); }
    finally { setBusy(false); }
  };
  const onDecline = async (id: string) => {
    setBusy(true); setError(null);
    try { await declineAccessRequest(id); await refresh(); }
    catch { setError('Не удалось отклонить запрос.'); }
    finally { setBusy(false); }
  };
  const onCancel = async (id: string) => {
    setBusy(true); setError(null);
    try { await cancelAccessRequest(id); await refresh(); }
    catch { setError('Не удалось отменить запрос.'); }
    finally { setBusy(false); }
  };

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
          Расширить древо
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
        Запросите у своего родственника — другого пользователя Click — доступ на просмотр его семейного древа.
        После подтверждения <strong style={{ color: 'var(--text)' }}>вы оба</strong> сможете смотреть деревья друг друга.
      </div>

      {/* Inline notification: how many pending requests are waiting for
          this user's approval. Replaces the earlier identification-status
          read-out — the user explicitly asked for a notification-style
          message instead. */}
      {!loading && incoming.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            marginBottom: 14,
            borderRadius: 12,
            background: 'linear-gradient(180deg, rgba(251,191,36,0.18), rgba(251,191,36,0.06))',
            border: '1px solid rgba(251,191,36,0.4)',
            fontSize: 13,
            color: 'var(--text)',
            lineHeight: 1.4,
          }}
        >
          <span style={{ fontSize: 18 }}>🔔</span>
          <span>
            <strong style={{ color: 'var(--accent)' }}>
              {incoming.length === 1
                ? 'У вас новый запрос'
                : `У вас ${incoming.length} новых запросов`}
            </strong>{' '}
            на просмотр древа — смотрите ниже.
          </span>
        </div>
      )}

      {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Загрузка…</div>}

      {/* Identification gate temporarily removed — the form is shown
          regardless of isIdentified so we can test the request/grant
          flow without needing Click KYC. Re-enable by restoring the
          `isIdentified === false` branch above and gating this block
          on `isIdentified === true`. */}
      {!loading && (
        <>
          {incoming.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
                Входящие запросы ({incoming.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {incoming.map((r) => (
                  <div key={r.id} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {r.requesterDisplayName ?? 'Пользователь Click'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {r.requesterPhone ?? ''}
                    </div>
                    {r.message && (
                      <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.25)', borderRadius: 8 }}>
                        {r.message}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        type="button"
                        onClick={() => onAccept(r.id)}
                        disabled={busy}
                        className="auth-btn"
                        style={{ marginBottom: 0, flex: 1, padding: 10, fontSize: 13 }}
                      >
                        Принять
                      </button>
                      <button
                        type="button"
                        onClick={() => onDecline(r.id)}
                        disabled={busy}
                        style={{ flex: 1, padding: 10, borderRadius: 12, border: '1px solid rgba(248,113,113,0.3)', background: 'transparent', color: '#f87171', fontWeight: 700, fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer' }}
                      >
                        Отклонить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {outgoing.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
                Ожидают ответа ({outgoing.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {outgoing.map((r) => (
                  <div key={r.id} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{r.targetPhone}</div>
                    {r.message && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{r.message}</div>}
                    <button
                      type="button"
                      onClick={() => onCancel(r.id)}
                      disabled={busy}
                      style={{ marginTop: 10, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: busy ? 'not-allowed' : 'pointer' }}
                    >
                      Отменить
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider between the "уже отправленные" section above and the
              new-request form below — gives the eye a clear boundary so
              the form doesn't read as more of the pending list. Only
              rendered when there ARE outgoing items (otherwise the form
              sits at the top and a stray line would look orphaned). */}
          {outgoing.length > 0 && (
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0 18px' }} />
          )}

          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>
            Отправить запрос
          </div>
          <form onSubmit={submit}>
            {relatives && relatives.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: 0.2 }}>Выбрать из родственников</div>
                <select
                  className="auth-input"
                  value={pickedRelativeId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setPickedRelativeId(id);
                    if (!id) return;
                    const picked = relatives.find((r) => r.id === id);
                    if (!picked) return;
                    // Prefill phone from the person's card when set. When
                    // the card has no phone, KEEP whatever was already in
                    // the input — don't punish the user for picking a
                    // relative with missing data after they'd already
                    // typed a number.
                    if (picked.phone) setPhone(withPlus(picked.phone));
                  }}
                >
                  <option value="">— выбрать из дерева —</option>
                  {relatives.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}{r.phone ? ` (${r.phone})` : ' (без телефона)'}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: 0.2 }}>Номер телефона родственника</div>
            <input
              className="auth-input"
              type="tel"
              placeholder="+998901234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: 0.2 }}>Сообщение (необязательно)</div>
            <textarea
              className="auth-input"
              placeholder="Короткое сообщение для родственника"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ resize: 'vertical', minHeight: 70, fontFamily: 'inherit', lineHeight: 1.4 }}
            />
            {error && (
              <div style={{ padding: 10, marginBottom: 10, borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: 13 }}>
                {error}
              </div>
            )}
            {submitNotice && (
              <div style={{ padding: 10, marginBottom: 10, borderRadius: 10, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: 13 }}>
                {submitNotice}
              </div>
            )}
            {/* Submit gated on:
                  - no network call in flight
                  - phone matches +XXXXXXXXX (9-15 digits after the +)
                  - relative selected from the dropdown (when one is
                    available; if the modal was opened without a
                    `relatives` list, this part is skipped). */}
            <button
              type="submit"
              disabled={
                busy
                || !isValidPhone(phone)
                || (Array.isArray(relatives) && relatives.length > 0 && !pickedRelativeId)
              }
              className="auth-btn"
            >
              {busy ? 'Отправляем…' : 'Отправить запрос'}
            </button>
          </form>

          {/* Reciprocal access list — by design every accepted request
              inserts grants in BOTH directions, so this list doubles as
              "кто видит ваше древо" AND "чьё древо вы видите". Names +
              phones are shown so the user can confirm who's already
              connected and (later) revoke if needed. */}
          {grants.length > 0 && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '18px 0' }} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>
                Подтверждённые ({grants.length})
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.45 }}>
                Эти пользователи могут просматривать ваше древо. И вы тоже можете смотреть их древо.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grants.map((g) => (
                  <div key={g.userId} style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>✓</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                        {g.displayName ?? 'Пользователь Click'}
                      </div>
                      {g.phone && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                          {g.phone.startsWith('+') ? g.phone : '+' + g.phone.replace(/^\++/, '')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </BottomSheet>
  );
};
