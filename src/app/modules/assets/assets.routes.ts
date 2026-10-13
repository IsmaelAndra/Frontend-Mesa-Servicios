import { Routes } from '@angular/router';
import { AuthGuard } from '../../core/guards/auth.guard';
import { RoleGuard } from '../../core/guards/role.guard';
import { AssetListComponent } from './asset-list/asset-list.component';
import { AssetFormComponent } from './asset-form/asset-form.component';
import { AssetDetailComponent } from './asset-detail/asset-detail.component';

/** Rutas bajo /activos. Se cargan bajo demanda (ver app-routing.module.ts). */
export const ASSETS_ROUTES: Routes = [
  { path: '', component: AssetListComponent, canActivate: [AuthGuard] },
  { path: 'new', component: AssetFormComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'AREA_MANAGER'] } },
  { path: ':id/editar', component: AssetFormComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'AREA_MANAGER'] } },
  { path: ':id', component: AssetDetailComponent, canActivate: [AuthGuard] },
];