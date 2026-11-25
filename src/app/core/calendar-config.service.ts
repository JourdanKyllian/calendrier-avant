import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Unsubscribe, addDoc, collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { AuthService } from './auth.service';
import { CalendarService } from './calendar.service';
import { ensureAnonymousAuth, getFirebaseClients } from './firebase';
import { CalendarDayConfig, ChocolateCatalogItem, KINDER_CHOCOLATES } from './models';

function parsePositiveInt(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.floor(num) : fallback;
}

@Injectable({ providedIn: 'root' })
export class CalendarConfigService {
  private readonly authService = inject(AuthService);
  private readonly calendarService = inject(CalendarService);

  readonly chocolates = signal<ChocolateCatalogItem[]>([]);
  readonly dayConfigsMap = signal<Record<number, CalendarDayConfig>>({});
  readonly configLoaded = signal(false);

  readonly configuredCount = computed(() => Object.keys(this.dayConfigsMap()).length);

  readonly catalogItems = computed<ChocolateCatalogItem[]>(() => {
    const dbItems = this.chocolates();
    if (dbItems.length > 0) {
      return dbItems;
    }
    return KINDER_CHOCOLATES.map((name, idx) => ({
      id: `preset-${idx}`,
      name,
      totalCount: 0,
      emoji: '🍫',
    }));
  });

  readonly usedCountsByChocolate = computed<Record<string, number>>(() => {
    const participantsCount = Math.max(1, this.calendarService.participants().length);
    const counts: Record<string, number> = {};
    for (const cfg of Object.values(this.dayConfigsMap())) {
      const key = cfg.chocolateName.trim().toLowerCase();
      counts[key] = (counts[key] ?? 0) + cfg.quantityPerPerson * participantsCount;
    }
    return counts;
  });

  private unsubs: Unsubscribe[] = [];
  private loadedForUid: string | null | undefined = undefined;

  constructor() {
    effect(() => {
      const user = this.authService.currentMember();
      const nextUid = user?.uid ?? null;
      if (this.loadedForUid === nextUid) return;
      this.loadedForUid = nextUid;
      this.teardown();

      if (!user || !this.authService.firebaseConfigured()) {
        this.chocolates.set([]);
        this.dayConfigsMap.set({});
        this.configLoaded.set(true);
        return;
      }

      this.configLoaded.set(false);

      let active = true;
      void ensureAnonymousAuth()
        .then(() => {
          if (!active) return;
          const { db } = getFirebaseClients();

          const unsubChocos = onSnapshot(
            collection(db, 'chocolates'),
            (snap) => {
              const items = snap.docs
                .map((d) => {
                  const raw = d.data() as Record<string, unknown>;
                  return {
                    id: d.id,
                    name: String(raw['name'] ?? d.id).trim(),
                    totalCount: parsePositiveInt(
                      raw['totalCount'] ?? raw['count'] ?? raw['quantity'],
                      0
                    ),
                    emoji: typeof raw['emoji'] === 'string' && raw['emoji'] ? raw['emoji'] : '🍫',
                  };
                })
                .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
              this.chocolates.set(items);
            },
            (err) => console.error('Erreur Firestore chocolates :', err)
          );

          const unsubDays = onSnapshot(
            collection(db, 'calendar_days'),
            (snap) => {
              const nextMap: Record<number, CalendarDayConfig> = {};
              for (const d of snap.docs) {
                const raw = d.data() as Partial<CalendarDayConfig>;
                const dayNum = parsePositiveInt(raw.dayNumber ?? d.id, 0);
                if (dayNum >= 1 && dayNum <= 24 && raw.chocolateName) {
                  nextMap[dayNum] = {
                    dayNumber: dayNum,
                    chocolateName: String(raw.chocolateName).trim(),
                    quantityPerPerson: Math.max(1, parsePositiveInt(raw.quantityPerPerson, 1)),
                    updatedAt: Number(raw.updatedAt ?? 0),
                  };
                }
              }
              this.dayConfigsMap.set(nextMap);
              this.configLoaded.set(true);
            },
            (err) => {
              console.error('Erreur Firestore calendar_days :', err);
              this.configLoaded.set(true);
            }
          );

          this.unsubs.push(unsubChocos, unsubDays);
        })
        .catch((err) => console.error('Erreur Auth anonyme calendar_days :', err));

      this.unsubs.push(() => {
        active = false;
      });
    });
  }

