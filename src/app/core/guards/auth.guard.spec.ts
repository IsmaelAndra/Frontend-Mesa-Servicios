import { AuthGuard } from './auth.guard';
import { RouterStateSnapshot, UrlTree } from '@angular/router';

describe('AuthGuard', () => {
  let auth: any;
  let router: any;
  let guard: AuthGuard;

  const snapshot = (url: string) => ({ url } as unknown as RouterStateSnapshot);

  beforeEach(() => {
    auth = jasmine.createSpyObj('AuthService', ['isAuthenticated', 'mustChangePassword']);
    router = jasmine.createSpyObj('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue('REDIRECT' as any);
    guard = new AuthGuard(auth, router);
  });

  it('redirige a login si no está autenticado', () => {
    auth.isAuthenticated.and.returnValue(false);
    const result = guard.canActivate({} as any, snapshot('/dashboard'));
    expect(result).toBeTruthy();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth/login']);
  });

  it('deja pasar si está autenticado sin mustChangePassword', () => {
    auth.isAuthenticated.and.returnValue(true);
    auth.mustChangePassword.and.returnValue(false);
    expect(guard.canActivate({} as any, snapshot('/dashboard'))).toBe(true);
  });

  it('deja pasar si mustChangePassword y está en /settings/password (sin bucle)', () => {
    auth.isAuthenticated.and.returnValue(true);
    auth.mustChangePassword.and.returnValue(true);
    expect(guard.canActivate({} as any, snapshot('/settings/password'))).toBe(true);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirige a /settings/password si mustChangePassword en otra ruta', () => {
    auth.isAuthenticated.and.returnValue(true);
    auth.mustChangePassword.and.returnValue(true);
    const result = guard.canActivate({} as any, snapshot('/dashboard'));
    expect(result).toBeTruthy();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/settings/password']);
  });

  it('reconoce la url de la ruta hija de settings', () => {
    auth.isAuthenticated.and.returnValue(true);
    auth.mustChangePassword.and.returnValue(true);
    const result = guard.canActivate({} as any, snapshot('/settings/password?x=1'));
    expect(result).toBe(true);
  });
});