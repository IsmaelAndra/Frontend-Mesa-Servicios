import { Component, OnInit, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { AdminService } from '../../../../core/services/admin.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  roles: string[];
  children?: NavItem[];
  expanded?: boolean;
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent implements OnInit {
  role = '';
  isOpen = true;
  isMobile = false;
  collapsed = false;
  currentRoute = '';
  logoUrl = '';

  navItems: NavItem[] = [
    {
      label: 'Dashboard',
      route: '/dashboard',
      icon: 'pi pi-home',
      roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT', 'USER']
    },
    {
      label: 'Tickets',
      route: '/tickets',
      icon: 'pi pi-ticket',
      roles: ['SUPER_ADMIN', 'ADMIN']
    },
    {
      label: 'Tablero de Tickets',
      route: '/tickets/kanban',
      icon: 'pi pi-th-large',
      roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT']
    },
    {
      label: 'Mis Tickets',
      route: '/tickets/mine',
      icon: 'pi pi-inbox',
      roles: ['USER']
    },
    {
      label: 'Asignados',
      route: '/tickets/assigned',
      icon: 'pi pi-user-check',
      roles: ['AGENT']
    },
    {
      label: 'Administración',
      route: '/admin',
      icon: 'pi pi-cog',
      roles: ['SUPER_ADMIN', 'ADMIN'],
      children: [
        { label: 'Panel', route: '/admin', icon: 'pi pi-chart-line', roles: ['SUPER_ADMIN', 'ADMIN'] },
        { label: 'Usuarios', route: '/admin/users', icon: 'pi pi-users', roles: ['SUPER_ADMIN', 'ADMIN'] },
        { label: 'Equipos', route: '/admin/teams', icon: 'pi pi-sitemap', roles: ['SUPER_ADMIN'] },
        { label: 'Áreas', route: '/admin/areas', icon: 'pi pi-building', roles: ['SUPER_ADMIN'] },
        { label: 'Categorías', route: '/admin/categories', icon: 'pi pi-tags', roles: ['SUPER_ADMIN'] },
        { label: 'SLA', route: '/admin/sla', icon: 'pi pi-clock', roles: ['SUPER_ADMIN'] },
        { label: 'Escalaciones', route: '/admin/escalations', icon: 'pi pi-arrow-up', roles: ['SUPER_ADMIN'] },
        { label: 'Tipos de Ticket', route: '/admin/ticket-types', icon: 'pi pi-tags', roles: ['SUPER_ADMIN', 'ADMIN'] },
        { label: 'Plantillas', route: '/admin/templates', icon: 'pi pi-file-edit', roles: ['SUPER_ADMIN'] },
        { label: 'Marca y Colores', route: '/admin/branding', icon: 'pi pi-palette', roles: ['SUPER_ADMIN'] },
        { label: 'Configuración SMTP', route: '/admin/smtp', icon: 'pi pi-server', roles: ['SUPER_ADMIN'] },
        { label: 'Inteligencia Artificial', route: '/admin/ai-config', icon: 'pi pi-bolt', roles: ['SUPER_ADMIN'] }
      ]
    },
    {
      label: 'Actividades',
      route: '/activities',
      icon: 'pi pi-th-large',
      roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT']
    },
    {
      label: 'Calendario',
      route: '/calendar',
      icon: 'pi pi-calendar',
      roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT']
    },
    {
      label: 'Reportes',
      route: '/reports',
      icon: 'pi pi-chart-bar',
      roles: ['SUPER_ADMIN', 'ADMIN']
    },
    {
      label: 'Configuración',
      route: '/settings',
      icon: 'pi pi-cog',
      roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT', 'USER'],
      children: [
        { label: 'Mi Perfil', route: '/settings/profile', icon: 'pi pi-user', roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT', 'USER'] },
        { label: 'Cambiar Contraseña', route: '/settings/password', icon: 'pi pi-lock', roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT', 'USER'] }
      ]
    }
  ];

  constructor(
    public authService: AuthService,
    private adminService: AdminService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.role = this.authService.getRole();
    this.loadLogo();
    this.checkScreenSize();
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.currentRoute = event.url;
        this.role = this.authService.getRole();
        if (this.isMobile) this.isOpen = false;
      }
    });
  }

  loadLogo(): void {
    this.adminService.getBranding().subscribe({
      next: (b) => this.logoUrl = b.logoUrl || '',
      error: () => this.logoUrl = ''
    });
  }

  @HostListener('window:resize')
  checkScreenSize(): void {
    this.isMobile = window.innerWidth < 768;
    if (!this.isMobile) this.isOpen = true;
  }

  toggleSidebar(): void {
    if (this.isMobile) {
      this.isOpen = !this.isOpen;
    } else {
      this.collapsed = !this.collapsed;
    }
  }

  toggleChild(item: NavItem): void {
    if (!this.isMobile && this.collapsed) {
      this.collapsed = false;
      item.expanded = !item.expanded;
      return;
    }
    item.expanded = !item.expanded;
  }

  isVisible(item: NavItem): boolean {
    return item.roles.includes(this.role);
  }

  hasVisibleChildren(item: NavItem): boolean {
    return item.children?.some(child => child.roles.includes(this.role)) ?? false;
  }

  isActive(route: string): boolean {
    return this.currentRoute === route || this.currentRoute.startsWith(route + '/');
  }

  isChildActive(item: NavItem): boolean {
    return item.children?.some(child => this.isActive(child.route)) ?? false;
  }

  get initials(): string {
    const email = this.authService.getEmail();
    return email ? email.charAt(0).toUpperCase() : 'U';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}