  private teardown(): void {
    for (const u of this.unsubs) {
      u();
    }
    this.unsubs = [];
  }

  getDayConfig(dayNumber: number): CalendarDayConfig | null {
    return this.dayConfigsMap()[dayNumber] ?? null;
  }

  usedCountForChocolate(item: ChocolateCatalogItem): number {
    return this.usedCountsByChocolate()[item.name.trim().toLowerCase()] ?? 0;
  }

  remainingForChocolate(item: ChocolateCatalogItem): number | null {
    if (item.totalCount <= 0) return null;
    const used = this.usedCountForChocolate(item);
    return item.totalCount - used;
  }

  async addChocolate(name: string, totalCount: number): Promise<void> {
    const member = this.authService.currentMember();
    if (!member?.isSupervisor) {
      throw new Error('Action réservée aux superviseurs.');
    }
    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error('Entre un nom de chocolat.');
    }
    const count = Math.floor(totalCount);
    if (!Number.isInteger(count) || count < 0 || count > 1000) {
      throw new Error('La quantité doit être comprise entre 0 et 1000.');
    }
    const exists = this.chocolates().some(
      (c) => c.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      throw new Error(`${cleanName} existe déjà dans le stock.`);
    }

    await ensureAnonymousAuth();
    const { db } = getFirebaseClients();
    await addDoc(collection(db, 'chocolates'), {
      name: cleanName,
      totalCount: count,
    });
  }

  async updateChocolateStock(chocoId: string, totalCount: number): Promise<void> {
    const member = this.authService.currentMember();
    if (!member?.isSupervisor) {
      throw new Error('Action réservée aux superviseurs.');
    }
    const count = Math.floor(totalCount);
    if (!Number.isInteger(count) || count < 0 || count > 1000) {
      throw new Error('La quantité doit être comprise entre 0 et 1000.');
    }
    const current = this.chocolates().find((c) => c.id === chocoId);
    if (!current) {
      throw new Error('Chocolat introuvable en base.');
    }

    await ensureAnonymousAuth();
    const { db } = getFirebaseClients();
    await updateDoc(doc(db, 'chocolates', chocoId), { totalCount: count });
  }

  async saveDayConfig(
    dayNumber: number,
    chocolateName: string,
    quantityPerPerson: number
  ): Promise<void> {
    const member = this.authService.currentMember();
    if (!member?.isSupervisor) {
      throw new Error('Action réservée aux superviseurs.');
    }
    const cleanName = chocolateName.trim();
    if (!cleanName) {
      throw new Error('Choisis un chocolat pour cette case.');
    }
    const qty = Math.floor(quantityPerPerson);
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 24) {
      throw new Error('Numéro de jour invalide.');
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      throw new Error('Le nombre par personne doit être entre 1 et 20.');
    }

    await ensureAnonymousAuth();
    const { db } = getFirebaseClients();
    await setDoc(doc(db, 'calendar_days', String(dayNumber)), {
      dayNumber,
      chocolateName: cleanName,
      quantityPerPerson: qty,
      updatedAt: Date.now(),
    });
  }

  async clearDayConfig(dayNumber: number): Promise<void> {
    const member = this.authService.currentMember();
    if (!member?.isSupervisor) {
      throw new Error('Action réservée aux superviseurs.');
    }
    await ensureAnonymousAuth();
    const { db } = getFirebaseClients();
    await deleteDoc(doc(db, 'calendar_days', String(dayNumber)));
  }
}
