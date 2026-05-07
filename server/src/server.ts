import 'dotenv/config';
import { env } from './config/env.js';
import { createApp } from './app.js';

createApp().listen(env.PORT, () => console.log(`[server] http://localhost:${env.PORT}`));
