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

  /** Bloque que se pide al servidor (máximo que acepta) y página dentro de él. */
  pagina = 0;
  tamano = 200;
  total = 0;
  paginaLocal = 0;
  porPagina = 25;

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
          this.paginaLocal = 0;
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

  /** Filas de la página visible (el paginador común trabaja sobre el bloque cargado). */
  get filasPagina(): AuditRow[] {
    const desde = this.paginaLocal * this.porPagina;
    return this.filas.slice(desde, desde + this.porPagina);
  }

  cambiarPorPagina(n: number): void {
    this.porPagina = n;
    this.paginaLocal = 0;
  }

  trackFila(_: number, f: AuditRow): string {
    return f.id;
  }

  /** La IP de bucle local (IPv6 o IPv4) es el propio servidor o el equipo de desarrollo. */
  origen(ip: string | null | undefined): string {
    if (!ip) return '—';
    return IPS_LOCALES.has(ip) ? 'Local' : ip;
  }

  /**
   * Texto legible de la acción. Si un código nuevo no está en el catálogo se
   * traduce palabra a palabra, para que nunca salga en inglés.
   */
  etiquetaAccion(accion: string): string {
    if (!accion) return '—';
    const conocida = ETIQUETAS_ACCION[accion];
    if (conocida) return conocida;
    const texto = accion
      .split('_')
      .map((p) => PALABRAS[p] ?? p.toLowerCase())
      .join(' ');
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  /**
   * Color e icono del badge (mismo patrón que los de estado: fondo tenue, borde
   * y texto del color). Los fallos de acceso saltan a la vista en rojo.
   */
  metaAccion(accion: string): { color: string; icono: string } {
    if (!accion) return TONOS.neutro;
    // Lo que salió bien no es una advertencia: antes un LOGIN correcto se
    // pintaba en amarillo, igual que los intentos sospechosos.
    if (EXITOSAS.has(accion)) return TONOS.exito;
    if (accion.includes('FAILED') || accion.includes('DENIED') || accion.includes('REUSE')
        || accion.includes('REJECTED') || accion.includes('BLOCKED')
        || accion === 'SUSPICIOUS_ACTIVITY' || accion === 'ALERTA_SEGURIDAD'
        || accion === 'WORKFLOW_ERROR') {
      return TONOS.error;
    }
    if (accion.startsWith('MFA_') || accion.startsWith('PASSWORD') || accion.startsWith('LOGIN')) {
      return TONOS.seguridad;
    }
    if (accion.includes('DELETE') || accion.includes('DISABLED') || accion.includes('PURGE')
        || accion.includes('CANCEL')) {
      return TONOS.baja;
    }
    if (accion.includes('CREATE') || accion.includes('ACTIVATE')) return TONOS.alta;
    if (accion.includes('CONFIG') || accion.includes('SETTING')) return TONOS.config;
    if (accion.includes('UPDATE') || accion.includes('CHANGE') || accion.includes('ASSIGN')) {
      return TONOS.cambio;
    }
    return TONOS.neutro;
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

/** Tonos de los badges de acción: color de marca de cada tipo + icono. */
const TONOS = {
  exito: { color: '#16A34A', icono: 'fa-solid fa-circle-check' },
  error: { color: '#DC2626', icono: 'fa-solid fa-triangle-exclamation' },
  seguridad: { color: '#D97706', icono: 'fa-solid fa-key' },
  baja: { color: '#BE185D', icono: 'fa-solid fa-trash-can' },
  alta: { color: '#0D9488', icono: 'fa-solid fa-circle-plus' },
  config: { color: '#7C3AED', icono: 'fa-solid fa-sliders' },
  cambio: { color: '#2563EB', icono: 'fa-solid fa-pen' },
  neutro: { color: '#64748B', icono: 'fa-solid fa-circle-info' }
};

/** Traducción palabra a palabra para códigos que aún no están en el catálogo. */
const PALABRAS: Record<string, string> = {
  CREATE: 'creación', CREATED: 'creado', UPDATE: 'actualización', UPDATED: 'actualizado',
  DELETE: 'eliminación', DELETED: 'eliminado', CHANGE: 'cambio', STATUS: 'estado',
  ASSIGN: 'asignación', UNASSIGN: 'devolución', ASSET: 'de activo', USER: 'usuario',
  TICKET: 'ticket', CONFIG: 'configuración', FAILED: 'fallido', DENIED: 'denegado',
  ACCESS: 'acceso', ADMIN: 'administración', REPORT: 'reporte', SETTING: 'ajuste',
  WORKFLOW: 'automatización', APPROVAL: 'aprobación', DECIDED: 'resuelta', TEAM: 'equipo',
  AREA: 'área', MAIL: 'correo', PASSWORD: 'contraseña', LOGIN: 'inicio de sesión',
  ENABLED: 'activado', DISABLED: 'desactivado', REQUEST: 'solicitud', REQUESTED: 'solicitado',
  EXPORT: 'exportación', IMPORT: 'importación', SYNC: 'sincronización', ERROR: 'error'
};

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
  WORKFLOW_APPROVAL_DECIDED: 'Aprobación resuelta',
  WORKFLOW_STEP: 'Paso de automatización',
  CREATE_ASSET: 'Activo registrado',
  UPDATE_ASSET: 'Activo actualizado',
  DELETE_ASSET: 'Activo eliminado',
  ASSIGN_ASSET: 'Activo asignado',
  UNASSIGN_ASSET: 'Activo devuelto',
  CHANGE_ASSET_STATUS: 'Estado de activo cambiado'
};
