import { Routes } from '@angular/router';
import { SettingsProfileComponent } from './profile/profile.component';
import { SettingsPasswordComponent } from './password/password.component';
import { SettingsSoundsComponent } from './sounds/sounds.component';
import { SettingsDispositivosComponent } from './dispositivos/dispositivos.component';

/** Rutas bajo /settings (el AuthGuard va en la ruta padre). */
export const SETTINGS_ROUTES: Routes = [
  // /settings a secas no tenia hoja: caia en ** y abria el 404. El
  // breadcrumb lo muestra como ruta intermedia, asi que redirige.
  { path: '', redirectTo: 'perfil', pathMatch: 'full' },
  { path: 'perfil', component: SettingsProfileComponent },
  { path: 'contrasena', component: SettingsPasswordComponent },
  { path: 'sonidos', component: SettingsSoundsComponent },
  { path: 'dispositivos', component: SettingsDispositivosComponent },
];
