import { NgModule } from '@angular/core';
import { ReportsComponent } from './reports.component';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { REPORTS_ROUTES } from './reports.routes';

@NgModule({
  declarations: [ReportsComponent],
  imports: [SharedModule, RouterModule.forChild(REPORTS_ROUTES)],
  exports: [ReportsComponent]
})
export class ReportsModule {}