import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { MantenimientoComponent } from './mantenimiento/mantenimiento.component';
import { PrivacyComponent } from './privacy/privacy.component';
import { MfaVerifyComponent } from './mfa-verify/mfa-verify.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
    declarations: [
      LoginComponent,
      RegisterComponent,
      MantenimientoComponent,
      PrivacyComponent,
      ResetPasswordComponent,
      MfaVerifyComponent,
    ],
    imports: [CommonModule, FormsModule, ReactiveFormsModule, SharedModule],
    exports: [LoginComponent, RegisterComponent, MantenimientoComponent, PrivacyComponent]
  })
export class AuthModule {}