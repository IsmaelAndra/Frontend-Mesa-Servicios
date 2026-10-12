import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgChartsModule } from 'ng2-charts';
import { DashboardComponent } from './dashboard.component';
import { SharedModule } from '../shared/shared.module';
import { ContadorDirective } from './contador/contador.directive';

@NgModule({
  declarations: [DashboardComponent],
  imports: [SharedModule, FormsModule, NgChartsModule, ContadorDirective],
  exports: [DashboardComponent]
})
export class DashboardModule {}