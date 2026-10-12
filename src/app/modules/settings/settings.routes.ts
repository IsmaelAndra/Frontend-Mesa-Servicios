import { Routes } from '@angular/router';
import { SettingsProfileComponent } from './profile/profile.component';
import { SettingsPasswordComponent } from './password/password.component';
import { SettingsSoundsComponent } from './sounds/sounds.component';

/** Rutas bajo /settings (el AuthGuard va en la ruta padre). */
export const SETTINGS_ROUTES: Routes = [
  // /settings a secas no tenia hoja: caia en ** y abria el 404. El
  // breadcrumb lo muestra como ruta intermedia, asi que redirige.
  { path: '', redirectTo: 'profile', pathMatch: 'full' },
  { path: 'profile', component: SettingsProfileComponent },
  { path: 'password', component: SettingsPasswordComponent },
  { path: 'sounds', component: SettingsSoundsComponent },
];
