import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Consulta de la auditoría del sistema.
 *
 * <p>Solo el super administrador. Lo que se ve aquí es qué usuario intentó qué y
 * desde dónde, así que es el rastro que hay que mirar cuando alguien reporta un
 * acceso que no debería haber ocurrido.
 */
@Component({
  selector: 'app-audit-sistema',
  standalone: false,
  templateUrl: './audit-sistema.component.html'
})
export class AuditSistemaComponent implements OnInit {
  filas: AuditRow[] = [];
  acciones: string[] = [];

  /** Filtros. Todos opcionales: vacíos se envían para no filtrar. */
  accion = '';
  usuario = '';
  desde = '';
  hasta = '';

  pagina = 0;
  tamano = 100;
  total = 0;

  loading = false;
  /** Pide confirmación antes de lanzar una búsqueda amplia. */
  avisandoRango = false;

  constructor(private http: HttpClient, private toast: ToastService) {}

  ngOnInit(): void {
    this.cargarAcciones();
    this.buscar();
  }

  cargar(): void {
    this.buscar();
  }

  limpiar(): void {
    this.accion = '';
    this.usuario = '';
    this.desde = '';
    this.hasta = '';
    this.pagina = 0;
    this.buscar();
  }

  cargarAcciones(): void {
    this.http
      .get<string[]>(`${environment.apiUrl}/admin/audit-sistema/acciones`)
      .subscribe({
        next: (a) => (this.acciones = a),
        // No es crítico: la pantalla funciona igual escribiendo la acción a mano.
        error: () => (this.acciones = [])
      });
  }

  /**
   * Lanza la consulta.
   *
   * <p>El rango se pide a mano y con confirmación cuando abarca mucho. Con
   * 400 registros no tiene sentido, pero alguien buscando "algo raro en enero"
   * acabará pidiendo un rango de un año, y eso son miles de filas en memoria.
   */
  buscar(): void {
    if (this.avisandoRango) {
      this.avisandoRango = false;
      this.consultar();
      return;
    }
    if (this.esRangoAmplio()) {
      this.avisandoRango = true;
      return;
    }
    this.consultar();
  }

  private esRangoAmplio(): boolean {
    if (!this.desde) return false;
    const dias = (Date.now() - new Date(this.desde).getTime()) / 86400000;
    return dias > 90;
  }

  private consultar(): void {
    this.loading = true;
    const params = new URLSearchParams();
    if (this.accion.trim()) params.set('accion', this.accion.trim());
    if (this.usuario.trim()) params.set('usuario', this.usuario.trim());
    if (this.desde) params.set('desde', `${this.desde}T00:00:00-05:00`);
    if (this.hasta) params.set('hasta', `${this.hasta}T23:59:59-05:00`);
    params.set('pagina', String(this.pagina));
    params.set('tamano', String(this.tamano));

    this.http
      .get<AuditRow[]>(`${environment.apiUrl}/admin/audit-sistema?${params.toString()}`)
      .subscribe({
        next: (f) => {
          this.filas = f;
          this.total = f.length;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.toast.error(err?.error?.message || 'No se pudo cargar la auditoría');
        }
      });
  }

  anterior(): void {
    if (this.pagina === 0) return;
    this.pagina--;
    this.consultar();
  }

  siguiente(): void {
    if (this.filas.length < this.tamano) return;
    this.pagina++;
    this.consultar();
  }

  hayPaginaAnterior(): boolean {
    return this.pagina > 0;
  }

  hayPaginaSiguiente(): boolean {
    return this.filas.length >= this.tamano;
  }

  /** La IP de bucle local (IPv6 o IPv4) es el propio servidor o el equipo de desarrollo. */
  origen(ip: string | null | undefined): string {
    if (!ip) return '—';
    return IPS_LOCALES.has(ip) ? 'Local' : ip;
  }

  /** Texto legible de la acción; si no está en el catálogo, el código tal cual. */
  etiquetaAccion(accion: string): string {
    return ETIQUETAS_ACCION[accion] ?? accion;
  }

