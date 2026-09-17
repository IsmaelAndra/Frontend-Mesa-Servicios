import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SettingsPasswordComponent } from './password.component';
import { AuthService } from '../../../core/services/auth.service';

describe('SettingsPasswordComponent', () => {
  let component: SettingsPasswordComponent;
  let fixture: ComponentFixture<SettingsPasswordComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [SettingsPasswordComponent],
      providers: [
        { provide: AuthService, useValue: { changePassword: jasmine.createSpy('changePassword') } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } }
      ]
    });
    fixture = TestBed.createComponent(SettingsPasswordComponent);
    component = fixture.componentInstance;
  });

  it('password vacía => 0% de fortaleza, "Muy débil"', () => {
    component.newPassword = '';
    expect(component.strengthPercent).toBe(0);
    expect(component.strengthLabel).toBe('Muy débil');
  });

  it('password larga con mayúsc/minúsc/num/símbolo => 100%', () => {
    component.newPassword = 'Abcdef12!x';
    expect(component.strengthPercent).toBe(100);
    expect(component.strengthLabel).toBe('Muy fuerte');
  });

  it('password corta no alcanza el máximo', () => {
    component.newPassword = 'Ab1!';
    expect(component.strengthPercent).toBeLessThan(100);
  });

  it('asigna colores por nivel', () => {
    component.newPassword = 'abc';
    expect(component.strengthColor).toBe('bg-error');
    component.newPassword = 'Abcdef12!x';
    expect(component.strengthColor).toBe('bg-success');
  });
});