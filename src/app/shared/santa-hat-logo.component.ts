import { Component, input } from '@angular/core';

/**
 * Reusable Santa hat SVG logo matching ChocoAvent's palette.
 */
@Component({
  selector: 'app-santa-hat-logo',
  standalone: true,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      style="display: block"
    >
      <path
        d="M14 42C15 26 25 13 39 13C46 13 52 17 54 24C48 20.5 44 21.5 40.5 25C43 29.5 45 35.5 46 42H14Z"
        fill="#B8332A"
      />
      <path
        d="M20.5 38C21.5 27.5 28.5 18.5 38 17.5C32.5 21 27.5 28 26.5 38H20.5Z"
        fill="#D94A3F"
        opacity="0.75"
      />
      <circle cx="54" cy="25" r="6.2" fill="#FFF8F0" />
      <rect x="10" y="40" width="41" height="11.5" rx="5.75" fill="#FFF8F0" />
      <rect x="12" y="46.5" width="37" height="4" rx="2" fill="#EADCCF" />
    </svg>
  `,
})
export class SantaHatLogoComponent {
  readonly size = input<number>(32);
}
