import { Routes } from '@angular/router';
import { AuthGuard } from '../../core/guards/auth.guard';
import { RoleGuard } from '../../core/guards/role.guard';
import { AssetListComponent } from './asset-list/asset-list.component';
import { AssetFormComponent } from './asset-form/asset-form.component';
import { AssetDetailComponent } from './asset-detail/asset-detail.component';
import { MisEquiposComponent } from './mis-equipos/mis-equipos.component';
import { ActasComponent } from './actas/actas.component';
import { ConfiguracionActivosComponent } from './configuracion/configuracion-activos.component';

/**
 * Rutas bajo /activos. Gestionan Tecnología y Desarrollo (y el súper admin); eso
 * lo decide el servidor (el área no sale del rol), así que las guardas solo
 * dejan fuera a quien nunca podría entrar y cada pantalla esconde lo demás.
 */
const PERSONAL = ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'AUDITOR'];

export const ASSETS_ROUTES: Routes = [
  { path: '', component: AssetListComponent, canActivate: [AuthGuard] },
  { path: 'mis-equipos', component: MisEquiposComponent, canActivate: [AuthGuard] },
  { path: 'actas', component: ActasComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: PERSONAL } },
  // Maestros de activos (en el menú de Administración): tipos y numeración juntos.
  // Solo el súper admin y los jefes (de Tecnología/Desarrollo: lo exige el backend); los agentes no.
  { path: 'configuracion', component: ConfiguracionActivosComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'AREA_MANAGER'] } },
  { path: 'tipos', redirectTo: 'configuracion' },
  { path: 'nuevo', component: AssetFormComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: PERSONAL } },
  { path: 'new', redirectTo: 'nuevo' },
  { path: ':id/editar', component: AssetFormComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: PERSONAL } },
  { path: ':id', component: AssetDetailComponent, canActivate: [AuthGuard] },
];
