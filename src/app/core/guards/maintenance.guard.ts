import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminService } from '../services/admin.service';

/**
 * Rutas que se saltan el modo mantenimiento:
 * - la propia pantalla de mantenimiento, si no, se redirigiria a si misma en
 *   bucle y ningun administrador podria volver a encender el sistema;
 * - la de Configuración de Marca, para poder ajustar la imagen de la pantalla
 *   de aviso mientras esta activa;
 * - la de Páginas del Sistema (pages-system), donde vive el interruptor
 *   principal del modo mantenimiento.
 */
const EXENTAS = ['/admin/pages-system', '/admin/branding', '/auth'];

/** Redirige a la pantalla de mantenimiento cuando el administrador la tiene activa. */
export const maintenanceGuard: CanActivateFn = () => {
  const adminService = inject(AdminService);
  const router = inject(Router);

  if (EXENTAS.some((r) => router.url.startsWith(r))) {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    adminService.getBranding().subscribe({
      next: (b) => {
        if (!b.maintenanceMode) {
          resolve(true);
          return;
        }
        router.navigate(['/mantenimiento']).then(() => resolve(false));
      },
      // Si el branding no responde se deja pasar: puede ser un fallo puntual de
      // red y bloquear la app entera seria peor que mostrar una pantalla vacia.
      error: () => resolve(true)
    });
  });
};
