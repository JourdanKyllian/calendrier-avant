import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline, trashOutline } from 'ionicons/icons';
import { CalendarConfigService } from '../../core/calendar-config.service';
import { ADVENT_DAY_NUMBERS } from '../../core/equity';
import { ChocolateIconComponent } from '../../shared/chocolate-icon.component';

type DayFilter = 'all' | 'missing' | 'filled';

@Component({
  selector: 'app-supervisor-days-modal',
  standalone: true,
  imports: [
    FormsModule,
    ChocolateIconComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonIcon,
    IonInput,
    IonToast,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ion-page',
  },
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Cases du calendrier ({{ configService.configuredCount() }}/24)</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="closed.emit()" aria-label="Fermer">
            <ion-icon name="close-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding admin-content">
        <div class="filter-bar">
          <button
            type="button"
            class="filter-pill"
            [class.active]="filter() === 'all'"
            (click)="filter.set('all')"
          >
            Toutes (24)
          </button>
          <button
            type="button"
            class="filter-pill"
            [class.active]="filter() === 'missing'"
            (click)="filter.set('missing')"
          >
            <i class="mini-dot red"></i>
            À remplir ({{ 24 - configService.configuredCount() }})
          </button>
          <button
            type="button"
            class="filter-pill"
            [class.active]="filter() === 'filled'"
            (click)="filter.set('filled')"
          >
            <i class="mini-dot green"></i>
            Remplies ({{ configService.configuredCount() }})
          </button>
        </div>

        <div class="days-selector-grid">
          @for (dayNum of filteredDays(); track dayNum) {
            @let isFilled = !!configService.getDayConfig(dayNum);
            <button
              type="button"
              class="day-pill"
              [class.selected]="selectedDay() === dayNum"
              [class.is-filled]="isFilled"
              [class.is-missing]="!isFilled"
              (click)="selectDay(dayNum)"
            >
              <span class="day-pill-dot" [class.green]="isFilled" [class.red]="!isFilled"></span>
              <span class="day-pill-label">J{{ dayNum }}</span>
              <span class="day-pill-line" [class.green]="isFilled" [class.red]="!isFilled"></span>
            </button>
          }
        </div>

        <div class="editor-card">
          <div class="editor-head">
            <div>
              <h3>Jour {{ selectedDay() }} décembre</h3>
              @if (selectedConfig(); as current) {
                <p class="current-summary filled">
                  Configuré : <strong>{{ current.quantityPerPerson }}× {{ current.chocolateName }}</strong> / pers.
                </p>
              } @else {
                <p class="current-summary missing">Non encore renseigné</p>
              }
            </div>

            @if (selectedConfig()) {
              <ion-button
                size="small"
                fill="clear"
                color="danger"
                [disabled]="busy()"
                (click)="clearCurrent()"
                aria-label="Vider ce jour"
              >
                <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
              </ion-button>
            }
          </div>

          <p class="field-label">Chocolat (1 clic) :</p>
          <div class="choco-grid">
            @for (item of configService.catalogItems(); track item.id) {
              @let used = configService.usedCountForChocolate(item);
              <button
                type="button"
                class="choco-btn"
                [class.selected]="chocolateChoice() === item.name"
                (click)="pickChocolate(item.name)"
              >
                <span class="choco-btn-inner">
                  <app-chocolate-icon [name]="item.name" [size]="18" />
                  <span>{{ item.name }}</span>
                </span>
                @if (used > 0) {
                  <small class="stock-tag">{{ used }} placés</small>
                }
              </button>
            }
            <button
              type="button"
              class="choco-btn"
              [class.selected]="chocolateChoice() === '__custom__'"
              (click)="pickChocolate('__custom__')"
            >
              <span>✏️ Autre...</span>
            </button>
          </div>

          @if (chocolateChoice() === '__custom__') {
            <ion-input
              class="custom-input"
              fill="outline"
              placeholder="Nom du chocolat"
              [(ngModel)]="customChocolate"
            ></ion-input>
          }

          <p class="field-label">Nombre par personne :</p>
          <div class="qty-row">
            @for (n of [1, 2, 3, 4]; track n) {
              <button
                type="button"
                class="qty-pill"
                [class.selected]="quantity() === n"
                (click)="quantity.set(n)"
              >
                {{ n }}
              </button>
            }
            <div class="qty-stepper">
              <button type="button" (click)="adjustQty(-1)" aria-label="Diminuer">−</button>
              <span>{{ quantity() }}</span>
              <button type="button" (click)="adjustQty(1)" aria-label="Augmenter">+</button>
            </div>
          </div>

          <ion-button expand="block" [disabled]="busy()" (click)="saveCurrent()" class="save-btn">
            Enregistrer Jour {{ selectedDay() }}
          </ion-button>
        </div>

      <ion-toast
        [isOpen]="toastMessage() !== ''"
        [message]="toastMessage()"
        [duration]="2200"
        position="top"
        (didDismiss)="toastMessage.set('')"
      ></ion-toast>
    </ion-content>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background: #faf5ee;
    }

    .admin-content {
      flex: 1;
      --background: #faf5ee;
    }

    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }

    .filter-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 11px;
      border-radius: 999px;
      border: 1px solid rgba(44, 24, 16, 0.16);
      background: #ffffff;
      color: #2c1810;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
    }

    .filter-pill.active {
      background: #2c1810;
      border-color: #2c1810;
      color: #fff8f0;
    }

    .mini-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      display: inline-block;
    }

    .mini-dot.green {
      background: #1f7a4c;
    }

    .mini-dot.red {
      background: #b8332a;
    }

    .days-selector-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 7px;
      margin-bottom: 14px;
    }

    .day-pill {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      height: 44px;
      border-radius: 10px;
      border: 1px solid rgba(44, 24, 16, 0.14);
      background: #ffffff;
      color: #2c1810;
      font-weight: 800;
      font-size: 0.85rem;
      cursor: pointer;
      padding: 4px 2px 3px;
    }

    .day-pill.selected {
      border: 2px solid #8b2635;
      box-shadow: 0 3px 10px rgba(139, 38, 53, 0.18);
    }

    .day-pill-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
    }

    .day-pill-dot.green,
    .day-pill-line.green {
      background: #1f7a4c;
    }

    .day-pill-dot.red,
    .day-pill-line.red {
      background: #b8332a;
    }

    .day-pill-line {
      width: 62%;
      height: 3px;
      border-radius: 999px;
    }

    .editor-card {
      background: #ffffff;
      border-radius: 16px;
      padding: 14px;
      border: 1px solid rgba(44, 24, 16, 0.08);
      box-shadow: 0 6px 18px rgba(44, 24, 16, 0.06);
    }

    .editor-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }

    .editor-head h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 800;
      color: #2c1810;
    }

    .current-summary {
      margin: 3px 0 0;
      font-size: 0.82rem;
    }

    .current-summary.filled {
      color: #1f7a4c;
    }

    .current-summary.missing {
      color: #b8332a;
      font-weight: 600;
    }

    .field-label {
      margin: 10px 0 6px;
      font-size: 0.82rem;
      font-weight: 700;
      color: #5b463c;
    }

    .choco-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .choco-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 11px;
      border-radius: 999px;
      border: 1px solid rgba(44, 24, 16, 0.18);
      background: #faf5ee;
      color: #2c1810;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }

    .choco-btn-inner {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .choco-btn.selected {
      background: #8b2635;
      border-color: #8b2635;
      color: #ffffff;
    }

    .stock-tag {
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(44, 24, 16, 0.1);
    }

    .choco-btn.selected .stock-tag {
      background: rgba(255, 255, 255, 0.22);
    }

    .stock-tag.low {
      background: rgba(184, 51, 42, 0.18);
      color: #96251d;
    }

    .custom-input {
      margin-top: 8px;
    }

    .qty-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }

    .qty-pill {
      width: 40px;
      height: 38px;
      border-radius: 10px;
      border: 1px solid rgba(44, 24, 16, 0.18);
      background: #faf5ee;
      color: #2c1810;
      font-weight: 800;
      cursor: pointer;
    }

    .qty-pill.selected {
      background: #8b2635;
      border-color: #8b2635;
      color: #ffffff;
    }

    .qty-stepper {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #faf5ee;
      border: 1px solid rgba(44, 24, 16, 0.16);
      border-radius: 10px;
      padding: 4px 10px;
      font-weight: 800;
    }

    .qty-stepper button {
      border: none;
      background: transparent;
      font-size: 1.15rem;
      font-weight: 800;
      color: #8b2635;
      cursor: pointer;
      padding: 2px 6px;
    }

    .save-btn {
      height: 44px;
    }

    .admin-tabs-bar {
      background: #2c1810;
      padding: 0 12px 10px;
    }

    .admin-tabs-bar ion-segment {
      --background: rgba(255, 248, 240, 0.14);
    }

    .admin-tabs-bar ion-segment-button {
      --color: rgba(255, 248, 240, 0.85);
      --color-checked: #2c1810;
      --indicator-color: #fff8f0;
      font-weight: 700;
    }

    .stock-list-card {
      background: #ffffff;
      border-radius: 16px;
      padding: 14px;
      border: 1px solid rgba(44, 24, 16, 0.08);
      box-shadow: 0 6px 18px rgba(44, 24, 16, 0.06);
      margin-bottom: 14px;
    }

    .stock-list-card h3,
    .add-choco-card h3 {
      margin: 0 0 6px;
      font-size: 1rem;
      font-weight: 800;
      color: #2c1810;
    }

    .stock-hint {
      margin: 0 0 12px;
      font-size: 0.8rem;
      color: #6f5b52;
      line-height: 1.4;
    }

    .stock-rows {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .stock-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 12px;
      background: #faf5ee;
      border: 1px solid rgba(44, 24, 16, 0.08);
    }

    .stock-row-info {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .stock-row-info strong {
      display: block;
      font-size: 0.88rem;
      color: #2c1810;
    }

    .stock-meta {
      display: block;
      font-size: 0.74rem;
      color: #6f5b52;
    }

    .stock-edit-controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .mini-step {
      width: 30px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid rgba(44, 24, 16, 0.2);
      background: #ffffff;
      color: #8b2635;
      font-size: 1rem;
      font-weight: 800;
      cursor: pointer;
    }

    .stock-num-input {
      width: 58px;
      height: 32px;
      text-align: center;
      border-radius: 8px;
      border: 1px solid rgba(44, 24, 16, 0.2);
      background: #ffffff;
      color: #2c1810;
      font-size: 16px;
      font-weight: 700;
    }

    .add-choco-form {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .add-choco-form ion-input {
      flex: 1;
      min-width: 150px;
    }

    .add-qty {
      height: 44px;
    }

    .stock-empty {
      margin: 0;
      font-size: 0.84rem;
      color: #6f5b52;
    }
  `,
})
export class SupervisorDaysModalComponent {
  protected readonly configService = inject(CalendarConfigService);
  readonly closed = output<void>();

  readonly filter = signal<DayFilter>('all');
  readonly selectedDay = signal<number>(1);
  readonly chocolateChoice = signal<string>('');
  readonly quantity = signal<number>(1);
  readonly busy = signal(false);
  readonly toastMessage = signal('');
  customChocolate = '';

  readonly filteredDays = computed(() => {
    const f = this.filter();
    return ADVENT_DAY_NUMBERS.filter((dayNum) => {
      const filled = Boolean(this.configService.getDayConfig(dayNum));
      if (f === 'missing') return !filled;
      if (f === 'filled') return filled;
      return true;
    });
  });

  readonly selectedConfig = computed(() => this.configService.getDayConfig(this.selectedDay()));

  constructor() {
    addIcons({ closeOutline, trashOutline });
    this.selectDay(1);
  }

  selectDay(dayNum: number): void {
    this.selectedDay.set(dayNum);
    const existing = this.configService.getDayConfig(dayNum);
    if (existing) {
      const inCatalog = this.configService
        .catalogItems()
        .some((item) => item.name === existing.chocolateName);
      if (inCatalog) {
        this.chocolateChoice.set(existing.chocolateName);
        this.customChocolate = '';
      } else {
        this.chocolateChoice.set('__custom__');
        this.customChocolate = existing.chocolateName;
      }
      this.quantity.set(existing.quantityPerPerson);
    } else {
      const first = this.configService.catalogItems()[0]?.name ?? '';
      this.chocolateChoice.set(first);
      this.customChocolate = '';
      this.quantity.set(1);
    }
  }

  pickChocolate(name: string): void {
    this.chocolateChoice.set(name);
  }

  adjustQty(delta: number): void {
    this.quantity.update((q) => Math.min(20, Math.max(1, q + delta)));
  }

  async saveCurrent(): Promise<void> {
    const choco =
      this.chocolateChoice() === '__custom__'
        ? this.customChocolate.trim()
        : this.chocolateChoice();

    this.busy.set(true);
    try {
      const day = this.selectedDay();
      await this.configService.saveDayConfig(day, choco, this.quantity());
      this.toastMessage.set(`Jour ${day} enregistré.`);

      const nextMissing = ADVENT_DAY_NUMBERS.find(
        (d) => d > day && !this.configService.getDayConfig(d)
      );
      if (nextMissing) {
        this.selectDay(nextMissing);
      }
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      this.busy.set(false);
    }
  }

  async clearCurrent(): Promise<void> {
    this.busy.set(true);
    try {
      const day = this.selectedDay();
      await this.configService.clearDayConfig(day);
      this.toastMessage.set(`Jour ${day} vidé.`);
      this.selectDay(day);
    } catch (err: unknown) {
      this.toastMessage.set(err instanceof Error ? err.message : 'Erreur lors de la suppression.');
    } finally {
      this.busy.set(false);
    }
  }
}
