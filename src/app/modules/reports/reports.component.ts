import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { saveAs } from 'file-saver';
import { NotificationService } from '../../core/services/notification.service';
import { AdminService } from '../../core/services/admin.service';

interface ReportItem {
  name: string;
  label: string;
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html'
})
export class ReportsComponent implements OnInit {
  reports: ReportItem[] = [
    { name: 'tickets', label: 'Tickets por estado' },
    { name: 'tickets', label: 'Tickets por área' },
    { name: 'tickets', label: 'Cumplimiento de SLA' },
    { name: 'tickets', label: 'Rendimiento de agentes' },
    { name: 'tickets', label: 'Tickets por categoría' }
  ];

  format = 'PDF';
  period = 'MES';
  fromDate = new Date().toISOString().slice(0, 10);
  toDate = new Date().toISOString().slice(0, 10);
  typeId?: number;
  ticketTypes: { id: number; name: string }[] = [];

  // Estado de filtros
  search = '';
  sortBy: 'label' | 'label-desc' = 'label';

  // Estado de descarga por reporte (usa el label como clave única)
  downloading: Record<string, boolean> = {};

  // Estado de "cargando" del botón Actualizar
  loading = false;

  constructor(
    private notificationService: NotificationService,
    private adminService: AdminService
  ) {}

  ngOnInit(): void {
    this.applyPeriod();
    this.adminService.catalog().subscribe({
      next: (c) => (this.ticketTypes = c.ticketTypes || []),
      error: () => undefined
    });
  }

  applyPeriod(): void {
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    switch (this.period) {
      case 'HOY':
        this.fromDate = iso(today);
        this.toDate = iso(today);
        break;
      case 'MES':
        this.fromDate = iso(new Date(today.getFullYear(), today.getMonth(), 1));
        this.toDate = iso(today);
        break;
      case 'ANIO':
        this.fromDate = iso(new Date(today.getFullYear(), 0, 1));
        this.toDate = iso(today);
        break;
      case 'SEMESTRE':
        this.fromDate = iso(new Date(today.getFullYear(), today.getMonth() - 5, 1));
        this.toDate = iso(today);
        break;
      case 'PERSONALIZADO':
        break;
      default:
        this.fromDate = '';
        this.toDate = '';
    }
  }

  get filterParams(): { from?: string; to?: string; typeId?: number } {
    const params: { from?: string; to?: string; typeId?: number } = {};
    if (this.period !== 'TODO') {
      if (this.fromDate) params.from = this.fromDate;
      if (this.toDate) params.to = this.toDate;
    }
    if (this.typeId) params.typeId = this.typeId;
    return params;
  }

  /** Lista filtrada y ordenada según los controles de la barra de filtros */
  get filteredReports(): ReportItem[] {
    let result = [...this.reports];

    // Filtro por búsqueda
    const term = this.search?.toLowerCase().trim();
    if (term) {
      result = result.filter(r =>
        r.label.toLowerCase().includes(term) ||
        r.name.toLowerCase().includes(term)
      );
    }

    // Ordenamiento
    result.sort((a, b) => {
      const cmp = a.label.localeCompare(b.label, 'es');
      return this.sortBy === 'label-desc' ? -cmp : cmp;
    });

    return result;
  }

  /** Icono según el tipo de reporte (basado en label/name) */
  getReportIcon(r: ReportItem): string {
    const s = `${r.name} ${r.label}`.toLowerCase();
    if (s.includes('venta') || s.includes('ingreso') || s.includes('factur')) return 'sales';
    if (s.includes('usuario') || s.includes('user') || s.includes('agente') || s.includes('rendimiento')) return 'users';
    if (s.includes('sla') || s.includes('tiempo') || s.includes('resoluc') || s.includes('cumplimiento')) return 'sla';
    if (s.includes('inventario') || s.includes('stock') || s.includes('producto')) return 'inventory';
    if (s.includes('ticket')) return 'tickets';
    return 'default';
  }

  /** Clases Tailwind para el fondo del icono según el tipo */
  getIconBg(r: ReportItem): string {
    const icon = this.getReportIcon(r);
    const map: Record<string, string> = {
      sales: 'bg-success/10 text-success',
      users: 'bg-info/10 text-info',
      tickets: 'bg-primary/10 text-primary',
      sla: 'bg-warning/10 text-warning',
      inventory: 'bg-secondary/10 text-secondary',
      default: 'bg-primary/10 text-primary'
    };
    return map[icon] ?? map['default'];
  }

  /** Botón "Actualizar" de la barra del header. Como los reportes son estáticos,
   *  solo simulamos un pequeño delay para dar feedback visual. */
  loadReports(): void {
    if (this.loading) return;
    this.loading = true;
    setTimeout(() => {
      this.loading = false;
      Swal.fire({
        icon: 'success',
        title: 'Reportes actualizados',
        timer: 1000,
        showConfirmButton: false
      });
    }, 400);
  }

  /** Descarga un reporte mostrando spinner en su propia tarjeta */
  download(reportName: string, label: string): void {
    if (this.downloading[label]) return;
    this.downloading[label] = true;

    this.notificationService.downloadReport(reportName, this.format, this.filterParams).subscribe({
      next: (blob) => {
        const ext = this.format.toLowerCase();
        const date = new Date().toISOString().slice(0, 10);
        saveAs(blob, `${reportName}_${date}.${ext}`);

        Swal.fire({
          icon: 'success',
          title: `${label} generado`,
          timer: 1300,
          showConfirmButton: false
        });

        this.downloading[label] = false;
      },
      error: (err) => {
        Swal.fire(
          'Error',
          err?.error?.message || 'No se pudo generar el reporte',
          'error'
        );
        this.downloading[label] = false;
      }
    });
  }
}