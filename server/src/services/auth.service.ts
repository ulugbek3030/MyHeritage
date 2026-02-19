import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';
import { authConfig } from '../config/auth.js';
import { AppError, UnauthorizedError, ValidationError } from '../utils/errors.js';

export async function registerUser(email: string, password: string, displayName: string) {
  // Check if email already exists
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    throw new ValidationError('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, authConfig.bcryptRounds);

  const result = await query(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, display_name, avatar_url, created_at`,
    [email, passwordHash, displayName]
  );

  const user = result.rows[0];
  const tokens = generateTokens(user.id, user.email);

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    },
    ...tokens,
  };
}

export async function loginUser(email: string, password: string) {
  const result = await query(
    'SELECT id, email, password_hash, display_name, avatar_url FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const user = result.rows[0];
  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const tokens = generateTokens(user.id, user.email);

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    },
    ...tokens,
  };
}

export async function getProfile(userId: string) {
  const result = await query(
    'SELECT id, email, display_name, avatar_url, created_at FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const user = result.rows[0];
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    createdAt: user.created_at,
  };
}

function generateTokens(userId: string, email: string) {
  const accessToken = jwt.sign(
    { id: userId, email },
    authConfig.jwtSecret,
    { expiresIn: authConfig.accessTokenExpires as any }
  );

  const refreshToken = jwt.sign(
    { id: userId, email, type: 'refresh' },
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
    const tokens = generateTokens(decoded.id, decoded.email);
    return tokens;
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
}
