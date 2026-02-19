import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'myheritage',
  user: process.env.DB_USER || 'ulugbek',
  password: process.env.DB_PASSWORD || '',
};

export const databaseUrl = process.env.DATABASE_URL ||
  `postgresql://${dbConfig.user}${dbConfig.password ? ':' + dbConfig.password : ''}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
