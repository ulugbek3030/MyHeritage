import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from './env.js';

type Payload = { sub: string; phone: string };

// Newer @types/jsonwebtoken constrains `expiresIn` to `number | ms.StringValue`.
// Our env values are plain strings ("24h", "7d"), so we narrow via SignOptions.
const accessOpts: SignOptions = { expiresIn: env.JWT_ACCESS_EXPIRES as SignOptions['expiresIn'] };
const refreshOpts: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES as SignOptions['expiresIn'] };

export const signAccess = (p: Payload) => jwt.sign(p, env.JWT_SECRET, accessOpts);
export const signRefresh = (p: Payload) => jwt.sign({ ...p, type: 'refresh' }, env.JWT_SECRET, refreshOpts);
export const verifyRefresh = (token: string): Payload => {
  const d = jwt.verify(token, env.JWT_SECRET) as Payload & { type?: string };
  if (d.type !== 'refresh') throw new Error('not a refresh token');
  return { sub: d.sub, phone: d.phone };
};
