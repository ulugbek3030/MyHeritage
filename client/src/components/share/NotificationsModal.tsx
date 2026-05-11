// Notifications panel — opens from the bell icon in the tree-view header.
// Shows only INCOMING pending tree-access requests with Принять / Отклонить
// buttons and an explanation of what approving means (reciprocal visibility:
// the requester sees the user's whole tree on approval).
//
// Sending NEW requests still lives in ExpandTreeModal (opened from the
// "Расширить" quick-action). The bell strictly handles "things to react to".
import { useEffect, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import {
  listIncomingRequests,
  acceptAccessRequest,
  declineAccessRequest,
  type TreeAccessRequest,
} from '../../api/treeAccess';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Fired after the user accepts / declines a request — caller can
   *  refresh the incoming-count badge or trigger a tree reload (a fresh
   *  grant means new tunnel icons should appear). */
  onChange?: () => void;
}

export const NotificationsModal = ({ open, onClose, onChange }: Props) => {
  const [loading, setLoading] = useState(true);
  const [incoming, setIncoming] = useState<TreeAccessRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const r = await listIncomingRequests();
      setIncoming(r);
    } catch (e) {
      console.error('[Notifications] load failed', e);
      setError('Не удалось загрузить уведомления.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const onAccept = async (id: string) => {
    setBusy(true); setError(null);
    try {
      await acceptAccessRequest(id);
      await refresh();
      onChange?.();
    } catch {
      setError('Не удалось принять запрос.');
    } finally { setBusy(false); }
  };

  const onDecline = async (id: string) => {
    setBusy(true); setError(null);
    try {
      await declineAccessRequest(id);
      await refresh();
      onChange?.();
    } catch {
      setError('Не удалось отклонить запрос.');
    } finally { setBusy(false); }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button
          onClick={onClose}
          type="button"
          aria-label="Закрыть"
          style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text)', fontSize: 16, cursor: 'pointer' }}
        >
          ←
        </button>
        <div style={{ flex: 1, fontSize: 17, fontWeight: 800, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
          🔔 Уведомления
        </div>
      </div>

      {/* Explainer: what accepting means. Always shown so the user sees the
          reciprocity before the very first Принять click. */}
      <div
        style={{
          padding: 12,
          marginBottom: 16,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        Если вы разрешите запрос, то <strong style={{ color: 'var(--text)' }}>всех, кто есть у вас в дереве, увидит тот, кто запрашивал</strong>. И наоборот — вы тоже сможете смотреть его древо.
      </div>

      {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Загрузка…</div>}

      {!loading && incoming.length === 0 && !error && (
        <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
          Новых запросов нет.
        </div>
      )}

      {error && (
        <div style={{ padding: 12, marginBottom: 14, borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!loading && incoming.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {incoming.map((r) => (
            <div key={r.id} style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>
                Запрос на просмотр древа
              </div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                {r.requesterDisplayName ?? 'Пользователь Click'}
              </div>
              {r.requesterPhone && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'ui-monospace, Menlo, monospace' }}>
                  {r.requesterPhone}
                </div>
              )}
              {r.message && (
                <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 10, padding: 10, background: 'rgba(0,0,0,0.25)', borderRadius: 10, lineHeight: 1.4 }}>
                  «{r.message}»
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => onAccept(r.id)}
                  disabled={busy}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                    color: '#0a0a0d',
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  Принять
                </button>
                <button
                  type="button"
                  onClick={() => onDecline(r.id)}
                  disabled={busy}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(248,113,113,0.3)',
                    background: 'transparent',
                    color: '#f87171',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: busy ? 'not-allowed' : 'pointer',
                  }}
                >
                  Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
};
