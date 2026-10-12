import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class BrowserNotificationService {
  constructor(private router: Router) {}

  supported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  permissionGranted(): boolean {
    return this.supported() && Notification.permission === 'granted';
  }

  requestPermission(): Promise<boolean> {
    if (!this.supported()) return Promise.resolve(false);
    if (Notification.permission === 'granted') return Promise.resolve(true);
    if (Notification.permission === 'denied') return Promise.resolve(false);
    return Notification.requestPermission().then((permission) => permission === 'granted');
  }

  show(title: string, body: string, ticketId?: string | null): void {
    if (!this.permissionGranted()) return;
    try {
      const notification = new Notification(title, { body });
      notification.onclick = () => {
        window.focus();
        if (ticketId) {
          this.router.navigate(['/tickets', ticketId]);
        }
        notification.close();
      };
    } catch {
      // el navegador puede bloquear la creación: se ignora
    }
  }
}