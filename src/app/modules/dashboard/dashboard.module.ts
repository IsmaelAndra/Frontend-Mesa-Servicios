import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgChartsModule } from 'ng2-charts';
import { DashboardComponent } from './dashboard.component';
import { SharedModule } from '../shared/shared.module';
import { ContadorDirective } from './contador/contador.directive';

/** Rutas del inicio; se carga en diferido con Chart.js (fuera del paquete inicial). */
export const DASHBOARD_ROUTES: Routes = [{ path: '', component: DashboardComponent }];

@NgModule({
  declarations: [DashboardComponent],
  imports: [SharedModule, FormsModule, NgChartsModule, ContadorDirective, RouterModule.forChild(DASHBOARD_ROUTES)],
  exports: [DashboardComponent]
})
export class DashboardModule {}