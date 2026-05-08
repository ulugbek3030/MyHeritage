import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';

export interface ClickProfile {
  client_id: number | string;
  name: string;
  surname: string;
  patronym: string;
  gender: string;
  phone_number: string;
}

/**
 * Hits Click's integration API with the user's web_session and returns the
 * profile fields. Throws UnauthorizedError if the session is missing or
 * invalid; throws a generic Error on transport / non-RPC failures.
 *
 * Spec (provided by Click):
 *   POST <CLICK_INTEGRATION_API_URL>
 *   Headers:
 *     Content-Type: application/json
 *     Authorization: Bearer <api key issued to this mini-app>
 *     web_session:  <user session>
 *   Body: { jsonrpc: '2.0', method: 'user.profile', id: 321 }
 */
export const fetchClickProfile = async (webSession: string): Promise<ClickProfile> => {
  if (!webSession) throw new UnauthorizedError('Missing web_session');
  if (!env.CLICK_INTEGRATION_TOKEN) {
    throw new Error('CLICK_INTEGRATION_TOKEN not configured on the server');
  }

  const res = await fetch(env.CLICK_INTEGRATION_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.CLICK_INTEGRATION_TOKEN}`,
      web_session: webSession,
    },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'user.profile', id: 321 }),
  });

  if (!res.ok) {
    throw new Error(`Click integration HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const json = (await res.json()) as { result?: ClickProfile; error?: { code: number; message: string } };
  if (json.error) {
    throw new UnauthorizedError(`Click rejected web_session: ${json.error.message}`);
  }
  if (!json.result) {
    throw new Error('Click integration: empty result');
  }
  return json.result;
};
