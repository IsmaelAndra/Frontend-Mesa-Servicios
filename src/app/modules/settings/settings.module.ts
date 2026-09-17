import { NgModule } from '@angular/core';
import { SettingsProfileComponent } from './profile/profile.component';
import { SettingsPasswordComponent } from './password/password.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [SettingsProfileComponent, SettingsPasswordComponent],
  imports: [SharedModule],
  exports: [SettingsProfileComponent, SettingsPasswordComponent]
})
export class SettingsModule {}