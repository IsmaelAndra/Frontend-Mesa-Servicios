import { Routes } from '@angular/router';
import { ReportsComponent } from './reports.component';

/** Rutas bajo /reports (el guard de rol va en la ruta padre). */
export const REPORTS_ROUTES: Routes = [{ path: '', component: ReportsComponent }];
