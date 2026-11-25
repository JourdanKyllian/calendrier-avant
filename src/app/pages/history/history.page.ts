import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { swapHorizontalOutline, trashOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth.service';
import { CalendarService } from '../../core/calendar.service';
import { ADVENT_DAY_NUMBERS, canCancelClaim, getDayStatusForMember } from '../../core/equity';
import { InventoryService } from '../../core/inventory.service';
import { ChocolateStockEntry, DayClaim, DayVisualStatus, TradeOffer } from '../../core/models';
import {
  TradeService,
  formatTradeMessage,
  isOpenRequestedChocolate,
} from '../../core/trade.service';
import { ChocolateIconComponent } from '../../shared/chocolate-icon.component';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ChocolateIconComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonChip,
    IonLabel,
    IonList,
    IonItem,
    IonButton,
    IonIcon,
    IonSelect,
    IonSelectOption,
    IonToast,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonBadge,
  ],
  templateUrl: './history.page.html',
  styleUrl: './history.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPage {
  protected readonly authService = inject(AuthService);
  protected readonly calendarService = inject(CalendarService);
  protected readonly inventoryService = inject(InventoryService);
  protected readonly tradeService = inject(TradeService);
  private readonly route = inject(ActivatedRoute, { optional: true });

  readonly otherMembers = computed(() => {
    const meUid = this.authService.currentMember()?.uid;
    return this.calendarService.members().filter((m) => m.uid !== meUid);
  });

  readonly myAvailableStock = computed<ChocolateStockEntry[]>(() => {
    const meUid = this.authService.currentMember()?.uid;
    return meUid ? this.inventoryService.getAvailableTradeStock(meUid) : [];
  });

  readonly tradeComposerOpen = signal(false);
  readonly tradeBusy = signal(false);
  readonly targetMemberUid = signal('');
  readonly offeredChoice = signal('');
  readonly requestedChoice = signal('À décider ensemble');

  readonly activeActionTradeId = signal<string | null>(null);
  readonly activeActionMode = signal<'accept-open' | 'counter' | null>(null);
  readonly actionSelectedChocolate = signal('');

  readonly targetAvailableStock = computed<ChocolateStockEntry[]>(() => {
    const targetUid = this.targetMemberUid();
    if (!targetUid) return [];
    const offered = this.offeredChoice().trim().toLowerCase();
    return this.inventoryService
      .getAvailableTradeStock(targetUid)
      .filter((item) => item.chocolateName.trim().toLowerCase() !== offered);
  });

  readonly filterMemberUid = signal<string>('all');
  readonly toastMessage = signal('');
  readonly calendarNumbers = ADVENT_DAY_NUMBERS;

  readonly visibleTrades = computed(() =>
    this.tradeService
      .trades()
      .filter((t) => t.status !== 'cancelled')
      .slice(0, 8)
  );

  readonly selectedMemberStats = computed(() => {
    const uid = this.filterMemberUid();
    if (uid === 'all') return null;
    return this.calendarService.memberStats().find((s) => s.member.uid === uid) ?? null;
  });

  readonly filteredClaims = computed(() => {
    const uid = this.filterMemberUid();
    const list = this.calendarService.claims();
    if (uid === 'all') return list;
    return list.filter((c) => c.memberUid === uid);
  });

  constructor() {
    addIcons({ trashOutline, swapHorizontalOutline });
    this.route?.queryParamMap.subscribe((params) => {
      const targetUid = params.get('targetUid');
      const requested = params.get('requested');
      if (targetUid || requested) {
        this.openTradeComposer(targetUid ?? '', requested ?? '');
      }
    });
  }

  effectiveTarget(): { uid: string; name: string } | null {
    const uid = this.targetMemberUid();
    if (!uid) return null;
    const found = this.calendarService.members().find((m) => m.uid === uid);
    return found ? { uid: found.uid, name: found.name } : null;
  }

  onTargetChange(uid: string): void {
    this.targetMemberUid.set(uid);
    if (!uid) {
      this.requestedChoice.set('À décider ensemble');
      return;
    }
    const targetOptions = this.targetAvailableStock();
    const current = this.requestedChoice();
    const stillValid = targetOptions.some((o) => o.chocolateName === current);
    this.requestedChoice.set(stillValid ? current : (targetOptions[0]?.chocolateName ?? ''));
  }

  onOfferedChange(chocolateName: string): void {
    this.offeredChoice.set(chocolateName);
    if (!this.targetMemberUid()) return;
    const targetOptions = this.targetAvailableStock();
    const current = this.requestedChoice();
    const stillValid = targetOptions.some((o) => o.chocolateName === current);
    if (!stillValid) {
      this.requestedChoice.set(targetOptions[0]?.chocolateName ?? '');
    }
  }

  canPublishTrade(): boolean {
    const offered = this.offeredChoice().trim();
    if (!offered) return false;
    if (!this.targetMemberUid()) return true;
    const requested = this.requestedChoice().trim();
    if (!requested) return false;
    return offered.toLowerCase() !== requested.toLowerCase();
  }

  tradePreview(): string {
    const name = this.authService.currentMember()?.name ?? 'Moi';
    const offered = this.offeredChoice() || 'Chocolat';
    const requested = this.targetMemberUid()
      ? this.requestedChoice() || 'À décider ensemble'
      : 'À décider ensemble';
    return formatTradeMessage(name, offered, requested, this.effectiveTarget()?.name);
  }

  openTradeComposer(prefillTargetUid = '', prefillRequested = ''): void {
    const myStock = this.myAvailableStock();
    const initialOffered =
      myStock.find((s) => s.chocolateName.toLowerCase() !== prefillRequested.toLowerCase())
        ?.chocolateName ??
      myStock[0]?.chocolateName ??
      '';
    this.offeredChoice.set(initialOffered);
    this.targetMemberUid.set(prefillTargetUid);

    if (!prefillTargetUid) {
      this.requestedChoice.set('À décider ensemble');
    } else {
      const targetOptions = this.targetAvailableStock();
      const matching = targetOptions.find(
        (s) => s.chocolateName.toLowerCase() === prefillRequested.trim().toLowerCase()
      );
      this.requestedChoice.set(
        matching?.chocolateName ?? targetOptions[0]?.chocolateName ?? ''
      );
    }
    this.tradeComposerOpen.set(true);
  }

  async submitTrade(): Promise<void> {
    if (!this.canPublishTrade()) return;
    this.tradeBusy.set(true);
    try {
      await this.tradeService.proposeTrade(
        this.offeredChoice(),
        this.targetMemberUid() ? this.requestedChoice() : 'À décider ensemble',
        this.effectiveTarget()
      );
      this.tradeComposerOpen.set(false);
      this.toastMessage.set('Proposition d’échange publiée !');
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Erreur lors de la publication.');
    } finally {
      this.tradeBusy.set(false);
    }
  }

  isOpenEndedTrade(trade: TradeOffer): boolean {
    return isOpenRequestedChocolate(trade.requestedChocolate);
  }

  counterOptionsForTrade(trade: TradeOffer): ChocolateStockEntry[] {
    const offeredKey = trade.offeredChocolate.trim().toLowerCase();
    return this.myAvailableStock().filter(
      (item) => item.chocolateName.trim().toLowerCase() !== offeredKey
    );
  }

  hasRequestedInMyStock(trade: TradeOffer): boolean {
    const reqKey = trade.requestedChocolate.trim().toLowerCase();
    return this.myAvailableStock().some(
      (item) => item.chocolateName.trim().toLowerCase() === reqKey
    );
  }

  async onAcceptClick(trade: TradeOffer): Promise<void> {
    if (this.isOpenEndedTrade(trade)) {
      const options = this.counterOptionsForTrade(trade);
      if (options.length === 0) {
        this.toastMessage.set('Aucun autre chocolat disponible dans ton stock.');
        return;
      }
      this.activeActionTradeId.set(trade.id);
      this.activeActionMode.set('accept-open');
      this.actionSelectedChocolate.set(options[0].chocolateName);
      return;
    }

    if (!this.hasRequestedInMyStock(trade)) {
      this.toastMessage.set(
        `Tu n'as pas de ${trade.requestedChocolate} disponible. Utilise Contre-proposer.`
      );
      return;
    }

    this.tradeBusy.set(true);
    try {
      await this.tradeService.acceptTrade(trade);
      this.toastMessage.set('Échange accepté !');
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Impossible d’accepter.');
    } finally {
      this.tradeBusy.set(false);
    }
  }

  openCounterPropose(trade: TradeOffer): void {
    const options = this.counterOptionsForTrade(trade);
    if (options.length === 0) {
      this.toastMessage.set('Aucun autre chocolat disponible pour contre-proposer.');
      return;
    }
    this.activeActionTradeId.set(trade.id);
    this.activeActionMode.set('counter');
    this.actionSelectedChocolate.set(options[0].chocolateName);
  }

  closeTradeAction(): void {
    this.activeActionTradeId.set(null);
    this.activeActionMode.set(null);
    this.actionSelectedChocolate.set('');
  }

  async confirmTradeAction(trade: TradeOffer): Promise<void> {
    const chosen = this.actionSelectedChocolate().trim();
    if (!chosen) return;
    this.tradeBusy.set(true);
    try {
      if (this.activeActionMode() === 'accept-open') {
        await this.tradeService.acceptTrade(trade, chosen);
        this.toastMessage.set('Échange accepté !');
      } else if (this.activeActionMode() === 'counter') {
        await this.tradeService.counterProposeTrade(trade, chosen);
        this.toastMessage.set('Contre-proposition envoyée !');
      }
      this.closeTradeAction();
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Erreur sur cet échange.');
    } finally {
      this.tradeBusy.set(false);
    }
  }

  async cancelTrade(trade: TradeOffer): Promise<void> {
    try {
      await this.tradeService.cancelTrade(trade);
      this.toastMessage.set('Échange annulé.');
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Impossible d’annuler.');
    }
  }

  getMemberEmoji(uid: string): string {
    return this.calendarService.members().find((m) => m.uid === uid)?.emoji ?? '🎄';
  }

  dayStatusForSelectedMember(dayNumber: number): DayVisualStatus {
    const stats = this.selectedMemberStats();
    const takenDays = stats?.takenDayNumbers ?? [];
    return getDayStatusForMember(dayNumber, this.calendarService.unlockedDaysCount(), takenDays);
  }

  canDelete(claim: DayClaim): boolean {
    void this.calendarService.pendingUndo();
    return canCancelClaim(claim, this.authService.currentMember());
  }

  async deleteClaim(claim: DayClaim): Promise<void> {
    try {
      await this.calendarService.cancelClaim(claim);
      this.toastMessage.set('Prise annulée.');
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Erreur lors de la suppression.');
    }
  }
}
