import { NgModule } from '@angular/core';
import { ReportsComponent } from './reports.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [ReportsComponent],
  imports: [SharedModule],
  exports: [ReportsComponent]
})
export class ReportsModule {}