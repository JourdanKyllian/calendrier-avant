import {
  ADVENT_DAY_NUMBERS,
  UNDO_WINDOW_MS,
  canCancelClaim,
  computeMemberProgressStats,
  computeMemberTakenDays,
  getDayStatusForMember,
  getRemainingUndoSeconds,
  getUnlockedDaysCount,
} from './equity';
import { DayClaim, Member } from './models';

describe('equity helpers', () => {
  const members: Member[] = [
    { uid: 'u1', name: 'Alice', slug: 'alice', emoji: '🎅', color: '#8B2635', isAdmin: true, hasDefaultPin: true, isSupervisor: false },
    { uid: 'u2', name: 'Bob', slug: 'bob', emoji: '🦌', color: '#1E6B52', isAdmin: false, hasDefaultPin: true, isSupervisor: false },
    { uid: 'u3', name: 'Chloé', slug: 'chloe', emoji: '⛄', color: '#2B6CB0', isAdmin: false, hasDefaultPin: true, isSupervisor: false },
    { uid: 'u4', name: 'Dan', slug: 'dan', emoji: '🌟', color: '#C68B2C', isAdmin: false, hasDefaultPin: true, isSupervisor: false },
  ];

  it('provides 24 calendar day numbers', () => {
    expect(ADVENT_DAY_NUMBERS.length).toBe(24);
    expect(ADVENT_DAY_NUMBERS[0]).toBe(1);
    expect(ADVENT_DAY_NUMBERS[23]).toBe(24);
  });

  it('computes unlocked days by calendar date', () => {
    expect(getUnlockedDaysCount(new Date(2026, 10, 23))).toBe(0);
    expect(getUnlockedDaysCount(new Date(2026, 11, 1))).toBe(1);
    expect(getUnlockedDaysCount(new Date(2026, 11, 2))).toBe(2);
    expect(getUnlockedDaysCount(new Date(2026, 11, 24))).toBe(24);
    expect(getUnlockedDaysCount(new Date(2026, 11, 28))).toBe(24);
  });

  it('computes red/green/upcoming status per day for a member', () => {
    expect(getDayStatusForMember(1, 5, [1, 3])).toBe('taken');
    expect(getDayStatusForMember(2, 5, [1, 3])).toBe('available');
    expect(getDayStatusForMember(6, 5, [1, 3])).toBe('upcoming');
  });

  it('computes per-member taken and missing day numbers', () => {
    const claims: DayClaim[] = [
      { id: 'c1', memberUid: 'u1', memberName: 'Alice', dayNumber: 1, createdAt: 10 },
      { id: 'c2', memberUid: 'u1', memberName: 'Alice', dayNumber: 2, createdAt: 20 },
      { id: 'c3', memberUid: 'u2', memberName: 'Bob', dayNumber: 3, createdAt: 30 },
    ];

    expect(computeMemberTakenDays('u1', claims)).toEqual([1, 2]);

    const stats = computeMemberProgressStats(members, claims, 5);
    expect(stats[0].daysTakenCount).toBe(2);
    expect(stats[0].daysToRecoverCount).toBe(3);
    expect(stats[0].missingDayNumbers).toEqual([3, 4, 5]);
    expect(stats[1].daysTakenCount).toBe(1);
    expect(stats[1].daysToRecoverCount).toBe(4);
    expect(stats[1].missingDayNumbers).toEqual([1, 2, 4, 5]);
    expect(stats[2].daysTakenCount).toBe(0);
    expect(stats[2].daysToRecoverCount).toBe(5);
  });

  it('enforces the 30-second anti-cheat undo window', () => {
    const claim: DayClaim = {
      id: 'c1',
      memberUid: 'u2',
      memberName: 'Bob',
      dayNumber: 3,
      createdAt: 100_000,
    };

    expect(getRemainingUndoSeconds(claim, 100_000)).toBe(30);
    expect(getRemainingUndoSeconds(claim, 115_000)).toBe(15);
    expect(getRemainingUndoSeconds(claim, 130_000)).toBe(0);

    expect(canCancelClaim(claim, members[1], 110_000)).toBe(true);
    expect(canCancelClaim(claim, members[1], 100_000 + UNDO_WINDOW_MS + 1)).toBe(false);
    expect(canCancelClaim(claim, members[2], 105_000)).toBe(false);
  });

  it('excludes supervisor accounts from participant progress stats', () => {
    const withSupervisor: Member[] = [
      ...members,
      {
        uid: 'u5',
        name: 'Maman',
        slug: 'maman',
        emoji: '👑',
        color: '#8B2635',
        isAdmin: false,
        hasDefaultPin: false,
        isSupervisor: true,
      },
    ];

    const stats = computeMemberProgressStats(withSupervisor, [], 5);
    expect(stats.length).toBe(4);
    expect(stats.some((entry) => entry.member.uid === 'u5')).toBe(false);
  });
});
