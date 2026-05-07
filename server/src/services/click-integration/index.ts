import { env } from '../../config/env.js';
import type { ClickIntegration } from './interface.js';
import { MockClickIntegration } from './mock.js';

export const clickIntegration: ClickIntegration =
  env.CLICK_INTEGRATION_MODE === 'real'
    ? (() => { throw new Error('Real ClickIntegration not implemented in Phase 1'); })()
    : MockClickIntegration;
