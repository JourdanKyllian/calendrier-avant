import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { createOutline, keyOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth.service';
import { CalendarConfigService } from '../../core/calendar-config.service';
import { CalendarService } from '../../core/calendar.service';
import { ADVENT_DAY_NUMBERS, getDayStatusForMember } from '../../core/equity';
import { DayVisualStatus } from '../../core/models';
import { SantaHatLogoComponent } from '../../shared/santa-hat-logo.component';
import { ChocolateIconComponent } from '../../shared/chocolate-icon.component';
import { SupervisorDaysModalComponent } from './supervisor-days-modal.component';

export type DayMotif =
  | 'tree'
  | 'star'
  | 'snowflake'
  | 'snowball'
  | 'snowman'
  | 'santa'
  | 'reindeer'
  | 'sleigh'
  | 'sack'
  | 'gift'
  | 'yulelog';

const DAY_MOTIFS: DayMotif[] = [
  'tree',
  'star',
  'snowflake',
  'snowball',
  'snowman',
  'santa',
  'reindeer',
  'sleigh',
  'sack',
  'gift',
  'yulelog',
];

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    RouterLink,
    SantaHatLogoComponent,
    ChocolateIconComponent,
    SupervisorDaysModalComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardContent,
    IonButton,
    IonIcon,
    IonModal,
    IonToast,
  ],
  templateUrl: './calendar.page.html',
  styleUrl: './calendar.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage {
  protected readonly authService = inject(AuthService);
  protected readonly calendarService = inject(CalendarService);
  protected readonly configService = inject(CalendarConfigService);

  readonly dayNumbers = ADVENT_DAY_NUMBERS;
  readonly toastMessage = signal('');
  readonly adminModalOpen = signal(false);

  readonly currentMemberStats = computed(() => {
    const me = this.authService.currentMember();
    if (!me || me.isSupervisor) return null;
    return this.calendarService.memberStats().find((s) => s.member.uid === me.uid) ?? null;
  });

  constructor() {
    addIcons({ keyOutline, createOutline });
  }

  dayClaimsCount(dayNumber: number): number {
    const participantUids = new Set(this.calendarService.participants().map((p) => p.uid));
    return this.calendarService
      .claims()
      .filter((c) => c.dayNumber === dayNumber && participantUids.has(c.memberUid)).length;
  }

  dayStatus(dayNumber: number): DayVisualStatus {
    const me = this.authService.currentMember();
    const unlocked = this.calendarService.unlockedDaysCount();

    if (me?.isSupervisor) {
      if (dayNumber > unlocked) return 'upcoming';
      const totalParticipants = this.calendarService.participants().length;
      if (totalParticipants > 0 && this.dayClaimsCount(dayNumber) >= totalParticipants) {
        return 'taken';
      }
      return 'available';
    }

    const takenDays = this.currentMemberStats()?.takenDayNumbers ?? [];
    return getDayStatusForMember(dayNumber, unlocked, takenDays);
  }

  getDayMotif(dayNumber: number): DayMotif {
    return DAY_MOTIFS[(dayNumber - 1) % DAY_MOTIFS.length];
  }

  async quickClaim(dayNumber: number): Promise<void> {
    try {
      await this.calendarService.claimDay(dayNumber);
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Erreur lors du claim.');
    }
  }
}
