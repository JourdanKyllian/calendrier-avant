import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly swUpdate = inject(SwUpdate, { optional: true });

  ngOnInit(): void {
    if (this.swUpdate?.isEnabled) {
      const sub = this.swUpdate.versionUpdates
        .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
        .subscribe(() => {
          void this.swUpdate?.activateUpdate().then(() => window.location.reload());
        });
      void this.swUpdate.checkForUpdate().catch(() => {});
      this.destroyRef.onDestroy(() => sub.unsubscribe());
    }

    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const preventMultiTouch = (event: TouchEvent): void => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    };
    const preventGesture = (event: Event): void => {
      event.preventDefault();
    };

    document.addEventListener('touchstart', preventMultiTouch, { passive: false });
    document.addEventListener('touchmove', preventMultiTouch, { passive: false });
    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });

    const orientation = window.screen?.orientation as
      | { lock?: (mode: string) => Promise<void> }
      | undefined;
    orientation?.lock?.('portrait')?.catch(() => {});

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('touchstart', preventMultiTouch);
      document.removeEventListener('touchmove', preventMultiTouch);
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
    });
  }
}
