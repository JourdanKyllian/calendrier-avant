# ChocoAvent — Project Rules & UX Architecture

Permanent guidelines for the **ChocoAvent** Angular + Ionic PWA (`calendrier-avent`).

<product_and_roles>
- **Domain**: Family Advent chocolate calendar PWA (`24` days) with real-time Firestore sync and Cloudflare Worker Web Push notifications.
- **Roles**:
  - **Members**: Authenticate with a 4-digit PIN, claim their assigned day's chocolate (with a timed undo window), view their personal stock & surplus (`Stock`), browse logs/trades (`Journal`), and manage PIN & push reminders (`Compte`).
  - **Supervisor** (`isSupervisor === true`): Read-only for claiming chocolates; manages global chocolate stock directly in the `Stock` tab (`Réserve globale`, `Placés` vs `Surplus`, add chocolates) and uses the prominent **Gérer** button on `Calendrier` to open `SupervisorDaysModalComponent` for assigning chocolates to the 24 days (with stock-overrun protection).
</product_and_roles>

<navigation_and_routes>
- **Login**: `/login` (`LoginPage`, guarded by `guestGuard`).
- **Authenticated Tabs** (`TabsPage` at `/tabs/*`, guarded by `authGuard`):
  - `Calendrier` (`/tabs/calendar`)
  - `Stock` (`/tabs/stats` — personal stock for members, global reserve management for supervisor)
  - `Journal` (`/tabs/history` — trades & family progress/history)
  - `Compte` (`/tabs/profile`)
- Keep each tab focused on its core job; do not duplicate supervisor management or account settings across unrelated tabs.
</navigation_and_routes>

<foldable_and_mobile_rules>
- **Primary target**: Foldable smartphone (narrow cover screen folded + wide two-column screen unfolded) installed as a PWA.
- **Folded / narrow phone (`< 600px`–`768px`)**: Show the fewest elements necessary per screen. Keep headers uncluttered; place primary/supervisor CTAs full-width below or in thumb reach rather than cramped inside `<ion-header>` toolbars.
- **Unfolded / tablet (`>= 700px`–`768px`)**: Use clean two-column layouts where natural (e.g., `Compte`: PIN + push reminders on the left, PIN change on the right; action rows aligned on one line).
- **Touch targets**: Minimum `44x44px` on all interactive buttons, calendar cells, and tab controls.
</foldable_and_mobile_rules>

<visual_tokens>
Defined in `src/theme/variables.scss`:
- **Primary (Burgundy)**: `#8b2635` (`--ion-color-primary`)
- **Secondary (Pine Green)**: `#1e6b52` (`--ion-color-secondary`)
- **Tertiary (Warm Gold)**: `#c68b2c` (`--ion-color-tertiary`)
- **Background (Warm Cream)**: `#faf5ee` (`--ion-background-color`)
- **Text / Toolbar (Dark Chocolate)**: `#2c1810` (`--ion-text-color`, `--ion-toolbar-background`)
- **Card Surface**: `#ffffff` (`--ion-card-background`)

Preserve this warm artisanal chocolate/Christmas palette. Do not introduce generic purple/cyan gradients or sterile gray surfaces.
</visual_tokens>

<technical_invariants>
- **Grounding (no training-data guessing)**: Never rely on training-data assumptions or memory for APIs, package versions, CSS behavior, or existing components. Always read the actual files (`package.json`, templates, styles, services) and verify visually/via tests after editing.
- **Ionic Modals**: Any Angular component rendered inside `<ion-modal>` (such as `SupervisorDaysModalComponent`) MUST declare `host: { class: 'ion-page' }` and `:host { display: flex; flex-direction: column; width: 100%; height: 100%; }` so `<ion-content>` never collapses to `0px`.
- **Distinct Chocolate SVGs**: Every chocolate variety in `src/app/shared/chocolate-icon.component.ts` must keep a recognizable, distinct SVG silhouette.
- **Verification**: After UI or logic edits, run `HOME=/tmp NG_CLI_ANALYTICS=false npm test -- --watch=false && HOME=/tmp NG_CLI_ANALYTICS=false npm run build` and verify zero test/build failures.
</technical_invariants>
