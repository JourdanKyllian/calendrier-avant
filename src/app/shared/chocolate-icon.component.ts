import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type ChocoKind =
  | 'pere-noel'
  | 'twix'
  | 'mars'
  | 'lion'
  | 'snickers'
  | 'bounty'
  | 'bueno'
  | 'kinder-bar'
  | 'schokobon'
  | 'surprise'
  | 'kitkat'
  | 'toblerone'
  | 'mms'
  | 'default';

export function resolveChocolateKind(name: string): ChocoKind {
  const n = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (n.includes('noel') || n.includes('santa') || n.includes('pere')) return 'pere-noel';
  if (n.includes('twix') || n.includes('twiks')) return 'twix';
  if (n.includes('mars')) return 'mars';
  if (n.includes('lion')) return 'lion';
  if (n.includes('snickers')) return 'snickers';
  if (n.includes('bounty')) return 'bounty';
  if (n.includes('bueno')) return 'bueno';
  if (n.includes('schoko') || n.includes('choco-bon') || n.includes('chokobon')) return 'schokobon';
  if (n.includes('surprise')) return 'surprise';
  if (n.includes('kit') && n.includes('kat')) return 'kitkat';
  if (n.includes('kitkat')) return 'kitkat';
  if (n.includes('toblerone')) return 'toblerone';
  if (n.includes('m&m') || n.includes('mms')) return 'mms';
  if (n.includes('kinder') || n.includes('maxi') || n.includes('country')) return 'kinder-bar';
  return 'default';
}

