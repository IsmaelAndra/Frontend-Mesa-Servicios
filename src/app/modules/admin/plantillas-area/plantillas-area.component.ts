import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import Swal from 'sweetalert2';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { PlantillaAreaService, PlantillaDeArea } from '../../../core/services/plantilla-area.service';
import { opcionEventoPlantilla } from '../../../core/utils/opciones-select.util';
import { MasterOption } from '../../shared/components/master-select/master-select.component';

/** Qué dispara cada plantilla, en palabras (igual que en Plantillas). */
const DISPARADOR: Record<string, string> = {
  TICKET_CREADO: 'Al crear un ticket',
  TICKET_ASIGNADO: 'Al asignar un agente',
  TICKET_ACTUALIZADO: 'Al actualizar el ticket',
  TICKET_RESUELTO: 'Al resolver el ticket',
  TICKET_CERRADO: 'Al cerrar el ticket',
  CHAT_MENSAJE: 'Nuevo mensaje en el chat',
  RATING_REQUEST: 'Al pedir la calificación',
  SLA_WARNING: 'SLA al 80%',
  SLA_BREACHED: 'SLA vencido',
  ESCALATION: 'Al escalar un ticket',
  ACCESO_CONFIDENCIAL: 'Acceso a un ticket confidencial',
};

/** Valores de ejemplo para la vista previa. */
const EJEMPLO: Record<string, string> = {
  id: '123', numero: '123', ticket: '123', titulo: 'No puedo ingresar al sistema', title: 'No puedo ingresar al sistema',
  nombre: 'Nombre Apellido', agente: 'Nombre del agente', solicitante: 'Nombre Apellido', estado: 'En proceso',
  status: 'En proceso', prioridad: 'Media', priority: 'Media', categoria: 'Acceso a sistemas', area: 'Su área',
  percentage: '80', porcentaje: '80', mensaje: '<p>Texto del mensaje.</p>', asunto: 'Asunto del aviso',
  appName: 'Mesa de Servicios', urlTicket: '#', urlCalificar: '#', urlDashboard: '#',
  fecha: new Date().toLocaleDateString('es-EC'), hora: new Date().toTimeString().slice(0, 5),
};

/**
 * Plantillas de correo por área (V38): cada área puede tener su versión de los
 * avisos de tickets (firma, tono, datos de contacto); si no, sale la general.
 * El jefe edita las de su área y el súper admin las de cualquiera.
 */
@Component({
  selector: 'app-plantillas-area',
  templateUrl: './plantillas-area.component.html',
})
export class PlantillasAreaComponent implements OnInit {
  esSuperAdmin = false;
  soloLectura = false;
  areas: MasterOption[] = [];
  areaId: string | null = null;
  plantillas: PlantillaDeArea[] = [];
  cargando = false;

  // Edición
  editando: PlantillaDeArea | null = null;
  asunto = '';
  cuerpo = '';
  activa = true;
  guardando = false;
  readonly variables = ['[nombre]', '[id]', '[titulo]', '[estado]', '[prioridad]', '[agente]', '[urlTicket]', '[logo]'];

  private clavePreview = '';
  private htmlPreview: SafeHtml | null = null;

  constructor(
    private servicio: PlantillaAreaService,
    private adminService: AdminService,
    private authService: AuthService,
    private toast: ToastService,
    private sanitizer: DomSanitizer,
  ) {
    const rol = this.authService.getRole();
    this.esSuperAdmin = rol === 'SUPER_ADMIN';
    this.soloLectura = rol === 'AUDITOR';
  }

  ngOnInit(): void {
    if (this.esSuperAdmin || this.soloLectura) {
      this.adminService.catalog().subscribe({
        next: (c) => {
          this.areas = (c.areas || []).filter((a) => a.status !== false).map((a) => ({ value: a.id, label: a.name, icon: a.icon, color: a.color }));
          if (!this.areaId && this.areas.length) this.elegirArea(this.areas[0].value as string);
        },
        error: () => undefined,
      });
    } else {
      // El jefe: su área, que llega con los permisos (también tras recargar).
      this.authService.permisosCargados().subscribe(() => {
        const mia = this.authService.areasACargo()[0];
        if (mia) this.elegirArea(mia);
      });
    }
  }