  /** Colorea las acciones para que un fallo de acceso salte a la vista. */
  colorAccion(accion: string): string {
    if (!accion) return '';
    // Lo que salió bien no es una advertencia: antes un LOGIN correcto se
    // pintaba en amarillo, igual que los intentos sospechosos.
    if (EXITOSAS.has(accion)) {
      return 'badge-success';
    }
    if (accion.includes('FAILED') || accion.includes('DENIED') || accion.includes('REUSE')
        || accion === 'SUSPICIOUS_ACTIVITY' || accion === 'ALERTA_SEGURIDAD') {
      return 'badge-error';
    }
    if (accion.startsWith('MFA_') || accion.startsWith('PASSWORD') || accion.startsWith('LOGIN')) {
      return 'badge-warning';
    }
    if (accion.includes('DELETE') || accion.includes('DISABLED') || accion.includes('SETTING')) {
      return 'badge-info';
    }
    return 'badge-ghost';
  }
}

export interface AuditRow {
  id: string;
  usuario: string;
  accion: string;
  entidad: string | null;
  entidadId: string | null;
  ip: string | null;
  detalles: string | null;
  metodo: string | null;
  ruta: string | null;
  requestId: string | null;
  fecha: string;
}

const IPS_LOCALES = new Set(['0:0:0:0:0:0:0:1', '::1', '127.0.0.1']);

/** Acciones de acceso que terminaron bien. */
const EXITOSAS = new Set(['LOGIN', 'LOGOUT', 'MFA_VERIFIED', 'MFA_ENROLLED']);

/**
 * Códigos que registra el backend (SystemAuditService y el interceptor de
 * /admin/**), en el idioma de quien lee la auditoría.
 */
const ETIQUETAS_ACCION: Record<string, string> = {
  LOGIN: 'Inicio de sesión',
  LOGIN_FAILED: 'Inicio de sesión fallido',
  LOGIN_BLOCKED: 'Inicio de sesión bloqueado',
  LOGOUT: 'Cierre de sesión',
  ACCESS_DENIED: 'Acceso denegado',
  CSRF_REJECTED: 'Petición rechazada (CSRF)',
  REFRESH_TOKEN_REUSE: 'Reutilización de sesión',
  PASSWORD_CHANGE: 'Cambio de contraseña',
  PASSWORD_RESET: 'Restablecimiento de contraseña',
  PASSWORD_RESET_REQUESTED: 'Solicitud de restablecimiento',
  PROFILE_UPDATE: 'Perfil actualizado',
  MFA_ENROLLED: 'Doble factor activado',
  MFA_ENROLL_FAILED: 'Alta de doble factor fallida',
  MFA_VERIFIED: 'Doble factor verificado',
  MFA_FAILED: 'Doble factor fallido',
  MFA_DISABLED: 'Doble factor desactivado',
  MFA_DISABLE_FAILED: 'Baja de doble factor fallida',
  MFA_RECOVERY_FAILED: 'Código de recuperación fallido',
  MFA_RECOVERY_REGENERATED: 'Códigos de recuperación regenerados',
  MFA_SETTING: 'Configuración de doble factor',
  ADMIN_CREATE: 'Alta en administración',
  ADMIN_UPDATE: 'Cambio en administración',
  ADMIN_DELETE: 'Baja en administración',
  USER_CREATE: 'Usuario creado',
  USER_UPDATE: 'Usuario actualizado',
  USER_DELETE: 'Usuario eliminado',
  USER_STATUS_CHANGE: 'Estado de usuario cambiado',
  AI_CONFIG: 'Configuración de IA',
  MSGRAPH_CONFIG: 'Configuración de Microsoft Graph',
  ROUTING_CONFIG: 'Configuración de asignación',
  REPORT_GENERATE: 'Reporte generado',
  DAILY_SUMMARY: 'Resumen diario',
  ALERTA_SEGURIDAD: 'Alerta de seguridad',
  SUSPICIOUS_ACTIVITY: 'Actividad sospechosa',
  WORKFLOW_CREATE: 'Automatización creada',
  WORKFLOW_UPDATE: 'Automatización actualizada',
  WORKFLOW_DELETE: 'Automatización eliminada',
  WORKFLOW_ACTIVATE: 'Automatización activada',
  WORKFLOW_DEACTIVATE: 'Automatización desactivada',
  WORKFLOW_MANUAL_RUN: 'Ejecución manual',
  WORKFLOW_EXECUTION_CANCEL: 'Ejecución cancelada',
  WORKFLOW_PURGE: 'Purga de ejecuciones',
  WORKFLOW_ERROR: 'Error de automatización',
  WORKFLOW_APROBACION: 'Aprobación solicitada',
  WORKFLOW_APPROVAL_DECIDED: 'Aprobación resuelta'
};
