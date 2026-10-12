import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService, ReportConfig } from '../../../core/services/admin.service';
import { Paginacion } from '../../../core/utils/pagination.util';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-report-management',
  templateUrl: './report-management.component.html'
})
export class ReportManagementComponent implements OnInit {
  reports: ReportConfig[] = [];
  /** Paginacion en cliente: el endpoint devuelve la lista completa. */
  readonly pagReportes = new Paginacion<ReportConfig>(() => this.reports);
  loading = false;
  showCreate = false;
  newReport: Partial<ReportConfig> = this.emptyReport();
  editReport: ReportConfig | null = null;

  constructor(private adminService: AdminService, private toastService: ToastService) {}

  private emptyReport(): Partial<ReportConfig> {
    return { activeReport: true, iconReport: 'fa-solid fa-file-lines', colorReport: '#062e86' };
  }

  /** Muestra la consulta SQL del reporte en un modal, para no saturar la tabla. */
  verConsulta(r: ReportConfig): void {
    Swal.fire({
      title: r.titleReport || r.nameReport,
      html: `<pre style="text-align:left;white-space:pre-wrap;word-break:break-word;max-height:60vh;overflow:auto;font-size:12px">${
        this.escapeHtml(r.querySql || '')
      }</pre>`,
      customClass: { popup: 'text-left' },
      confirmButtonColor: '#062e86',
      confirmButtonText: 'Cerrar',
      width: '48rem'
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.adminService.getReports().subscribe({
      next: (r) => { this.reports = r; this.loading = false; },
      error: () => { this.loading = false; this.toastService.error('No se pudieron cargar los reportes'); }
    });
  }

  reportIcon(r: Partial<ReportConfig>): string {
    return r.iconReport || 'fa-solid fa-file-lines';
  }

  reportColor(r: Partial<ReportConfig>): string {
    return r.colorReport || '#062e86';
  }

  create(): void {
    if (!this.newReport.nameReport?.trim() || !this.newReport.titleReport?.trim() || !this.newReport.querySql?.trim()) return;
    this.adminService.createReport({
      name: this.newReport.nameReport.trim(),
      title: this.newReport.titleReport.trim(),
      description: this.newReport.descriptionReport?.trim() || '',
      querySql: this.newReport.querySql.trim(),
      active: this.newReport.activeReport ?? true,
      icon: this.newReport.iconReport ?? '',
      color: this.newReport.colorReport ?? ''
    }).subscribe({
      next: () => {
        this.load();
        this.newReport = this.emptyReport();
        this.showCreate = false;
        this.toastService.success('Reporte creado');
      },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo crear el reporte')
    });
  }

  edit(r: ReportConfig): void { this.editReport = { ...r }; }
  cancelEdit(): void { this.editReport = null; }

  saveEdit(): void {
    if (!this.editReport || !this.editReport.nameReport?.trim() || !this.editReport.titleReport?.trim() || !this.editReport.querySql?.trim()) return;
    this.adminService.updateReport(this.editReport.idReport, {
      name: this.editReport.nameReport,
      title: this.editReport.titleReport,
      description: this.editReport.descriptionReport || '',
      querySql: this.editReport.querySql,
      active: this.editReport.activeReport,
      icon: this.editReport.iconReport ?? '',
      color: this.editReport.colorReport ?? ''
    }).subscribe({
      next: () => { this.load(); this.editReport = null; this.toastService.success('Reporte actualizado'); },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo actualizar el reporte')
    });
  }

  /** Activa o desactiva un reporte sin entrar en modo edición. */
  toggleActive(r: ReportConfig): void {
    this.adminService.updateReport(r.idReport, {
      name: r.nameReport,
      title: r.titleReport,
      description: r.descriptionReport || '',
      querySql: r.querySql,
      active: !r.activeReport,
      icon: r.iconReport ?? '',
      color: r.colorReport ?? ''
    }).subscribe({
      next: () => { this.load(); this.toastService.success(r.activeReport ? 'Reporte desactivado' : 'Reporte activado'); },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo actualizar el reporte')
    });
  }

  delete(r: ReportConfig): void {
    Swal.fire({ title: '¿Eliminar reporte?', text: r.titleReport, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((res) => {
        if (res.isConfirmed) {
          this.adminService.deleteReport(r.idReport).subscribe({
            next: () => { this.load(); this.toastService.success('Reporte eliminado'); },
            error: (e) => this.toastService.error(e?.error?.message || 'No se pudo eliminar el reporte')
          });
        }
      });
  }
}