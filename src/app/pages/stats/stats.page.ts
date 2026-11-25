import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { CalendarConfigService } from '../../core/calendar-config.service';
import { CalendarService } from '../../core/calendar.service';
import { InventoryService } from '../../core/inventory.service';
import { ChocolateCatalogItem } from '../../core/models';
import { ChocolateIconComponent } from '../../shared/chocolate-icon.component';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [
    FormsModule,
    ChocolateIconComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonBadge,
    IonButton,
    IonSelect,
    IonSelectOption,
    IonSkeletonText,
    IonToast,
  ],
  templateUrl: './stats.page.html',
  styleUrl: './stats.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPage {
  protected readonly authService = inject(AuthService);
  protected readonly calendarService = inject(CalendarService);
  protected readonly configService = inject(CalendarConfigService);
  protected readonly inventoryService = inject(InventoryService);
  protected readonly Math = Math;
  private readonly router = inject(Router);

  readonly busy = signal(false);
  readonly toastMessage = signal('');
  private readonly draftStocks = signal<Record<string, number>>({});

  readonly logMemberUid = signal('');
  readonly logSource = signal<'surplus' | 'member'>('surplus');
  readonly logChocolate = signal('');

  readonly primarySupervisor = computed(
    () => this.calendarService.members().find((m) => m.isSupervisor) ?? null
  );

  readonly supervisorsLabel = computed(() => {
    const names = this.calendarService
      .members()
      .filter((m) => m.isSupervisor)
      .map((m) => m.name);
    if (names.length === 0) return 'la supervision';
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
  });

  readonly logAvailableStock = computed(() => {
    if (this.logSource() === 'surplus') {
      return this.inventoryService.supervisorSurplus();
    }
    const uid = this.logMemberUid();
    return uid ? this.inventoryService.getMemberStock(uid) : [];
  });

  readonly myStock = computed(() => {
    const me = this.authService.currentMember();
    if (!me || me.isSupervisor) return [];
    return this.inventoryService.getMemberStock(me.uid);
  });

  readonly myStockTotalCount = computed(() =>
    this.myStock().reduce((sum, item) => sum + item.quantity, 0)
  );

  readonly surplusTotalCount = computed(() =>
    this.inventoryService.supervisorSurplus().reduce((sum, item) => sum + item.quantity, 0)
  );

  draftStock(item: ChocolateCatalogItem): number {
    return this.draftStocks()[item.id] ?? item.totalCount;
  }

  hasPendingStockChange(item: ChocolateCatalogItem): boolean {
    const draft = this.draftStocks()[item.id];
    return draft !== undefined && draft !== item.totalCount;
  }

  setDraftStock(id: string, raw: string): void {
    const digits = raw.replace(/\D+/g, '');
    const val = digits ? Math.max(0, Math.min(1000, Number(digits))) : 0;
    this.draftStocks.update((m) => ({ ...m, [id]: val }));
  }

  selectAllInput(input: HTMLInputElement): void {
    setTimeout(() => {
      try {
        input.select();
        input.setSelectionRange?.(0, input.value.length);
      } catch {
        // Ignore on input types that disallow selection range.
      }
    }, 0);
  }

  stepStock(item: ChocolateCatalogItem, delta: number): void {
    const next = Math.max(0, Math.min(1000, this.draftStock(item) + delta));
    this.draftStocks.update((m) => ({ ...m, [item.id]: next }));
  }

  async saveStock(item: ChocolateCatalogItem): Promise<void> {
    this.busy.set(true);
    try {
      const next = this.draftStock(item);
      await this.configService.updateChocolateStock(item.id, next);
      this.draftStocks.update((m) => {
        const copy = { ...m };
        delete copy[item.id];
        return copy;
      });
      this.toastMessage.set(`Stock ${item.name} enregistré (${next}).`);
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Erreur stock.');
    } finally {
      this.busy.set(false);
    }
  }

  async markEaten(chocolateName: string): Promise<void> {
    try {
      await this.inventoryService.markEaten(chocolateName, 1);
      this.toastMessage.set(`-1 ${chocolateName} noté comme mangé.`);
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Erreur.');
    }
  }

  onLogSourceOrMemberChange(): void {
    const options = this.logAvailableStock();
    const current = this.logChocolate();
    if (!options.some((o) => o.chocolateName === current)) {
      this.logChocolate.set(options[0]?.chocolateName ?? '');
    }
  }

  async submitSupervisorConsumption(): Promise<void> {
    const me = this.authService.currentMember();
    if (!me?.isSupervisor) return;
    const choco = this.logChocolate().trim();
    if (!choco) return;

    const targetUid = this.logMemberUid();
    const targetMember = this.calendarService.participants().find((p) => p.uid === targetUid) ?? null;

    if (this.logSource() === 'member' && !targetMember) {
      this.toastMessage.set('Choisis un membre pour déduire de son stock.');
      return;
    }

    this.busy.set(true);
    try {
      await this.inventoryService.markEaten(choco, 1, {
        sourceMemberUid: this.logSource() === 'surplus' ? me.uid : targetMember!.uid,
        recipient:
          this.logSource() === 'surplus' && targetMember
            ? { uid: targetMember.uid, name: targetMember.name }
            : null,
      });
      const whoLabel = targetMember ? targetMember.name : 'le surplus';
      this.toastMessage.set(`Noté : -1 ${choco} (${whoLabel}).`);
      this.onLogSourceOrMemberChange();
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      this.busy.set(false);
    }
  }

  proposeTargetedTrade(targetUid: string, requestedChocolate: string): void {
    void this.router.navigate(['/tabs/history'], {
      queryParams: { targetUid, requested: requestedChocolate },
    });
  }
}
