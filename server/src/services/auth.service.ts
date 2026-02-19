import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';
import { authConfig } from '../config/auth.js';
import { AppError, UnauthorizedError, ValidationError } from '../utils/errors.js';

export async function registerUser(phone: string, password: string) {
  // Check if phone already exists
  const existing = await query('SELECT id FROM users WHERE phone = $1', [phone]);
  if (existing.rows.length > 0) {
    throw new ValidationError('Этот номер телефона уже зарегистрирован');
  }

  const passwordHash = await bcrypt.hash(password, authConfig.bcryptRounds);

  const result = await query(
    `INSERT INTO users (phone, password_hash)
     VALUES ($1, $2)
     RETURNING id, phone, avatar_url, created_at`,
    [phone, passwordHash]
  );

  const user = result.rows[0];
  const tokens = generateTokens(user.id, user.phone);

  return {
    user: {
      id: user.id,
      phone: user.phone,
      avatarUrl: user.avatar_url,
    },
    ...tokens,
  };
}

export async function loginUser(phone: string, password: string) {
  const result = await query(
    'SELECT id, phone, password_hash, avatar_url FROM users WHERE phone = $1',
    [phone]
  );

  if (result.rows.length === 0) {
    throw new UnauthorizedError('Неверный номер телефона или пароль');
  }

  const user = result.rows[0];
  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    throw new UnauthorizedError('Неверный номер телефона или пароль');
  }

  const tokens = generateTokens(user.id, user.phone);

  return {
    user: {
      id: user.id,
      phone: user.phone,
      avatarUrl: user.avatar_url,
    },
    ...tokens,
  };
}

export async function getProfile(userId: string) {
  const result = await query(
    'SELECT id, phone, avatar_url, created_at FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const user = result.rows[0];
  return {
    id: user.id,
    phone: user.phone,
    avatarUrl: user.avatar_url,
    createdAt: user.created_at,
  };
}

function generateTokens(userId: string, phone: string) {
  const accessToken = jwt.sign(
    { id: userId, phone },
    authConfig.jwtSecret,
    { expiresIn: authConfig.accessTokenExpires as any }
  );

  const refreshToken = jwt.sign(
    { id: userId, phone, type: 'refresh' },
    authConfig.jwtSecret,
    { expiresIn: authConfig.refreshTokenExpires as any }
  );

  return { accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const decoded = jwt.verify(refreshToken, authConfig.jwtSecret) as any;
    if (decoded.type !== 'refresh') {
      throw new UnauthorizedError('Invalid refresh token');
    }
    const tokens = generateTokens(decoded.id, decoded.phone);
    return tokens;
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
}
