import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const allowed = route.data['roles'] as string[] | undefined;
    if (!allowed || allowed.includes(this.authService.getRole())) {
      return true;
    }
    return this.router.createUrlTree(['/dashboard']);
  }
}