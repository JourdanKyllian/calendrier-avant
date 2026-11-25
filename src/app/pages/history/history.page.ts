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
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { swapHorizontalOutline, trashOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth.service';
import { CalendarConfigService } from '../../core/calendar-config.service';
import { CalendarService } from '../../core/calendar.service';
import { ADVENT_DAY_NUMBERS, canCancelClaim, getDayStatusForMember } from '../../core/equity';
import { DayClaim, DayVisualStatus, KINDER_CHOCOLATES, TradeOffer } from '../../core/models';
import { TradeService, formatTradeMessage } from '../../core/trade.service';
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
    IonInput,
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
  protected readonly configService = inject(CalendarConfigService);
  protected readonly tradeService = inject(TradeService);
  private readonly route = inject(ActivatedRoute, { optional: true });

  readonly chocolateOptions = computed(() => {
    const dbNames = this.configService.catalogItems().map((c) => c.name);
    return dbNames.length > 0 ? dbNames : [...KINDER_CHOCOLATES];
  });
  readonly otherMembers = computed(() => {
    const meUid = this.authService.currentMember()?.uid;
    return this.calendarService.members().filter((m) => m.uid !== meUid);
  });

  readonly tradeComposerOpen = signal(false);
  readonly tradeBusy = signal(false);
  targetMemberUid = '';
  offeredChoice = KINDER_CHOCOLATES[0] as string;
  customOffered = '';
  requestedChoice = 'Peu importe';
  customRequested = '';

  readonly filterMemberUid = signal<string>('all');
  readonly toastMessage = signal('');
  readonly calendarNumbers = ADVENT_DAY_NUMBERS;

  readonly visibleTrades = computed(() =>
    this.tradeService.trades().filter((t) => t.status !== 'cancelled').slice(0, 8)
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
        this.openTradeComposer(targetUid ?? '', requested ?? 'Peu importe');
      }
    });
  }

  effectiveTarget(): { uid: string; name: string } | null {
    if (!this.targetMemberUid) return null;
    const found = this.calendarService.members().find((m) => m.uid === this.targetMemberUid);
    return found ? { uid: found.uid, name: found.name } : null;
  }

  effectiveOffered(): string {
    return this.offeredChoice === '__custom__' ? this.customOffered.trim() : this.offeredChoice;
  }

  effectiveRequested(): string {
    return this.requestedChoice === '__custom__'
      ? this.customRequested.trim()
      : this.requestedChoice;
  }

  tradePreview(): string {
    const name = this.authService.currentMember()?.name ?? 'Moi';
    const offered = this.effectiveOffered() || 'Chocolat';
    const requested = this.effectiveRequested() || 'Peu importe';
    return formatTradeMessage(name, offered, requested, this.effectiveTarget()?.name);
  }

  openTradeComposer(prefillTargetUid = '', prefillRequested = 'Peu importe'): void {
    const options = this.chocolateOptions();
    this.targetMemberUid = prefillTargetUid;
    this.offeredChoice = options[0] ?? KINDER_CHOCOLATES[0];
    this.customOffered = '';
    if (prefillRequested === 'Peu importe' || options.includes(prefillRequested)) {
      this.requestedChoice = prefillRequested;
      this.customRequested = '';
    } else {
      this.requestedChoice = '__custom__';
      this.customRequested = prefillRequested;
    }
    this.tradeComposerOpen.set(true);
  }

  async submitTrade(): Promise<void> {
    this.tradeBusy.set(true);
    try {
      await this.tradeService.proposeTrade(
        this.effectiveOffered(),
        this.effectiveRequested(),
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

  async acceptTrade(trade: TradeOffer): Promise<void> {
    try {
      await this.tradeService.acceptTrade(trade);
      this.toastMessage.set('Échange accepté !');
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Impossible d’accepter.');
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
