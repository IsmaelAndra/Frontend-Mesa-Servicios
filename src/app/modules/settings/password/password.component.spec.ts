import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SettingsPasswordComponent } from './password.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

/**
 * El componente se reescribió con signals: `newPassword` dejó de ser una
 * propiedad asignable para pasar a ser `signal("")`, y la fuerza se expone en
 * un único `strength` computed ({percent,label,colorClass,textClass}) en vez de
 * tres propiedades sueltas. Este spec se había quedado apuntando a la API
 * anterior, así que `npm test` no compilaba y era la única red de seguridad del
 * proyecto en rojo.
 */
describe('SettingsPasswordComponent', () => {
  let component: SettingsPasswordComponent;
  let fixture: ComponentFixture<SettingsPasswordComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [SettingsPasswordComponent],
      providers: [
        {
          provide: AuthService,
          useValue: { changePassword: jasmine.createSpy('changePassword') }
        },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        {
          provide: ToastService,
          useValue: {
            success: jasmine.createSpy('success'),
            error: jasmine.createSpy('error'),
            info: jasmine.createSpy('info'),
            warning: jasmine.createSpy('warning')
          }
        }
      ]
    });
    fixture = TestBed.createComponent(SettingsPasswordComponent);
    component = fixture.componentInstance;
  });

  it('crea el componente', () => {
    expect(component).toBeTruthy();
  });

  it('password vacía => 0% y sin etiqueta (el medidor se oculta hasta que se escribe)', () => {
    component.newPassword.set('');
    expect(component.strength().percent).toBe(0);
    // La etiqueta va vacía a propósito: con el campo en blanco no se muestra
    // ninguna barra, y poner "Muy débil" sería mentir sobre lo que se ve.
    expect(component.strength().label).toBe('');
  });

  it('con un solo carácter ya muestra "Muy débil"', () => {
    component.newPassword.set('a');
    expect(component.strength().percent).toBe(0);
    expect(component.strength().label).toBe('Muy débil');
  });

  it('password larga con mayúsc/minúsc/num/símbolo => 100%', () => {
    component.newPassword.set('Abcdef12!x');
    expect(component.strength().percent).toBe(100);
    expect(component.strength().label).toBe('Muy fuerte');
  });

  it('password corta no alcanza el máximo', () => {
    component.newPassword.set('Ab1!');
    expect(component.strength().percent).toBeLessThan(100);
  });

  it('asigna colores por nivel', () => {
    component.newPassword.set('abc');
    expect(component.strength().colorClass).toBe('bg-error');
    component.newPassword.set('Abcdef12!x');
    expect(component.strength().colorClass).toBe('bg-success');
  });

  it('no deja enviar si las contraseñas no coinciden', () => {
    component.currentPassword.set('Vieja123!');
    component.newPassword.set('Nueva123!');
    component.confirmPassword.set('OtraCosa1!');
    expect(component.passwordsMatch()).toBe(false);
    expect(component.canSubmit()).toBe(false);
  });

  it('no deja enviar si falta la contraseña actual', () => {
    component.newPassword.set('Nueva123!');
    component.confirmPassword.set('Nueva123!');
    expect(component.canSubmit()).toBe(false);
  });

  it('no deja enviar si la nueva es igual a la actual', () => {
    component.currentPassword.set('Igual123!');
    component.newPassword.set('Igual123!');
    component.confirmPassword.set('Igual123!');
    expect(component.isNewPasswordDifferent()).toBe(false);
    expect(component.canSubmit()).toBe(false);
  });

  it('permite enviar con los tres campos correctos y distintos', () => {
    component.currentPassword.set('Vieja123!');
    component.newPassword.set('Nueva456!');
    component.confirmPassword.set('Nueva456!');
    expect(component.canSubmit()).toBe(true);
  });
});
