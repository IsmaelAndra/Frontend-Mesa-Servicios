import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if (!this.authService.isAuthenticated()) {
      return this.router.createUrlTree(['/auth/login']);
    }
    if (this.authService.mustChangePassword() && !this.isPasswordChangeRoute(state)) {
      return this.router.createUrlTree(['/settings/password']);
    }
    return true;
  }

  private isPasswordChangeRoute(state: RouterStateSnapshot): boolean {
    const url = state?.url?.split('?')[0] ?? '';
    return url === '/settings/password' || url.includes('/settings/password');
  }
}