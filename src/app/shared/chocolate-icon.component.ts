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
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      style="display: inline-block; vertical-align: middle; flex-shrink: 0"
    >
      @switch (kind()) {
        @case ('pere-noel') {
          <path d="M9 12c0-4 2.5-7 5-7s5 3 5 7z" fill="#DC2626" />
          <circle cx="14" cy="4.5" r="2" fill="#FFF8F0" />
          <rect x="7" y="10.5" width="14" height="3.2" rx="1.6" fill="#FFF8F0" />
          <rect x="7.5" y="13.5" width="13" height="10.5" rx="4" fill="#B91C1C" />
          <path d="M9.5 14c0 3 2 5 4.5 5s4.5-2 4.5-5z" fill="#FFF8F0" />
          <circle cx="12.2" cy="14" r="0.9" fill="#2C1810" />
          <circle cx="15.8" cy="14" r="0.9" fill="#2C1810" />
          <rect x="7.5" y="19.5" width="13" height="2" fill="#2C1810" />
        }
        @case ('twix') {
          <rect x="2" y="5" width="24" height="18" rx="4" fill="#D92B2B" />
          <rect x="5" y="8" width="18" height="4.5" rx="2" fill="#D4953B" />
          <rect x="5" y="15.5" width="18" height="4.5" rx="2" fill="#D4953B" />
          <path d="M7 9.2h14M7 16.7h14" stroke="#6E3B18" stroke-width="1.3" stroke-linecap="round" />
        }
        @case ('mars') {
          <rect x="2" y="6" width="24" height="16" rx="4" fill="#1C1917" />
          <rect x="4" y="11" width="20" height="6" rx="2" fill="#B8332A" />
          <path d="M6 14h16" stroke="#F59E0B" stroke-width="1.8" stroke-linecap="round" />
        }
        @case ('lion') {
          <rect x="2" y="6" width="24" height="16" rx="4" fill="#451A03" />
          <rect x="4" y="8.5" width="20" height="11" rx="2.5" fill="#F59E0B" />
          <rect x="6" y="10.5" width="16" height="7" rx="2" fill="#78350F" />
          <circle cx="9.5" cy="14" r="1.3" fill="#FDE68A" />
          <circle cx="14" cy="13" r="1.4" fill="#FDE68A" />
          <circle cx="18.5" cy="14.2" r="1.3" fill="#FDE68A" />
        }
        @case ('snickers') {
          <rect x="2" y="6" width="24" height="16" rx="4" fill="#4A2714" />
          <rect x="4" y="10" width="20" height="8" rx="2" fill="#1D4ED8" />
          <rect x="5.5" y="11.5" width="17" height="5" rx="1.5" fill="#FFFFFF" />
          <path d="M7 14h14" stroke="#B8332A" stroke-width="1.8" stroke-linecap="round" />
        }
        @case ('bounty') {
          <rect x="2" y="6" width="24" height="16" rx="4" fill="#0284C7" />
          <rect x="5" y="9" width="8" height="10" rx="4" fill="#FFFDF9" />
          <rect x="15" y="9" width="8" height="10" rx="4" fill="#FFFDF9" />
          <circle cx="9" cy="14" r="2" fill="#E0F2FE" />
          <circle cx="19" cy="14" r="2" fill="#E0F2FE" />
        }
        @case ('bueno') {
          <rect x="2" y="5" width="24" height="18" rx="4" fill="#FFF8F0" stroke="#D97706" stroke-width="1.2" />
          <rect x="5" y="8" width="18" height="4.8" rx="2" fill="#8B4513" />
          <rect x="5" y="15.2" width="18" height="4.8" rx="2" fill="#8B4513" />
          <circle cx="9" cy="10.4" r="1.4" fill="#FDE68A" />
          <circle cx="14" cy="10.4" r="1.4" fill="#FDE68A" />
          <circle cx="19" cy="10.4" r="1.4" fill="#FDE68A" />
        }
        @case ('kinder-bar') {
          <rect x="2" y="6" width="24" height="16" rx="3.5" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="1" />
          <rect x="2" y="14" width="24" height="8" rx="2.5" fill="#EA580C" />
          <rect x="5" y="8" width="5" height="4" rx="1" fill="#6B3A1E" />
          <rect x="11.5" y="8" width="5" height="4" rx="1" fill="#6B3A1E" />
          <rect x="18" y="8" width="5" height="4" rx="1" fill="#6B3A1E" />
        }
        @case ('schokobon') {
          <ellipse cx="14" cy="14" rx="8.5" ry="10.5" fill="#FFF8F0" stroke="#C2410C" stroke-width="1.4" />
          <ellipse cx="14" cy="14" rx="5.5" ry="7" fill="#78350F" />
          <circle cx="12.5" cy="12" r="1.4" fill="#FDE68A" />
        }
        @case ('surprise') {
          <path d="M14 3c4.8 0 8.5 5 8.5 11H5.5C5.5 8 9.2 3 14 3z" fill="#FFFDF9" stroke="#D1D5DB" stroke-width="1" />
          <path d="M5.5 14h17c0 6-3.7 11-8.5 11s-8.5-5-8.5-11z" fill="#DC2626" />
          <path d="M6 14h16" stroke="#EA580C" stroke-width="2" />
        }
        @case ('kitkat') {
          <rect x="2" y="6" width="24" height="16" rx="3" fill="#DC2626" />
          <rect x="5" y="9" width="8" height="10" rx="1.5" fill="#7F1D1D" />
          <rect x="15" y="9" width="8" height="10" rx="1.5" fill="#7F1D1D" />
        }
        @case ('toblerone') {
          <rect x="2" y="6" width="24" height="16" rx="3" fill="#FACC15" />
          <polygon points="5,19 9,9 13,19" fill="#78350F" />
          <polygon points="10,19 14,8 18,19" fill="#92400E" />
          <polygon points="15,19 19,9 23,19" fill="#78350F" />
        }
        @case ('mms') {
          <circle cx="14" cy="14" r="10.5" fill="#FACC15" stroke="#CA8A04" stroke-width="1.2" />
          <circle cx="14" cy="14" r="6" fill="#78350F" />
          <path d="M11 15.5l1.5-3 1.5 2 1.5-2 1.5 3" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        }
        @default {
          <rect x="4" y="4" width="20" height="20" rx="3.5" fill="#5C3317" />
          <rect x="6.5" y="6.5" width="6.5" height="6.5" rx="1.2" fill="#7B4622" />
          <rect x="15" y="6.5" width="6.5" height="6.5" rx="1.2" fill="#7B4622" />
          <rect x="6.5" y="15" width="6.5" height="6.5" rx="1.2" fill="#7B4622" />
          <rect x="15" y="15" width="6.5" height="6.5" rx="1.2" fill="#7B4622" />
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
