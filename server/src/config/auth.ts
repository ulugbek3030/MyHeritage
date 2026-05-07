import jwt from 'jsonwebtoken';
import { env } from './env.js';

type Payload = { sub: string; phone: string };

export const signAccess = (p: Payload) => jwt.sign(p, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES });
export const signRefresh = (p: Payload) => jwt.sign({ ...p, type: 'refresh' }, env.JWT_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES });
export const verifyRefresh = (token: string): Payload => {
  const d = jwt.verify(token, env.JWT_SECRET) as Payload & { type?: string };
  if (d.type !== 'refresh') throw new Error('not a refresh token');
  return { sub: d.sub, phone: d.phone };
};
