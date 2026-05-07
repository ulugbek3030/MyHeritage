import type { ClickIntegration } from './interface.js';

export const MockClickIntegration: ClickIntegration = {
  async verifyToken(_token) { return null; },
  async getUserProfile(_userId) { return null; },
  async getUserRelatives(_userId) { return []; },
  async searchByPhone(_phone) { return []; },
  async sendPush(userId, body) { console.log(`[click mock push] user=${userId}`, body); },
  paymentDeepLink(productId, params) {
    const qs = new URLSearchParams(params).toString();
    return `click://pay?product=${productId}&${qs}`;
  },
};
