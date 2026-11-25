import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { CalendarPage } from '../pages/calendar/calendar.page';
import { SupervisorDaysModalComponent } from '../pages/calendar/supervisor-days-modal.component';
import { TabsPage } from '../pages/tabs/tabs.page';
import { AuthService } from './auth.service';
import { CalendarConfigService } from './calendar-config.service';
import { CalendarService } from './calendar.service';
import { FirebaseCalendarStore } from './firebase-calendar.store';
import { CalendarDayConfig, DayClaim, Member } from './models';

describe('CalendarService batch undo (Firebase store)', () => {
  const demoUser: Member = {
    uid: 'u1',
    name: 'Kyllian',
    slug: 'kyllian',
    emoji: '🎅',
    color: '#8B2635',
    isAdmin: true,
    hasDefaultPin: false,
    isSupervisor: false,
  };

  const supervisorUser: Member = {
    uid: 'u-sup',
    name: 'Maman',
    slug: 'maman',
    emoji: '👑',
    color: '#1E6B52',
    isAdmin: false,
    hasDefaultPin: false,
    isSupervisor: true,
  };

  let claimsState: DayClaim[] = [];
  let onClaimsChange: ((claims: DayClaim[]) => void) | null = null;
  let currentMemberSignal = signal<Member | null>(demoUser);
  let dayConfigsSignal = signal<Record<number, CalendarDayConfig>>({});
  let nextId = 1;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 11, 5, 10, 0, 0));
    claimsState = [];
    onClaimsChange = null;
    currentMemberSignal = signal<Member | null>(demoUser);
    dayConfigsSignal.set({});
    nextId = 1;

    const mockAuth = {
      currentMember: currentMemberSignal,
      authReady: signal(true),
      firebaseConfigured: signal(true),
    };

    const mockStore = {
      subscribeMembers: (onData: (m: Member[]) => void) => {
        onData([demoUser, supervisorUser]);
        return () => {};
      },
      subscribeClaims: (onData: (c: DayClaim[]) => void) => {
        onClaimsChange = onData;
        onData(claimsState);
        return () => {};
      },
      createClaim: async (payload: Omit<DayClaim, 'id'>) => {
        const created: DayClaim = { id: `claim-${nextId++}`, ...payload };
        claimsState = [created, ...claimsState];
        onClaimsChange?.(claimsState);
        return created;
      },
      deleteClaim: async (id: string) => {
        claimsState = claimsState.filter((c) => c.id !== id);
        onClaimsChange?.(claimsState);
      },
      deleteClaimsBatch: async (ids: string[]) => {
        const toRemove = new Set(ids);
        claimsState = claimsState.filter((c) => !toRemove.has(c.id));
        onClaimsChange?.(claimsState);
      },
      updateMember: async () => {},
    };

    await TestBed.configureTestingModule({
      imports: [TabsPage, CalendarPage, SupervisorDaysModalComponent],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuth },
        { provide: FirebaseCalendarStore, useValue: mockStore },
        {
          provide: CalendarConfigService,
          useValue: {
            chocolates: () => [
              { id: 'ch1', name: 'Kinder Bueno', totalCount: 12 },
              { id: 'ch2', name: 'Mars', totalCount: 8 },
            ],
            configuredCount: () => Object.keys(dayConfigsSignal()).length,
            getDayConfig: (dayNum: number) => dayConfigsSignal()[dayNum] ?? null,
            catalogItems: () => [
              { id: 'ch1', name: 'Kinder Bueno', totalCount: 12 },
              { id: 'ch2', name: 'Mars', totalCount: 8 },
            ],
            usedCountForChocolate: () => 0,
            remainingForChocolate: () => null,
            saveDayConfig: vi.fn(async () => {}),
            clearDayConfig: vi.fn(async () => {}),
            updateChocolateStock: vi.fn(async () => {}),
            addChocolate: vi.fn(async () => {}),
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    const calendar = TestBed.inject(CalendarService);
    calendar.dismissPendingUndo();
    vi.useRealTimers();
  });

  it('accumulates multiple claims in the 30s window and batch-deletes them all on undoPendingClaims', async () => {
    const calendar = TestBed.inject(CalendarService);
    TestBed.flushEffects();

    for (const dayNum of [1, 2, 3]) {
      await calendar.claimDay(dayNum);
    }

    expect(calendar.claims().length).toBe(3);
    expect(calendar.pendingUndo()?.claims.length).toBe(3);

    const cancelled = await calendar.undoPendingClaims();
    expect(cancelled).toBe(3);
    expect(calendar.claims().length).toBe(0);
    expect(calendar.pendingUndo()).toBeNull();
  });

  it('renders TabsPage floating popup and CalendarPage DOM for all 3 claimed days when clicking Tout annuler', async () => {
    const tabsFixture = TestBed.createComponent(TabsPage);
    const calFixture = TestBed.createComponent(CalendarPage);
    await tabsFixture.whenStable();
    await calFixture.whenStable();

    const calEl = calFixture.nativeElement as HTMLElement;
    expect(calEl.querySelectorAll('.claim-btn').length).toBe(5);

    for (let i = 0; i < 3; i++) {
      (calEl.querySelectorAll('.claim-btn')[0] as HTMLButtonElement).click();
      await calFixture.whenStable();
      await tabsFixture.whenStable();
    }

    expect(calEl.querySelectorAll('.day-card.status-taken').length).toBe(3);

    const tabsEl = tabsFixture.nativeElement as HTMLElement;
    const overlayText = tabsEl.querySelector('.undo-toast-overlay')?.textContent ?? '';
    expect(overlayText).toContain('3 cases réclamées');
    expect(overlayText).toContain('Tout annuler');

    (tabsEl.querySelector('.undo-toast-overlay ion-button') as HTMLElement).click();
    await tabsFixture.whenStable();
    await calFixture.whenStable();

    expect(calEl.querySelectorAll('.day-card.status-taken').length).toBe(0);
    expect(calEl.querySelectorAll('.day-card.status-available').length).toBe(5);
  });

  it('blocks claimDay and hides claim buttons for supervisor accounts', async () => {
    currentMemberSignal.set(supervisorUser);
    const calendar = TestBed.inject(CalendarService);
    const calFixture = TestBed.createComponent(CalendarPage);
    await calFixture.whenStable();

    expect(calendar.participants().length).toBe(1);
    await expect(calendar.claimDay(1)).rejects.toThrow('Compte superviseur : lecture seule.');

    const calEl = calFixture.nativeElement as HTMLElement;
    expect(calEl.querySelectorAll('.claim-btn').length).toBe(0);
    expect(calEl.textContent).toContain('Mode superviseur');
    expect(calEl.textContent).toContain('0/1 pris');
    expect(calEl.querySelector('.manage-days-btn')).toBeTruthy();
    expect(calEl.querySelectorAll('.config-dot.missing').length).toBe(24);

    dayConfigsSignal.set({
      1: { dayNumber: 1, chocolateName: 'Kinder Bueno', quantityPerPerson: 2, updatedAt: 1 },
    });
    await calFixture.whenStable();

    expect(calEl.querySelectorAll('.config-dot.filled').length).toBe(1);
    expect(calEl.querySelectorAll('.config-dot.missing').length).toBe(23);
    expect(calEl.textContent).toContain('2× Kinder Bueno');
  });

  it('keeps day chocolate hidden for participants until the day is claimed', async () => {
    dayConfigsSignal.set({
      1: { dayNumber: 1, chocolateName: 'Kinder Bueno', quantityPerPerson: 2, updatedAt: 1 },
      2: { dayNumber: 2, chocolateName: 'Mars', quantityPerPerson: 1, updatedAt: 1 },
    });

    const calFixture = TestBed.createComponent(CalendarPage);
    await calFixture.whenStable();

    const calEl = calFixture.nativeElement as HTMLElement;
    expect(calEl.textContent).not.toContain('Kinder Bueno');
    expect(calEl.textContent).not.toContain('Mars');

    (calEl.querySelectorAll('.claim-btn')[0] as HTMLButtonElement).click();
    await calFixture.whenStable();

    expect(calEl.textContent).toContain('2× Kinder Bueno');
    expect(calEl.textContent).not.toContain('Mars');
  });

  it('renders SupervisorDaysModalComponent with 24 day pills, filters, chocolate choices, and quantity controls', async () => {
    const modalFixture = TestBed.createComponent(SupervisorDaysModalComponent);
    await modalFixture.whenStable();

    const el = modalFixture.nativeElement as HTMLElement;
    expect(el.classList.contains('ion-page')).toBe(true);
    expect(el.querySelectorAll('.day-pill').length).toBe(24);
    expect(el.textContent).toContain('Toutes (24)');
    expect(el.textContent).toContain('Enregistrer Jour 1');
    expect(el.textContent).toContain('Cases du calendrier (0/24)');
  });
});
