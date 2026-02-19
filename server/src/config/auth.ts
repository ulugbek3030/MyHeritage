import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const authConfig = {
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
  accessTokenExpires: process.env.JWT_ACCESS_EXPIRES || '24h',
  refreshTokenExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  bcryptRounds: 12,
};
