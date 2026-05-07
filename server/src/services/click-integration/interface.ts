export interface ClickUserIdentity { id: string; phone: string; }
export interface ClickProfile { id: string; phone: string; firstName: string; lastName?: string; birthDate?: string; }
export interface ClickRelative { id: string; phone: string; firstName: string; lastName?: string; relation: 'father' | 'mother' | 'child' | 'spouse'; }
export interface ClickUserHit { id: string; phone: string; firstName?: string; lastName?: string; }

export interface ClickIntegration {
  verifyToken(token: string): Promise<ClickUserIdentity | null>;
  getUserProfile(userId: string): Promise<ClickProfile | null>;
  getUserRelatives(userId: string): Promise<ClickRelative[]>;
  searchByPhone(phone: string): Promise<ClickUserHit[]>;
  sendPush(userId: string, body: { title: string; text: string; deepLink?: string }): Promise<void>;
  paymentDeepLink(productId: string, params: Record<string, string>): string;
}
