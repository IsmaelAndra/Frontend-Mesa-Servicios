import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, interval, takeUntil } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { AdminService } from '../../../../core/services/admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Notification } from '../../../../models/notification.model';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html'
})
export class NavbarComponent implements OnInit, OnDestroy {
  @Output() toggleSidebar = new EventEmitter<void>();

  logoUrl = '';
  role = '';
  email = '';
  isAdmin = false;

  // Notificaciones
  notifications: Notification[] = [];
  notificationsCount = 0;

  private destroy$ = new Subject<void>();

  constructor(
    public authService: AuthService,
    private router: Router,
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {
    this.role = this.authService.getRole();
    this.email = this.authService.getEmail();
    this.isAdmin = this.role?.toUpperCase() === 'ADMIN';
    this.loadLogo();
  }

  ngOnInit(): void {
    this.loadNotifications();

    // Refresca cada 60 segundos
    interval(60_000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadNotifications());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLogo(): void {
    this.adminService.getBranding().subscribe({
      next: (b) => (this.logoUrl = b.logoUrl || ''),
      error: () => (this.logoUrl = '')
    });
  }

  loadNotifications(): void {
    this.notificationService.myNotifications().subscribe({
      next: (list) => {
        console.log('Notificaciones:', list);
        if (list?.length) {
          console.log('Campos del primer item:', Object.keys(list[0]));
        }
        this.notifications = (list || []).slice(0, 5);
        this.notificationsCount = (list || []).filter((n: any) => !n.read).length;
      },
      error: () => {
        this.notifications = [];
        this.notificationsCount = 0;
      }
    });
  }

  get initials(): string {
    return this.email ? this.email.charAt(0).toUpperCase() : 'U';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}