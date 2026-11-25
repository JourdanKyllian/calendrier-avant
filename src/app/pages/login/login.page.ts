import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonSpinner,
  IonText,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { eyeOffOutline, eyeOutline, lockClosedOutline, personOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth.service';
import { SantaHatLogoComponent } from '../../shared/santa-hat-logo.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    SantaHatLogoComponent,
    IonContent,
    IonCard,
    IonCardContent,
    IonItem,
    IonInput,
    IonButton,
    IonIcon,
    IonText,
    IonSpinner,
  ],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage implements OnInit {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  name = '';
  pin = '';
  readonly showPin = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal('');

  constructor() {
    addIcons({ personOutline, lockClosedOutline, eyeOutline, eyeOffOutline });
  }

  ngOnInit(): void {
    this.authService.warmupMembersCache();
  }

  togglePinVisibility(): void {
    this.showPin.update((v) => !v);
  }

  async onSubmit(): Promise<void> {
    this.errorMessage.set('');
    this.loading.set(true);
    try {
      await this.authService.login(this.name, this.pin);
      await this.router.navigateByUrl('/tabs/calendar', { replaceUrl: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la connexion.';
      this.errorMessage.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
