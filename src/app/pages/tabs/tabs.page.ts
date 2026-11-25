import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonToast,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowUndoOutline,
  barChartOutline,
  calendarOutline,
  personCircleOutline,
  timeOutline,
} from 'ionicons/icons';
import { CalendarService } from '../../core/calendar.service';
import { UNDO_WINDOW_MS } from '../../core/equity';
import { DayClaim } from '../../core/models';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonButton, IonToast],
  templateUrl: './tabs.page.html',
  styleUrl: './tabs.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsPage {
  protected readonly calendarService = inject(CalendarService);

  readonly toastMessage = signal('');

  readonly undoProgressPercent = computed(() => {
    const pending = this.calendarService.pendingUndo();
    if (!pending) return 0;
    const totalSeconds = Math.round(UNDO_WINDOW_MS / 1000);
    return Math.min(100, Math.max(0, (pending.secondsLeft / totalSeconds) * 100));
  });

  constructor() {
    addIcons({
      calendarOutline,
      barChartOutline,
      timeOutline,
      personCircleOutline,
      arrowUndoOutline,
    });
  }

  formatDays(claims: DayClaim[]): string {
    const uniqueDays = Array.from(new Set(claims.map((c) => c.dayNumber))).sort((a, b) => a - b);
    return uniqueDays.map((d) => `#${d}`).join(', ');
  }

  async undoAllPending(): Promise<void> {
    try {
      const count = await this.calendarService.undoPendingClaims();
      if (count > 0) {
        this.toastMessage.set(
          count === 1 ? 'Prise annulée !' : `${count} prises annulées !`
        );
      }
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Impossible d’annuler.');
    }
  }
}
