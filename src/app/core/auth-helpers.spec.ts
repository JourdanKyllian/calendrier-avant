import {
  DEFAULT_PIN,
  hashPinLocal,
  isSupervisorRecord,
  isValidPin,
  normalizeMemberSlug,
} from './auth-helpers';

describe('auth-helpers', () => {
  it('parses supervisor flags safely for booleans, stringified booleans, and roles', () => {
    expect(isSupervisorRecord({ isSupervisor: false })).toBe(false);
    expect(isSupervisorRecord({ isSupervisor: 'false' })).toBe(false);
    expect(isSupervisorRecord({ isSupervisor: '' })).toBe(false);
    expect(isSupervisorRecord({})).toBe(false);
    expect(isSupervisorRecord({ isSupervisor: true })).toBe(true);
    expect(isSupervisorRecord({ isSupervisor: 'true' })).toBe(true);
    expect(isSupervisorRecord({ role: 'supervisor' })).toBe(true);
    expect(isSupervisorRecord({ role: 'superviseur' })).toBe(true);
  });

  it('normalizes names with accents, spaces, and uppercase', () => {
    expect(normalizeMemberSlug('  Élodie Martin  ')).toBe('elodie-martin');
    expect(normalizeMemberSlug('Kyllian')).toBe('kyllian');
    expect(normalizeMemberSlug('Jean_Luc 2')).toBe('jean-luc-2');
  });

  it('validates strict 4-digit PINs including 0000', () => {
    expect(isValidPin(DEFAULT_PIN)).toBe(true);
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('abcd')).toBe(false);
  });

  it('hashes valid 4-digit PINs deterministically in pure JS', () => {
    const h1 = hashPinLocal('0000');
    const h2 = hashPinLocal('0000');
    const h3 = hashPinLocal('1234');
    expect(h1).toHaveLength(64);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(() => hashPinLocal('12a4')).toThrow();
  });
});
