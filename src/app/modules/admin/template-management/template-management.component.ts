import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import Swal from 'sweetalert2';
import { AdminService, NotificationTemplate } from '../../../core/services/admin.service';

@Component({
  selector: 'app-template-management',
  templateUrl: './template-management.component.html'
})
export class TemplateManagementComponent implements OnInit {
  templates: NotificationTemplate[] = [];
  loading = false;
  showNew = false;
  newTemplate: Partial<NotificationTemplate> = { activeTemplate: true };
  previewTemplate: NotificationTemplate | null = null;

  types = ['TICKET', 'RATING', 'SLA', 'EVAL'];

  constructor(
    private adminService: AdminService,
    private sanitizer: DomSanitizer
  ) {}

  previewHtml(body: string): SafeHtml {
    const html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;">
        ${body}
      </body>
      </html>`;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  preview(t: NotificationTemplate): void {
    this.previewTemplate = this.previewTemplate?.idTemplate === t.idTemplate ? null : t;
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.adminService.getTemplates().subscribe({ next: (t) => { this.templates = t; this.loading = false; }, error: () => { this.loading = false; Swal.fire('Error', 'No se pudieron cargar las plantillas', 'error'); } });
  }

  create(): void {
    if (!this.newTemplate.nameTemplate || !this.newTemplate.typeTemplate || !this.newTemplate.subjectTemplate || !this.newTemplate.bodyTemplate) return;
    this.adminService.createTemplate(this.newTemplate).subscribe({
      next: () => { this.load(); this.newTemplate = { activeTemplate: true }; this.showNew = false; Swal.fire('Éxito', 'Plantilla creada', 'success'); },
      error: (e) => Swal.fire('Error', e?.error?.message, 'error')
    });
  }

  delete(t: NotificationTemplate): void {
    Swal.fire({ title: '¿Eliminar?', text: t.nameTemplate, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((r) => { if (r.isConfirmed) this.adminService.deleteTemplate(t.idTemplate).subscribe({ next: () => this.load(), error: (e) => Swal.fire('Error', e?.error?.message, 'error') }); });
  }
}