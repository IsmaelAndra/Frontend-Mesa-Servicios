import { NgModule } from '@angular/core';
import { SettingsProfileComponent } from './profile/profile.component';
import { SettingsPasswordComponent } from './password/password.component';
import { SettingsSoundsComponent } from './sounds/sounds.component';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { SETTINGS_ROUTES } from './settings.routes';

@NgModule({
  declarations: [SettingsProfileComponent, SettingsPasswordComponent, SettingsSoundsComponent],
  imports: [SharedModule, RouterModule.forChild(SETTINGS_ROUTES)],
  exports: [SettingsProfileComponent, SettingsPasswordComponent, SettingsSoundsComponent]
})
export class SettingsModule {}