@Component({
  selector: 'app-chocolate-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style="display: inline-block; vertical-align: middle; flex-shrink: 0"
    >
      @switch (kind()) {
        @case ('pere-noel') {
          <!-- Figurine Père Noël en chocolat moulé -->
          <path d="M11 11.5C11 6.8 14 4 17.5 4.5C20 4.8 21.5 7.5 21 11.5Z" fill="#DC2626" />
          <circle cx="22.5" cy="6.5" r="2.1" fill="#FFFDF8" />
          <rect x="9.5" y="10.2" width="13" height="3.2" rx="1.6" fill="#FFFDF8" />
          <path d="M9.5 14C9.5 11.5 22.5 11.5 22.5 14L24 25.5C24 27.5 21 28.5 16 28.5C11 28.5 8 27.5 8 25.5Z" fill="#B91C1C" />
          <path d="M11.5 13.5C11.5 17 13.5 19.5 16 19.5C18.5 19.5 20.5 17 20.5 13.5Z" fill="#FFFDF8" />
          <circle cx="14" cy="14.2" r="0.9" fill="#2C1810" />
          <circle cx="18" cy="14.2" r="0.9" fill="#2C1810" />
          <rect x="8.8" y="21.5" width="14.4" height="2.6" rx="1" fill="#2C1810" />
          <rect x="14.2" y="21" width="3.6" height="3.6" rx="0.8" fill="#FBBF24" />
        }
        @case ('bueno') {
          <!-- Kinder Bueno : 4 dômes gaufrés chocolat + zigzag chocolat noir -->
          <rect x="2.5" y="10" width="27" height="12" rx="3" fill="#E6C9A2" />
          <rect x="2.5" y="9" width="6.5" height="11" rx="3.2" fill="#7A4222" />
          <rect x="9.3" y="9" width="6.5" height="11" rx="3.2" fill="#7A4222" />
          <rect x="16.2" y="9" width="6.5" height="11" rx="3.2" fill="#7A4222" />
          <rect x="23" y="9" width="6.5" height="11" rx="3.2" fill="#7A4222" />
          <path d="M3.5 13.5C6 11 8 16 10.5 13.5C13 11 15 16 17.5 13.5C20 11 22 16 24.5 13.5C26.5 11.5 27.5 14.5 28.5 13.5" stroke="#3B1D0E" stroke-width="1.7" stroke-linecap="round" />
          <rect x="2.5" y="19.5" width="27" height="3" rx="1.5" fill="#5B2E16" />
        }
        @case ('schokobon') {
          <!-- Schoko-Bon : papillote blanche/rouge torsadée aux extrémités -->
          <path d="M2 12.5L7.5 15L2 19.5L4.5 16Z" fill="#FFFDF8" stroke="#D97706" stroke-width="1" />
          <path d="M30 12.5L24.5 15L30 19.5L27.5 16Z" fill="#FFFDF8" stroke="#D97706" stroke-width="1" />
          <ellipse cx="16" cy="16" rx="9.5" ry="7.2" fill="#FFF8F0" stroke="#EA580C" stroke-width="1.3" />
          <ellipse cx="16" cy="16" rx="6.2" ry="4.6" fill="#6B3A1E" />
          <ellipse cx="14.2" cy="14.4" rx="2.1" ry="1.1" fill="#FFF8F0" fill-opacity="0.45" />
        }
        @case ('kinder-bar') {
          <!-- Kinder Maxi : barre 5 carrés avec cœur au lait blanc + bandeau orange-rouge -->
          <rect x="2.5" y="8" width="27" height="16" rx="3.5" fill="#FFFDF9" stroke="#D6D3D1" stroke-width="1" />
          <path d="M2.5 17.5H29.5V20.5C29.5 22.4 27.9 24 26 24H6C4.1 24 2.5 22.4 2.5 20.5V17.5Z" fill="#EA580C" />
          <rect x="4.5" y="10" width="4" height="5.5" rx="1" fill="#6B3A1E" />
          <rect x="9.3" y="10" width="4" height="5.5" rx="1" fill="#6B3A1E" />
          <rect x="14" y="10" width="4" height="5.5" rx="1" fill="#6B3A1E" />
          <rect x="18.7" y="10" width="4" height="5.5" rx="1" fill="#6B3A1E" />
          <rect x="23.5" y="10" width="4" height="5.5" rx="1" fill="#6B3A1E" />
          <rect x="5.3" y="12.2" width="21.4" height="1.5" rx="0.7" fill="#FFFBEB" fill-opacity="0.85" />
        }
        @case ('mars') {
          <!-- Mars : barre noire + cœur caramel doré & nougat coupé -->
          <rect x="2" y="8.5" width="28" height="15" rx="4" fill="#1C1917" />
          <rect x="4" y="10.5" width="14" height="11" rx="2.5" fill="#B91C1C" />
          <path d="M6.5 17.5L8.2 13L10.5 16L12.8 13L14.5 17.5" stroke="#FBBF24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          <rect x="19" y="10.5" width="9" height="11" rx="2" fill="#5B2E16" />
          <rect x="20" y="12" width="7" height="3" rx="1" fill="#F59E0B" />
          <rect x="20" y="15.5" width="7" height="4" rx="1" fill="#D6B48C" />
        }
        @case ('lion') {
          <!-- Lion : barre croustillante bosselée + caramel ambré -->
          <rect x="2.5" y="9" width="27" height="14" rx="3.5" fill="#78350F" />
          <path d="M4.5 12C6 9.5 8.5 10 10 12C11.5 9.5 14.5 9.5 16 12C17.5 9.5 20.5 9.5 22 12C23.5 9.5 26 10 27.5 12V19.5C27.5 20.6 26.6 21.5 25.5 21.5H6.5C5.4 21.5 4.5 20.6 4.5 19.5V12Z" fill="#B45309" />
          <rect x="5" y="16" width="22" height="3" rx="1.2" fill="#FBBF24" />
          <circle cx="8" cy="13" r="1.4" fill="#FDE68A" />
          <circle cx="13" cy="12.5" r="1.5" fill="#FDE68A" />
          <circle cx="18.5" cy="13.2" r="1.4" fill="#FDE68A" />
          <circle cx="24" cy="12.6" r="1.3" fill="#FDE68A" />
        }
        @case ('kitkat') {
          <!-- KitKat : emballage rouge vif + 2 doigts gaufrette qui dépassent -->
          <rect x="2" y="7.5" width="16" height="17" rx="2.5" fill="#DC2626" />
          <rect x="16" y="9" width="14" height="6" rx="2" fill="#6B3A1E" />
          <rect x="16" y="17" width="14" height="6" rx="2" fill="#6B3A1E" />
          <rect x="25.5" y="10.2" width="3.5" height="3.6" rx="0.8" fill="#E6C9A2" />
          <rect x="25.5" y="18.2" width="3.5" height="3.6" rx="0.8" fill="#E6C9A2" />
          <ellipse cx="10" cy="16" rx="5.5" ry="3.8" fill="#FFFDF9" />
          <path d="M7 16H13" stroke="#DC2626" stroke-width="1.8" stroke-linecap="round" />
        }
        @case ('twix') {
          <!-- Twix / Twiks : 2 doigts jumeaux dorés caramel + biscuit -->
          <rect x="3" y="6.5" width="26" height="8" rx="3.5" fill="#7A4222" />
          <rect x="5" y="8" width="22" height="2.2" rx="1" fill="#F59E0B" />
          <rect x="5" y="11" width="22" height="2" rx="1" fill="#E6C9A2" />
          <rect x="3" y="17.5" width="26" height="8" rx="3.5" fill="#7A4222" />
          <rect x="5" y="19" width="22" height="2.2" rx="1" fill="#F59E0B" />
          <rect x="5" y="22" width="22" height="2" rx="1" fill="#E6C9A2" />
          <rect x="2" y="13.5" width="9" height="5" rx="1.5" fill="#DC2626" />
        }
        @case ('snickers') {
          <rect x="3" y="8.5" width="26" height="15" rx="3.5" fill="#4A2714" />
          <rect x="5" y="12" width="22" height="8" rx="2" fill="#1D4ED8" />
          <rect x="6.5" y="13.5" width="19" height="5" rx="1.2" fill="#FFFFFF" />
          <path d="M8.5 16H23.5" stroke="#B8332A" stroke-width="1.8" stroke-linecap="round" />
        }
        @case ('bounty') {
          <rect x="3" y="8.5" width="26" height="15" rx="4" fill="#0284C7" />
          <rect x="6" y="11" width="9" height="10" rx="4.5" fill="#FFFDF9" />
          <rect x="17" y="11" width="9" height="10" rx="4.5" fill="#FFFDF9" />
        }
        @case ('surprise') {
          <path d="M16 4C21.2 4 25.5 9.5 25.5 16H6.5C6.5 9.5 10.8 4 16 4Z" fill="#FFFDF9" stroke="#D1D5DB" stroke-width="1" />
          <path d="M6.5 16H25.5C25.5 22.5 21.2 28 16 28C10.8 28 6.5 22.5 6.5 16Z" fill="#DC2626" />
          <path d="M7 16H25" stroke="#EA580C" stroke-width="2" />
        }
        @case ('toblerone') {
          <rect x="3" y="8" width="26" height="16" rx="3" fill="#FACC15" />
          <polygon points="6,22 10.5,10 15,22" fill="#78350F" />
          <polygon points="11.5,22 16,9 20.5,22" fill="#92400E" />
          <polygon points="17,22 21.5,10 26,22" fill="#78350F" />
        }
        @case ('mms') {
          <circle cx="16" cy="16" r="11.5" fill="#FACC15" stroke="#CA8A04" stroke-width="1.2" />
          <circle cx="16" cy="16" r="6.8" fill="#78350F" />
          <path d="M12.5 17.8L14.2 14.2L16 16.5L17.8 14.2L19.5 17.8" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        }
        @default {
          <rect x="5" y="5" width="22" height="22" rx="4" fill="#5C3317" />
          <rect x="7.8" y="7.8" width="7.2" height="7.2" rx="1.4" fill="#7B4622" />
          <rect x="17" y="7.8" width="7.2" height="7.2" rx="1.4" fill="#7B4622" />
          <rect x="7.8" y="17" width="7.2" height="7.2" rx="1.4" fill="#7B4622" />
          <rect x="17" y="17" width="7.2" height="7.2" rx="1.4" fill="#7B4622" />
        }
      }
    </svg>
  `,
})
export class ChocolateIconComponent {
  readonly name = input.required<string>();
  readonly size = input<number>(22);
  readonly kind = computed(() => resolveChocolateKind(this.name()));
}
