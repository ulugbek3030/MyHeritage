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
  acceptAccessRequest,
  declineAccessRequest,
  cancelAccessRequest,
  type TreeAccessRequest,
} from '../../api/treeAccess';
import '../../styles/form.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const ExpandTreeModal = ({ open, onClose }: Props) => {
  const [loading, setLoading] = useState(true);
  const [isIdentified, setIsIdentified] = useState<boolean | null>(null);
  const [incoming, setIncoming] = useState<TreeAccessRequest[]>([]);
  const [outgoing, setOutgoing] = useState<TreeAccessRequest[]>([]);
  const [phone, setPhone] = useState('+998');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await getIdentificationStatus();
      setIsIdentified(status.isIdentified);
      if (status.isIdentified) {
        const [inc, out] = await Promise.all([listIncomingRequests(), listOutgoingRequests()]);
        setIncoming(inc);
        setOutgoing(out.filter((r) => r.status === 'pending'));
      }
    } catch (e) {
      console.error('[ExpandTree] failed to load', e);
      setError('Не удалось загрузить запросы. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSubmitNotice(null);
    try {
      await createAccessRequest(phone.trim(), message.trim() || undefined);
      setSubmitNotice('Запрос отправлен. Когда другой пользователь подтвердит, вы оба получите доступ к деревьям друг друга.');
      setPhone('+998');
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

      {/* Test-only — read-out of the user's identification flag from Click.
          Lets us verify the SSO sync is writing users.is_identified
          correctly without poking the DB. Remove once the flow is stable. */}
      {!loading && isIdentified !== null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            marginBottom: 14,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--text-muted)',
            fontFamily: 'ui-monospace, Menlo, monospace',
          }}
        >
          <span style={{ fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase' }}>Статус идентификации:</span>
          <span style={{ fontWeight: 800, color: isIdentified ? '#4ade80' : '#f87171' }}>
            {isIdentified ? 'true (идентифицирован)' : 'false (не идентифицирован)'}
          </span>
        </div>
      )}

      {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Загрузка…</div>}

      {!loading && isIdentified === false && (
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.3)',
            fontSize: 13,
            color: 'var(--text)',
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 800, color: '#f87171', marginBottom: 6 }}>Требуется идентификация</div>
          Вам необходимо пройти идентификацию в Click. Вернитесь, пожалуйста, на главную страницу и нажмите значок профиля в левом верхнем углу.
        </div>
      )}

      {!loading && isIdentified === true && (
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

          <form onSubmit={submit}>
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
            <button type="submit" disabled={busy || !phone.trim()} className="auth-btn">
              {busy ? 'Отправляем…' : 'Отправить запрос'}
            </button>
          </form>
        </>
      )}
    </BottomSheet>
  );
};
