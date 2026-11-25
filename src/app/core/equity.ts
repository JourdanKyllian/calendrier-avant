import { DayClaim, DayVisualStatus, Member, MemberProgressStats } from './models';

export const UNDO_WINDOW_MS = 30_000;
export const ADVENT_DAY_NUMBERS = Array.from({ length: 24 }, (_, idx) => idx + 1);

/**
 * Checks whether a claim can still be cancelled by the acting member
 * (only their own claim, within the 30-second anti-cheat undo window).
 */
export function canCancelClaim(
  claim: DayClaim,
  member: Member | null,
  nowMs: number = Date.now()
): boolean {
  if (!member) return false;
  if (claim.memberUid !== member.uid) return false;
  return nowMs - claim.createdAt <= UNDO_WINDOW_MS;
}

export function getRemainingUndoSeconds(
  claim: DayClaim,
  nowMs: number = Date.now()
): number {
  return Math.max(0, Math.ceil((UNDO_WINDOW_MS - (nowMs - claim.createdAt)) / 1000));
}

/**
 * Returns how many Advent days (0..24) are currently unlocked based on the calendar date.
 */
export function getUnlockedDaysCount(now: Date = new Date()): number {
  if (now.getMonth() === 11) {
    return Math.min(24, Math.max(1, now.getDate()));
  }
  return 0;
}

/**
 * Computes the visual status of a calendar day for a given member:
 * - 'taken' (red): member already claimed this day
 * - 'available' (green): day is unlocked (<= unlockedDaysCount) and not yet claimed
 * - 'upcoming' (white/gray): day is not yet unlocked (> unlockedDaysCount)
 */
export function getDayStatusForMember(
  dayNumber: number,
  unlockedDaysCount: number,
  memberTakenDays: number[]
): DayVisualStatus {
  if (memberTakenDays.includes(dayNumber)) {
    return 'taken';
  }
  if (dayNumber <= unlockedDaysCount) {
    return 'available';
  }
  return 'upcoming';
}

export function computeMemberTakenDays(memberUid: string, claims: DayClaim[]): number[] {
  const set = new Set<number>();
  for (const claim of claims) {
    if (claim.memberUid === memberUid) {
      set.add(claim.dayNumber);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function computeMemberProgressStats(
  members: Member[],
  claims: DayClaim[],
  unlockedDaysCount = 24
): MemberProgressStats[] {
  return members
    .filter((member) => !member.isSupervisor)
    .map((member) => {
    const takenDayNumbers = computeMemberTakenDays(member.uid, claims);
    const takenSet = new Set(takenDayNumbers);
    const daysTakenCount = takenDayNumbers.length;
    const takenUnlockedCount = takenDayNumbers.filter((d) => d <= unlockedDaysCount).length;
    const daysToRecoverCount = Math.max(0, unlockedDaysCount - takenUnlockedCount);

    const missingDayNumbers = ADVENT_DAY_NUMBERS.filter(
      (dayNum) => dayNum <= unlockedDaysCount && !takenSet.has(dayNum)
    );

    return {
      member,
      daysTakenCount,
      takenDayNumbers,
      unlockedDaysCount,
      daysToRecoverCount,
      missingDayNumbers,
    };
  });
}
