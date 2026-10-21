import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AdminService, BrandingConfig, ErrorPageTexts } from '../../../core/services/admin.service';
import {
  ERROR_GENERICO,
  ResolvedErrorPage,
  resolveErrorPage,
  resolveMaintenance,
} from '../../../core/utils/error-page.util';
import { urlDelApi } from '../../../core/utils/url-api.util';

/**
 * Pantalla publica de error: 404, 403, 500 y 503, mas el aviso de
 * mantenimiento previsto.
 *
 * Antes esta pantalla solo distinguia el 404: cualquier otro codigo caia en un
 * texto generico, y el 403 (falta de permisos) se traducía en un mensaje que no
 * explicaba nada. Ahora cada estado trae su titulo, mensaje, icono y color, y
 * todos son editables desde el panel.
 *
 * La pantalla esta en el modulo de auth y no lleva AuthGuard a proposito: el 403
 * aparece precisamente cuando el rol no alcanza, y el 500 cuando el backend no
 * responde. Ninguno de los dos casos tiene una sesion que valga.
 *
 * El texto se resuelve con `resolveErrorPage`, que trae respaldos propios, y el
 * `error` del GET apaga el spinner sin propagar: si el backend esta caido, esta
 * pantalla es justo la que tiene que seguir explicando algo.
 */
@Component({
  selector: 'app-mantenimiento',
  templateUrl: './mantenimiento.component.html',
  styleUrls: ['./mantenimiento.component.css']
})
export class MantenimientoComponent implements OnInit {
  branding: BrandingConfig | null = null;
  textos: ErrorPageTexts | null = null;
  cargando = true;

  /**
   * Estado de la situacion. Se toma del `data.status` de la ruta propia
   * (`/404`, `/403`, `/500`, `/503`), o del query (`?status=403`) por
   * compatibilidad, y, si no, del branding: el guard de mantenimiento salta
   * antes de que exista ruta.
   */
  status = 0;

  constructor(
    private adminService: AdminService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const data = Number(this.route.snapshot.data['status'] || 0);
    const query = Number(this.route.snapshot.queryParamMap.get('status') || 0);
    this.status = data || query;
    // Los dos GET son independientes: si el de los textos de error falla pero el
    // de branding responde, la pantalla se puede pintar igual. Se por eso a
    // separate en vez de anidar uno dentro del otro.
    this.adminService.getErrorTexts().subscribe({
      next: (t) => (this.textos = t),
      error: () => undefined,
      complete: () => (this.cargando = false),
    });
    this.adminService.getBranding().subscribe({
      next: (b) => (this.branding = b),
      error: () => undefined,
    });
  }

  /** true cuando el sistema esta en mantenimiento previsto, no por un fallo. */
  get enMantenimiento(): boolean {
    return this.branding?.maintenanceMode === true;
  }

  /** Texto ya resuelto, con respaldos, listo para pintar. */
  get pagina(): ResolvedErrorPage {
    // El mantenimiento tiene prioridad: si el sistema esta caido a proposito, el
    // 503 con su fecha de vuelta dice mas que el error generico.
    if (this.enMantenimiento) {
      const m = resolveMaintenance(this.branding);
      return {
        status: 503,
        title: m.titulo,
        message: m.mensaje,
        icon: this.branding?.maintenanceIcon || 'fa-solid fa-screwdriver-wrench',
        color: this.branding?.maintenanceIconColor || '#d97706',
      };
    }
    if (!this.status) return { ...ERROR_GENERICO };
    return resolveErrorPage(this.status, this.textos);
  }

  get titulo(): string {
    return this.pagina.title;
  }

  get mensaje(): string {
    return this.pagina.message;
  }

  get icono(): string {
    return this.pagina.icon;
  }

  /** Texto del botón principal, configurable en Páginas del Sistema. */
  get botonTexto(): string {
    return this.textos?.errorButtonText?.trim() || 'Volver al inicio';
  }

  /** Mostrar el código grande ("404"). Por defecto sí. */
  get mostrarCodigo(): boolean {
    return this.textos?.errorShowCode !== false;
  }

  /** Mostrar el enlace a la política de privacidad. Por defecto sí. */
  get mostrarPrivacidad(): boolean {
    return this.textos?.errorShowPrivacy !== false;
  }

  get colorIcono(): string {
    return this.pagina.color;
  }

  /** Fecha estimada de vuelta, solo si el mantenimiento la informo. */
  get eta(): string {
    return this.enMantenimiento ? resolveMaintenance(this.branding).eta : '';
  }

  get logo(): string {
    const url =
      this.branding?.maintenanceLogoUrl || this.branding?.logoUrl || this.branding?.systemIconUrl || '';
    return this.absoluta(url);
  }

  private absoluta(url: string): string {
    if (!url) return '';
    return urlDelApi(url);
  }

  /**
   * A donde lleva el boton. En un 403 tiene sentido volver al panel o al inicio
   * segun quien sea; en el resto, al inicio.
   */
  volver(): void {
    this.router.navigate(['/dashboard']);
  }

  /** Enlace a la politica de privacidad, que es publica y sin sesion. */
  verPrivacidad(): void {
    this.router.navigate(['/privacidad']);
  }
}