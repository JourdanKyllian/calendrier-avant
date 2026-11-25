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
  IonIcon,
  IonInput,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline } from 'ionicons/icons';
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
    IonIcon,
    IonInput,
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
  newChocoName = '';
  newChocoTotal = 0;
  private readonly draftStocks = signal<Record<string, number>>({});

  readonly primarySupervisor = computed(
    () => this.calendarService.members().find((m) => m.isSupervisor) ?? null
  );

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

  constructor() {
    addIcons({ addOutline });
  }

  draftStock(item: ChocolateCatalogItem): number {
    return this.draftStocks()[item.id] ?? item.totalCount;
  }

  setDraftStock(id: string, raw: string): void {
    const val = Math.max(0, Math.min(1000, Math.floor(Number(raw) || 0)));
    this.draftStocks.update((m) => ({ ...m, [id]: val }));
  }

  async stepStock(item: ChocolateCatalogItem, delta: number): Promise<void> {
    const next = Math.max(0, Math.min(1000, this.draftStock(item) + delta));
    this.draftStocks.update((m) => ({ ...m, [item.id]: next }));
    await this.saveStock(item);
  }

  async saveStock(item: ChocolateCatalogItem): Promise<void> {
    this.busy.set(true);
    try {
      const next = this.draftStock(item);
      await this.configService.updateChocolateStock(item.id, next);
      this.toastMessage.set(`Stock ${item.name} enregistré (${next}).`);
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Erreur stock.');
    } finally {
      this.busy.set(false);
    }
  }

  async addChocolate(): Promise<void> {
    this.busy.set(true);
    try {
      await this.configService.addChocolate(this.newChocoName, Number(this.newChocoTotal) || 0);
      this.toastMessage.set(`${this.newChocoName.trim()} ajouté au stock.`);
      this.newChocoName = '';
      this.newChocoTotal = 0;
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Erreur ajout.');
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

  proposeTargetedTrade(targetUid: string, requestedChocolate: string): void {
    void this.router.navigate(['/tabs/history'], {
      queryParams: { targetUid, requested: requestedChocolate },
    });
  }
}
