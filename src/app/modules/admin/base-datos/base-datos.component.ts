import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { tamanoLegible } from '../../../core/utils/abrir-blob.util';

/** GET /admin/base-datos/estado */
interface EstadoBaseDatos {
  permiteRestaurar: boolean;
  herramientas: boolean;
  versionPgDump: string | null;
  baseDatos: string;
  tamano: string | null;
  autenticadorListo: boolean;
}

/**
 * Administración → Base de datos (SUPER_ADMIN): descargar una copia, subir una
 * copia (p. ej. la de producción en pruebas) y restablecer a cero. Todo pide el
 * código de la app de autenticación. Subir y restablecer solo se ofrecen donde
 * el servidor lo permite (BD_PERMITIR_RESTAURAR=true, ambiente de pruebas).
 */
@Component({
  selector: 'app-base-datos',
  templateUrl: './base-datos.component.html',
})
export class BaseDatosComponent implements OnInit {
  estado: EstadoBaseDatos | null = null;
  cargando = true;
  /** Operación en curso: 'descarga' | 'subida' | 'restableciendo' | null */
  trabajando: string | null = null;
  /** Avance de la subida (0–100). */
  avance = 0;
  archivo: File | null = null;
  private readonly url = `${environment.apiUrl}/admin/base-datos`;

  constructor(private http: HttpClient, private auth: AuthService, private toast: ToastService) {}

  ngOnInit(): void {
    this.http.get<EstadoBaseDatos>(`${this.url}/estado`).subscribe({
      next: (e) => { this.estado = e; this.cargando = false; },
      error: () => { this.cargando = false; this.toast.error('No se pudo consultar la base de datos'); },
    });
  }

  tamano(f: File): string {
    return tamanoLegible(f.size);
  }

  /** Por qué no se puede usar una acción (vacío si se puede). */
  get motivoBloqueo(): string {
    if (!this.estado) return 'Cargando…';
    if (!this.estado.herramientas) return 'El servidor no tiene pg_dump / pg_restore instalados.';
    if (!this.estado.autenticadorListo) return 'Configure primero su app de autenticación (Seguridad → Autenticación MFA).';
    return '';
  }

  get motivoRestaurar(): string {
    if (this.motivoBloqueo) return this.motivoBloqueo;
    if (!this.estado?.permiteRestaurar) return 'En este ambiente no se puede reemplazar la base (solo en pruebas, con BD_PERMITIR_RESTAURAR=true).';
    return '';
  }

  elegirArchivo(files: File[]): void {
    const f = files?.[0] ?? null;
    if (f && !/\.(dump|backup)$/i.test(f.name)) {
      this.toast.warn('Elija una copia descargada desde esta pantalla (.dump)');
      return;
    }
    this.archivo = f;
  }

  private async pedirCodigo(texto: string, palabra?: string): Promise<string | null> {
    const r = await Swal.fire({
      title: 'Código de verificación',
      html: texto + (palabra ? `<br><br>Para confirmar, escriba también <b>${palabra}</b> abajo.` : ''),
      input: 'text',
      inputLabel: 'Código de 6 dígitos de su app de autenticación',
      inputAttributes: { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6' },
      inputValidator: (v) => (/^\d{6}$/.test((v || '').trim()) ? null : 'Son 6 dígitos'),
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      cancelButtonColor: '#6b7280',
      confirmButtonColor: palabra ? '#dc2626' : undefined,
      focusCancel: !!palabra,
    });
    if (!r.isConfirmed) return null;
    const codigo = String(r.value || '').trim();
    if (palabra) {
      const c = await Swal.fire({
        title: `Escriba ${palabra}`,
        text: 'Esta acción borra la base de datos actual y no se puede deshacer.',
        icon: 'warning',
        input: 'text',
        inputValidator: (v) => ((v || '').trim() === palabra ? null : `Escriba ${palabra} en mayúsculas`),
        showCancelButton: true,
        reverseButtons: true,
        confirmButtonText: 'Borrar y continuar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        focusCancel: true,
      });
      if (!c.isConfirmed) return null;
    }
    return codigo;
  }

  async descargar(): Promise<void> {
    const codigo = await this.pedirCodigo('La copia contiene <b>todos los datos</b> del sistema. Guárdela en un lugar seguro.');
    if (!codigo) return;
    this.trabajando = 'descarga';
    this.http.post<{ permiso: string }>(`${this.url}/descargar`, { codigoMfa: codigo }).subscribe({
      next: ({ permiso }) => {
        this.trabajando = null;
        // Enlace normal de un solo uso: el navegador guarda el archivo sin cargarlo en memoria.
        const a = document.createElement('a');
        a.href = `${environment.apiUrl}/base-datos/descarga/${encodeURIComponent(permiso)}`;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        this.toast.success('La descarga empezó. Puede tardar unos minutos según el tamaño de la base.', 'Copia de la base');
      },
      error: (e) => {
        this.trabajando = null;
        this.toast.error(e?.error?.message || 'No se pudo descargar la copia');
      },
    });
  }

  async restaurar(): Promise<void> {
    if (!this.archivo) return;
    const codigo = await this.pedirCodigo(
      `Se reemplazará <b>toda</b> la base por la copia <b>${this.archivo.name.replace(/[<>&"]/g, '')}</b>. `
      + 'Después se apagan el correo, la telefonía y las automatizaciones, y todos vuelven a iniciar sesión.',
      'RESTAURAR');
    if (!codigo) return;
    this.trabajando = 'subida';
    this.avance = 0;
    this.http.put(`${this.url}/restaurar`, this.archivo, {
      headers: { 'Content-Type': 'application/octet-stream', 'X-Codigo-Mfa': codigo },
      reportProgress: true,
      observe: 'events',
    }).subscribe({
      next: (ev) => {
        if (ev.type === HttpEventType.UploadProgress && ev.total) {
          this.avance = Math.round((ev.loaded / ev.total) * 100);
        }
        if (ev.type === HttpEventType.Response) {
          this.terminar('La base se restauró desde la copia. Inicie sesión con una cuenta de esa copia.');
        }
      },
      error: (e) => {
        this.trabajando = null;
        this.toast.error(e?.error?.message || 'No se pudo restaurar la copia');
      },
    });
  }

  async restablecer(): Promise<void> {
    const codigo = await this.pedirCodigo(
      'Se borrarán <b>todos</b> los datos (tickets, usuarios, activos, proyectos, configuración). '
      + 'Solo quedará su cuenta de súper admin, con su contraseña actual.',
      'RESTABLECER');
    if (!codigo) return;
    this.trabajando = 'restableciendo';
    this.http.post(`${this.url}/restablecer`, { codigoMfa: codigo, confirmacion: 'RESTABLECER' }).subscribe({
      next: () => this.terminar('La base quedó como recién instalada. Vuelva a iniciar sesión.'),
      error: (e) => {
        this.trabajando = null;
        this.toast.error(e?.error?.message || 'No se pudo restablecer la base');
      },
    });
  }

  /** Tras cambiar la base, la sesión actual ya no existe: aviso y al login. */
  private terminar(mensaje: string): void {
    this.trabajando = null;
    Swal.fire({
      icon: 'success',
      title: 'Listo',
      text: mensaje,
      confirmButtonText: 'Ir a iniciar sesión',
      allowOutsideClick: false,
    }).then(() => this.auth.logout());
  }
}