  elegirArea(id: string | null): void {
    this.areaId = id;
    this.plantillas = [];
    if (!id) return;
    this.cargando = true;
    this.servicio.listar(id).subscribe({
      next: (l) => {
        this.plantillas = l || [];
        this.cargando = false;
      },
      error: (e) => {
        this.cargando = false;
        this.toast.error(e?.error?.message || 'No se pudieron cargar las plantillas');
      },
    });
  }

  disparador(nombre: string): string {
    return DISPARADOR[nombre] || nombre;
  }

  opcion(p: PlantillaDeArea): MasterOption {
    const o = opcionEventoPlantilla(p.nombre, this.disparador(p.nombre));
    return { ...o, icon: p.icono || o.icon, color: p.color || o.color };
  }

  editar(p: PlantillaDeArea): void {
    this.editando = p;
    this.asunto = p.asunto;
    this.cuerpo = p.cuerpo;
    this.activa = p.activa;
  }

  cerrar(): void {
    if (!this.guardando) this.editando = null;
  }

  insertar(v: string): void {
    this.cuerpo = (this.cuerpo || '') + v;
  }

  copiarGeneral(): void {
    if (!this.editando) return;
    this.asunto = this.editando.asuntoGeneral;
    this.cuerpo = this.editando.cuerpoGeneral;
  }

  get valido(): boolean {
    return !!this.asunto.trim() && !!this.cuerpo.trim() && this.asunto.length <= 255;
  }

  guardar(): void {
    const p = this.editando;
    if (!p || !this.areaId || !this.valido || this.guardando) return;
    this.guardando = true;
    this.servicio.guardar(this.areaId, p.nombre, this.asunto.trim(), this.cuerpo, this.activa).subscribe({
      next: (r) => {
        this.guardando = false;
        this.plantillas = this.plantillas.map((x) => (x.nombre === r.nombre ? r : x));
        this.editando = null;
        this.toast.success('Plantilla del área guardada');
      },
      error: (e) => {
        this.guardando = false;
        this.toast.error(e?.error?.message || 'No se pudo guardar');
      },
    });
  }

  restablecer(p: PlantillaDeArea): void {
    if (!this.areaId) return;
    const areaId = this.areaId;
    Swal.fire({ reverseButtons: true, cancelButtonColor: '#6b7280',
      title: '¿Volver a la plantilla general?', text: 'Se borra la versión de esta área.', icon: 'question',
      showCancelButton: true, confirmButtonText: 'Sí, volver', cancelButtonText: 'Cancelar',
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.servicio.restablecer(areaId, p.nombre).subscribe({
        next: () => {
          this.toast.success('Ahora usa la plantilla general');
          this.editando = null;
          this.elegirArea(areaId);
        },
        error: (e) => this.toast.error(e?.error?.message || 'No se pudo restablecer'),
      });
    });
  }

  /**
   * Vista previa en un iframe con `sandbox` (sin scripts). Igual que en
   * Plantillas, hace falta bypassSecurityTrustHtml porque Angular borraría los
   * estilos en línea del correo; se quitan antes scripts y manejadores.
   */
  preview(): SafeHtml {
    const clave = this.cuerpo;
    if (this.htmlPreview && clave === this.clavePreview) return this.htmlPreview;
    this.clavePreview = clave;
    const html = (this.cuerpo || '')
      .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/\[logo\]/g, '<b style="color:#fff">LOGO</b>')
      .replace(/\{\{(\w+)\}\}|\[(\w+)\]/g, (_m: string, a?: string, b?: string) => EJEMPLO[(a ?? b) || ''] ?? 'dato de ejemplo');
    this.htmlPreview = this.sanitizer.bypassSecurityTrustHtml(html);
    return this.htmlPreview;
  }

  trackPlantilla(_: number, p: PlantillaDeArea): string {
    return p.nombre;
  }
}
