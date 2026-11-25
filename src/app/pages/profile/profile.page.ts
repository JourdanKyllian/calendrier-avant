import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
  IonItem,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToggle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { keyOutline, logOutOutline, notificationsOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth.service';
import { CalendarService } from '../../core/calendar.service';
import { InventoryService } from '../../core/inventory.service';
import { MEMBER_COLORS, MEMBER_EMOJIS } from '../../core/models';
import { PushNotificationService } from '../../core/push-notification.service';
import { ChocolateIconComponent } from '../../shared/chocolate-icon.component';

@Component({
  selector: 'app-profile',
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
    IonItem,
    IonInput,
    IonButton,
    IonIcon,
    IonBadge,
    IonToast,
    IonSpinner,
    IonToggle,
  ],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  protected readonly authService = inject(AuthService);
  protected readonly calendarService = inject(CalendarService);
  protected readonly inventoryService = inject(InventoryService);
  protected readonly pushService = inject(PushNotificationService);
  private readonly router = inject(Router);

  readonly emojis = MEMBER_EMOJIS;
  readonly colors = MEMBER_COLORS;

  currentPin = '';
  newPin = '';
  confirmPin = '';
  reminderEnabled = signal(Boolean(this.pushService.reminderTime()));
  reminderTimeInput = this.pushService.reminderTime() || '18:30';

  readonly pinBusy = signal(false);
  readonly pushBusy = signal(false);
  readonly toastMessage = signal('');

  constructor() {
    addIcons({ keyOutline, logOutOutline, notificationsOutline });
  }

  async selectEmoji(emoji: string): Promise<void> {
    const me = this.authService.currentMember();
    if (!me) return;
    await this.calendarService.updateMemberProfile(me.uid, { emoji });
    this.toastMessage.set('Icône mise à jour.');
  }

  async selectColor(color: string): Promise<void> {
    const me = this.authService.currentMember();
    if (!me) return;
    await this.calendarService.updateMemberProfile(me.uid, { color });
    this.toastMessage.set('Couleur mise à jour.');
  }

  async onChangePin(): Promise<void> {
    if (this.newPin !== this.confirmPin) {
      this.toastMessage.set('La confirmation du nouveau PIN ne correspond pas.');
      return;
    }

    this.pinBusy.set(true);
    try {
      await this.authService.changePin(this.currentPin, this.newPin);
      this.currentPin = '';
      this.newPin = '';
      this.confirmPin = '';
      this.toastMessage.set('Code PIN mis à jour ! Tu restes connecté.');
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Erreur lors du changement de PIN.');
    } finally {
      this.pinBusy.set(false);
    }
  }

  async onEnableNotifications(): Promise<void> {
    this.pushBusy.set(true);
    try {
      await this.pushService.enableNotifications();
      if (this.reminderEnabled() && this.reminderTimeInput) {
        await this.pushService.saveReminderTime(this.reminderTimeInput);
      }
      this.toastMessage.set('Notifications activées sur cet appareil !');
    } catch (err: unknown) {
      this.toastMessage.set(
        err instanceof Error ? err.message : 'Impossible d’activer les notifications.'
      );
    } finally {
      this.pushBusy.set(false);
    }
  }

  async onTestNotification(): Promise<void> {
    this.pushBusy.set(true);
    try {
      const res = await this.pushService.sendTestNotification();
      if (res.ok) {
        this.toastMessage.set(`Notification de test envoyée (HTTP ${res.status ?? 201}) !`);
      } else {
        this.toastMessage.set(
          `Échec Push (HTTP ${res.status ?? '?'}) : ${res.detail || 'erreur inconnue'}`
        );
      }
    } catch (err: unknown) {
      this.toastMessage.set(
        err instanceof Error ? err.message : 'Impossible de tester la notification.'
      );
    } finally {
      this.pushBusy.set(false);
    }
  }

  async onToggleReminder(enabled: boolean): Promise<void> {
    this.reminderEnabled.set(enabled);
    if (!enabled) {
      this.pushBusy.set(true);
      try {
        await this.pushService.saveReminderTime('');
        this.toastMessage.set('Rappel quotidien désactivé.');
      } catch (err: unknown) {
        this.toastMessage.set(
          err instanceof Error ? err.message : 'Impossible de désactiver le rappel.'
        );
      } finally {
        this.pushBusy.set(false);
      }
    }
  }

  openTimePicker(input: HTMLInputElement): void {
    try {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      // Fallback to native focus behavior when showPicker is not supported.
    }
  }

  async onDisableNotifications(): Promise<void> {
    this.pushBusy.set(true);
    try {
      await this.pushService.disableNotifications();
      this.toastMessage.set('Notifications désactivées sur cet appareil.');
    } finally {
      this.pushBusy.set(false);
    }
  }

  async onSaveReminderTime(): Promise<void> {
    this.pushBusy.set(true);
    try {
      await this.pushService.saveReminderTime(this.reminderTimeInput);
      this.toastMessage.set(
        this.reminderTimeInput
          ? `Rappel enregistré pour ${this.reminderTimeInput}.`
          : 'Rappel quotidien désactivé.'
      );
    } catch (err: unknown) {
      this.toastMessage.set(
        err instanceof Error ? err.message : 'Impossible d’enregistrer le rappel.'
      );
    } finally {
      this.pushBusy.set(false);
    }
  }

  async onLogout(): Promise<void> {
    await this.pushService.disableNotifications().catch(() => {});
    await this.authService.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
