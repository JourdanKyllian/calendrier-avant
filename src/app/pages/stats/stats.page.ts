import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBadge,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonProgressBar,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { CalendarService } from '../../core/calendar.service';
import { InventoryService } from '../../core/inventory.service';
import { ChocolateIconComponent } from '../../shared/chocolate-icon.component';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [
    ChocolateIconComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonProgressBar,
    IonBadge,
    IonToast,
  ],
  templateUrl: './stats.page.html',
  styleUrl: './stats.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPage {
  protected readonly authService = inject(AuthService);
  protected readonly calendarService = inject(CalendarService);
  protected readonly inventoryService = inject(InventoryService);
  private readonly router = inject(Router);

  readonly toastMessage = signal('');

  readonly primarySupervisor = computed(
    () => this.calendarService.members().find((m) => m.isSupervisor) ?? null
  );

  progressRatio(taken: number, unlocked: number): number {
    if (unlocked <= 0) return 0;
    return Math.min(1, taken / unlocked);
  }

  recoverLabel(toRecover: number): string {
    if (toRecover === 0) return 'À jour';
    return `${toRecover} à récupérer`;
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
