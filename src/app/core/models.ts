export type DayVisualStatus = 'taken' | 'available' | 'upcoming';

export interface Member {
  uid: string;
  name: string;
  slug: string;
  emoji: string;
  color: string;
  isAdmin: boolean;
  isSupervisor: boolean;
  hasDefaultPin: boolean;
}

export const MEMBER_EMOJIS = ['🎅', '🦌', '⛄', '🌟', '🧝', '🍪', '🎁', '🍫'];
export const MEMBER_COLORS = ['#8B2635', '#1E6B52', '#2B6CB0', '#C68B2C', '#6B46C1', '#B83280'];

export interface DayClaim {
  id: string;
  memberUid: string;
  memberName: string;
  dayNumber: number;
  createdAt: number;
}

export interface MemberProgressStats {
  member: Member;
  daysTakenCount: number;
  takenDayNumbers: number[];
  unlockedDaysCount: number;
  daysToRecoverCount: number;
  missingDayNumbers: number[];
}

export const KINDER_CHOCOLATES = [
  'Kinder Bueno',
  'Kinder Maxi',
  'Kinder Schoko-Bons',
  'Kinder Country',
  'Kinder Surprise',
  'Kinder Chocolat',
  'Kinder Happy Hippo',
] as const;

export type TradeStatus = 'open' | 'accepted' | 'cancelled';

export interface TradeOffer {
  id: string;
  authorUid: string;
  authorName: string;
  targetUid?: string;
  targetName?: string;
  offeredChocolate: string;
  requestedChocolate: string;
  message: string;
  status: TradeStatus;
  acceptedByUid?: string;
  acceptedByName?: string;
  createdAt: number;
  acceptedAt?: number;
}

export interface ChocolateConsumption {
  id: string;
  memberUid: string;
  chocolateName: string;
  quantity: number;
  createdAt: number;
}

export interface ChocolateStockEntry {
  chocolateName: string;
  quantity: number;
}

export interface PushSubscriptionRecord {
  id: string;
  memberUid: string;
  memberName: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  reminderTime?: string;
  timezone?: string;
  lastReminderDate?: string;
  updatedAt: number;
}

export interface ChocolateCatalogItem {
  id: string;
  name: string;
  totalCount: number;
  emoji?: string;
}

export interface CalendarDayConfig {
  dayNumber: number;
  chocolateName: string;
  quantityPerPerson: number;
  updatedAt: number;
}
