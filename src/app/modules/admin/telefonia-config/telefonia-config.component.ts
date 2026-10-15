import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import Swal from 'sweetalert2';
import { ToastService } from '../../../core/services/toast.service';

/** Configuración tal como la devuelve GET /admin/telefonia (sin la clave). */
interface ConfigTelefonia {
  enabled: boolean;
  ucmUrl: string | null;
  ucmUsuario: string | null;
  claveConfigurada: boolean;
  tokenConfigurado: boolean;
  tokenCreado: string | null;
  puenteEnLinea: boolean;
  puenteVisto: string | null;
  puenteVersion: string | null;
  puenteIp: string | null;
  puenteUcmOk: boolean | null;
  puenteUcmError: string | null;
  habilitada: boolean;
}

interface LlamadaVista {
  id: string;
  estado: string;
  error: string | null;
  origen: string;
  destino: string;
  agente: string | null;
  solicitante: string | null;
  ticketNumero: number | null;
  ticketId: string | null;
  creada: string;
}

/** Badge de cada estado de llamada: color, icono y texto en español. */
const ESTADOS_LLAMADA: Record<string, { texto: string; icono: string; color: string }> = {
  PENDIENTE: { texto: 'Pendiente', icono: 'fa-solid fa-hourglass-half', color: '#D97706' },
  ENVIADA: { texto: 'En la central', icono: 'fa-solid fa-paper-plane', color: '#2563EB' },
  REALIZADA: { texto: 'Realizada', icono: 'fa-solid fa-phone', color: '#16A34A' },
  ERROR: { texto: 'Error', icono: 'fa-solid fa-triangle-exclamation', color: '#DC2626' },
  VENCIDA: { texto: 'No recogida', icono: 'fa-regular fa-clock', color: '#64748B' },
};

/**
 * Administración → Telefonía (SUPER_ADMIN).
 *
 * Todo lo del puente de telefonía se configura aquí: la conexión con la API de
 * la central Grandstream UCM, el token del puente, activar o desactivar el botón
 * Llamar, el estado del puente y las últimas llamadas. El puente, en el servidor
 * interno, solo guarda la URL de la mesa y su token, y descarga el resto.
 */
@Component({
  selector: 'app-telefonia-config',
  standalone: false,
  templateUrl: './telefonia-config.component.html',
})
export class TelefoniaConfigComponent implements OnInit, OnDestroy {
  private readonly url = `${environment.apiUrl}/admin/telefonia`;
  readonly estados = ESTADOS_LLAMADA;

  config: ConfigTelefonia | null = null;
  llamadas: LlamadaVista[] = [];
  cargando = true;
  guardando = false;
  generando = false;

  /** Formulario. La clave solo se manda si se escribe una nueva. */
  form = { enabled: false, ucmUrl: '', ucmUsuario: '', ucmClave: '' };

  /** Token recién generado: se muestra una sola vez. */
  tokenNuevo: string | null = null;
  copiado = false;

  private refresco?: ReturnType<typeof setInterval>;

  constructor(private http: HttpClient, private toast: ToastService) {}

  ngOnInit(): void {
    this.cargar(true);
    // Estado del puente y llamadas en vivo, sin pisar lo que se esté escribiendo.
    this.refresco = setInterval(() => this.cargar(false), 10_000);
  }

  ngOnDestroy(): void {
    if (this.refresco) clearInterval(this.refresco);
  }

  cargar(conFormulario: boolean): void {
    if (!conFormulario && document.hidden) return;
    this.http.get<ConfigTelefonia>(this.url).subscribe({
      next: (c) => {
        this.config = c;
        this.cargando = false;
        if (conFormulario) {
          this.form = { enabled: c.enabled, ucmUrl: c.ucmUrl ?? '', ucmUsuario: c.ucmUsuario ?? '', ucmClave: '' };
        }
      },
      error: () => {
        this.cargando = false;
        if (conFormulario) this.toast.error('No se pudo cargar la configuración de telefonía');
      },
    });
    this.http.get<LlamadaVista[]>(`${this.url}/llamadas`).subscribe({
      next: (l) => (this.llamadas = l),
      error: () => undefined,
    });
  }

  get urlValida(): boolean {
    const u = this.form.ucmUrl.trim();
    return !u || /^https?:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?(\/[A-Za-z0-9._\-/]*)?$/.test(u);
  }

  /** Para activar hacen falta URL, usuario y clave (la nueva o la ya guardada). */
  get puedeActivar(): boolean {
    return !!this.form.ucmUrl.trim() && !!this.form.ucmUsuario.trim()
      && (!!this.form.ucmClave || !!this.config?.claveConfigurada);
  }

  guardar(): void {
    if (!this.urlValida || this.guardando) return;
    if (this.form.enabled && !this.puedeActivar) {
      this.toast.warn('Complete la URL, el usuario y la clave de la API antes de activar');
      return;
    }
    this.guardando = true;
    this.http.put<ConfigTelefonia>(this.url, {
      enabled: this.form.enabled,
      ucmUrl: this.form.ucmUrl.trim(),
      ucmUsuario: this.form.ucmUsuario.trim(),
      ucmClave: this.form.ucmClave || null,
    }).subscribe({
      next: (c) => {
        this.config = c;
        this.form.ucmClave = '';
        this.guardando = false;
        this.toast.success('Configuración de telefonía guardada');
      },
      error: (e) => {
        this.guardando = false;
        this.toast.error(e?.error?.message || 'No se pudo guardar');
      },
    });
  }

  generarToken(): void {
    if (this.generando) return;
    if (!this.config?.tokenConfigurado) {
      this.pedirToken();
      return;
    }
    Swal.fire({
      title: '¿Generar un token nuevo?',
      text: 'El token actual dejará de funcionar y el puente se desconectará hasta que actualice su archivo .env.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Generar',
      cancelButtonText: 'Cancelar',
    }).then((r) => {
      if (r.isConfirmed) this.pedirToken();
    });
  }

  private pedirToken(): void {
    this.generando = true;
    this.http.post<{ token: string }>(`${this.url}/token`, {}).subscribe({
      next: (r) => {
        this.generando = false;
        this.tokenNuevo = r.token;
        this.copiado = false;
        this.cargar(false);
      },
      error: (e) => {
        this.generando = false;
        this.toast.error(e?.error?.message || 'No se pudo generar el token');
      },
    });
  }

  copiarToken(): void {
    if (!this.tokenNuevo) return;
    navigator.clipboard?.writeText(this.tokenNuevo).then(
      () => (this.copiado = true),
      () => this.toast.warn('No se pudo copiar: selecciónelo y cópielo a mano'),
    );
  }

  cerrarToken(): void {
    this.tokenNuevo = null;
  }

  estado(e: string) {
    return this.estados[e] ?? { texto: e, icono: 'fa-solid fa-circle-info', color: '#64748B' };
  }

  /** "hace 5 s", "hace 3 min"… para el último contacto del puente. */
  hace(fecha: string | null): string {
    if (!fecha) return 'nunca';
    const s = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 1000));
    if (s < 60) return `hace ${s} s`;
    const m = Math.round(s / 60);
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} h`;
    return new Date(fecha).toLocaleString('es-EC');
  }

  trackLlamada(_: number, l: LlamadaVista): string {
    return l.id;
  }
}
