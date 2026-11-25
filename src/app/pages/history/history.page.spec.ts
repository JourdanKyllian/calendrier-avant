import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { CalendarConfigService } from '../../core/calendar-config.service';
import { CalendarService } from '../../core/calendar.service';
import { FirebaseCalendarStore } from '../../core/firebase-calendar.store';
import { InventoryService } from '../../core/inventory.service';
import { ChocolateStockEntry, DayClaim, Member, TradeOffer } from '../../core/models';
import { TradeService } from '../../core/trade.service';
import { HistoryPage } from './history.page';

describe('HistoryPage', () => {
  const kyllian: Member = {
    uid: 'u1',
    name: 'Kyllian',
    slug: 'kyllian',
    emoji: '🎅',
    color: '#8B2635',
    isAdmin: false,
    hasDefaultPin: false,
    isSupervisor: false,
  };

  const marie: Member = {
    uid: 'u2',
    name: 'Marie',
    slug: 'marie',
    emoji: '🦌',
    color: '#1E6B52',
    isAdmin: false,
    hasDefaultPin: false,
    isSupervisor: false,
  };

  const maman: Member = {
    uid: 'u3',
    name: 'Maman',
    slug: 'maman',
    emoji: '👑',
    color: '#2B6CB0',
    isAdmin: false,
    hasDefaultPin: false,
    isSupervisor: true,
  };

  let claimsState: DayClaim[] = [];
  let onClaimsChange: ((claims: DayClaim[]) => void) | null = null;
  let tradesSignal = signal<TradeOffer[]>([]);
  const mockTradeService = {
    trades: tradesSignal,
    openTrades: signal<TradeOffer[]>([]),
    proposeTrade: vi.fn(async (offered: string, requested: string) => {
      const created: TradeOffer = {
        id: 't-new',
        authorUid: 'u1',
        authorName: 'Kyllian',
        offeredChocolate: offered,
        requestedChocolate: requested,
        message: `Kyllian souhaite échanger son ${offered} contre un ${requested}`,
        status: 'open',
        createdAt: Date.now(),
      };
      tradesSignal.set([created, ...tradesSignal()]);
      return created;
    }),
    acceptTrade: vi.fn(async (trade: TradeOffer) => {
      tradesSignal.set(
        tradesSignal().map((t) =>
          t.id === trade.id ? { ...t, status: 'accepted', acceptedByUid: 'u1', acceptedByName: 'Kyllian' } : t
        )
      );
    }),
    cancelTrade: vi.fn(async () => {}),
    tradesLoaded: () => true,
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = new Date(2026, 11, 4, 12, 0, 0).getTime();
    vi.setSystemTime(now);
    tradesSignal.set([]);
    mockTradeService.proposeTrade.mockClear();
    mockTradeService.acceptTrade.mockClear();

    claimsState = [
      {
        id: 'c1',
        memberUid: 'u1',
        memberName: 'Kyllian',
        dayNumber: 4,
        createdAt: now - 5_000,
      },
      {
        id: 'c2',
        memberUid: 'u2',
        memberName: 'Marie',
        dayNumber: 2,
        createdAt: now - 120_000,
      },
    ];
    onClaimsChange = null;

    const mockAuth = {
      currentMember: signal<Member | null>(kyllian),
      authReady: signal(true),
      firebaseConfigured: signal(true),
    };

    const mockStore = {
      subscribeMembers: (onData: (m: Member[]) => void) => {
        onData([kyllian, marie, maman]);
        return () => {};
      },
      subscribeClaims: (onData: (c: DayClaim[]) => void) => {
        onClaimsChange = onData;
        onData(claimsState);
        return () => {};
      },
      createClaim: async (payload: Omit<DayClaim, 'id'>) => ({ id: 'new', ...payload }),
      deleteClaim: async (id: string) => {
        claimsState = claimsState.filter((c) => c.id !== id);
        onClaimsChange?.(claimsState);
      },
      deleteClaimsBatch: async () => {},
      updateMember: async () => {},
    };

    await TestBed.configureTestingModule({
      imports: [HistoryPage],
      providers: [
        provideIonicAngular(),
        { provide: AuthService, useValue: mockAuth },
        { provide: FirebaseCalendarStore, useValue: mockStore },
        { provide: TradeService, useValue: mockTradeService },
        {
          provide: CalendarConfigService,
          useValue: {
            configuredCount: () => 0,
          },
        },
        {
          provide: InventoryService,
          useValue: {
            consumptions: () => [],
            consumptionsLoaded: () => true,
            supervisorSurplus: () => [{ chocolateName: 'KitKat', quantity: 3 }],
            getAvailableTradeStock: (uid: string): ChocolateStockEntry[] => {
              if (uid === 'u1') {
                return [
                  { chocolateName: 'Kinder Bueno', quantity: 1 },
                  { chocolateName: 'Mars', quantity: 2 },
                ];
              }
              if (uid === 'u2') {
                return [
                  { chocolateName: 'Kinder Bueno', quantity: 1 },
                  { chocolateName: 'KitKat', quantity: 1 },
                ];
              }
              return [];
            },
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(CalendarService).dismissPendingUndo();
    vi.useRealTimers();
  });

  it('lists participant filter chips without supervisors and filters claims + mini calendar', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const chipTexts = Array.from(el.querySelectorAll('ion-chip')).map((c) =>
      c.textContent?.trim()
    );
    expect(chipTexts).toEqual(['Tous', '🎅 Kyllian', '🦌 Marie', '👑 Maman']);

    expect(el.querySelectorAll('ion-item').length).toBe(2);

    const marieChip = el.querySelectorAll('ion-chip')[2] as HTMLElement;
    marieChip.click();
    await fixture.whenStable();

    expect(el.querySelectorAll('ion-item').length).toBe(1);
    expect(el.textContent).toContain('Marie a pris la case 2 décembre');
    expect(el.querySelectorAll('.mini-day-box.taken-red').length).toBe(1);
    expect(el.querySelectorAll('.mini-day-box.available-green').length).toBe(3);
  });

  it('allows cancelling only own recent claims within the 30-second window', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const cancelButtons = el.querySelectorAll('.history-list ion-button');
    expect(cancelButtons.length).toBe(1);

    (cancelButtons[0] as HTMLElement).click();
    await fixture.whenStable();

    expect(el.querySelectorAll('ion-item').length).toBe(1);
    expect(el.textContent).toContain('Marie a pris la case 2 décembre');
  });

  it('shows empty trade message next to Proposer un échange button and lets user propose/accept trades', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Aucun échange proposé pour le moment.');
    const proposeBtn = el.querySelector('.empty-trades-row ion-button') as HTMLElement;
    expect(proposeBtn.textContent).toContain('Proposer un échange');

    proposeBtn.click();
    await fixture.whenStable();

    const publishBtn = el.querySelector('.composer-actions ion-button:last-child') as HTMLElement;
    publishBtn.click();
    await fixture.whenStable();

    expect(mockTradeService.proposeTrade).toHaveBeenCalledWith(
      'Kinder Bueno',
      'À décider ensemble',
      null
    );
    expect(tradesSignal().length).toBe(1);

    tradesSignal.set([
      {
        id: 't2',
        authorUid: 'u2',
        authorName: 'Marie',
        offeredChocolate: 'Kinder Maxi',
        requestedChocolate: 'Kinder Bueno',
        message: 'Marie souhaite échanger son Kinder Maxi contre un Kinder Bueno',
        status: 'open',
        createdAt: Date.now(),
      },
    ]);
    await fixture.whenStable();

    const acceptBtn = el.querySelector('.trade-row ion-button') as HTMLElement;
    expect(acceptBtn.textContent).toContain('Accepter');
    acceptBtn.click();
    await fixture.whenStable();

    expect(mockTradeService.acceptTrade).toHaveBeenCalled();
  });

  it('filters out the offered chocolate from target stock to prevent useless same-chocolate trades', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    await fixture.whenStable();
    const component = fixture.componentInstance;

    component.openTradeComposer('u2', 'KitKat');
    expect(component.offeredChoice()).toBe('Kinder Bueno');
    expect(component.targetAvailableStock().map((s) => s.chocolateName)).toEqual(['KitKat']);

    component.onTargetChange('');
    expect(component.requestedChoice()).toBe('À décider ensemble');
  });
});
