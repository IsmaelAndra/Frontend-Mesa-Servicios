import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, throwError } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../environments/environment';
import { AuthRequest, AuthResponse, RegisterRequest, User } from '../../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'mesa_ayuda_token';
  private readonly REFRESH_KEY = 'mesa_ayuda_refresh';
  private readonly PWD_FLAG_KEY = 'mesa_ayuda_must_change';
  private readonly jwtHelper = new JwtHelperService();
  private currentUser = new BehaviorSubject<User | null>(null);

  constructor(private http: HttpClient) {
    this.loadFromStorage();
  }

  login(credentials: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, credentials)
      .pipe(tap((res) => this.storeSession(res)));
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, data)
      .pipe(tap((res) => this.storeSession(res)));
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/forgot-password`, { email });
  }

  me(): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/users/me`);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/change-password`, { currentPassword, newPassword });
  }

  refreshSession(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('Sin refresh token'));
    }
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(tap((res) => this.storeSession(res)));
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      this.http.post(`${environment.apiUrl}/auth/logout`, { refreshToken }).subscribe();
    }
    this.clearSession();
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_KEY);
  }

  mustChangePassword(): boolean {
    if (!this.isAuthenticated()) return false;
    return localStorage.getItem(this.PWD_FLAG_KEY) === '1';
  }

  clearMustChangePassword(): void {
    localStorage.removeItem(this.PWD_FLAG_KEY);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token && !this.jwtHelper.isTokenExpired(token);
  }

  getRole(): string {
    const token = this.getToken();
    if (!token) return '';
    const decoded = this.jwtHelper.decodeToken(token) as { roles: string };
    return decoded?.roles?.replace('ROLE_', '') || '';
  }

  getEmail(): string {
    const token = this.getToken();
    if (!token) return '';
    const decoded = this.jwtHelper.decodeToken(token) as { email?: string; sub?: string };
    return decoded?.email || decoded?.sub || '';
  }

  get user$(): Observable<User | null> {
    return this.currentUser.asObservable();
  }

  private storeSession(res: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, res.token);
    localStorage.setItem(this.REFRESH_KEY, res.refreshToken);
    if (res.mustChangePassword) {
      localStorage.setItem(this.PWD_FLAG_KEY, '1');
    } else {
      localStorage.removeItem(this.PWD_FLAG_KEY);
    }
    this.currentUser.next({
      idUser: res.userId,
      identificationUser: '',
      corporateEmailUser: res.email,
      phoneUser: '',
      statusUser: 'ACTIVE',
      role: res.role,
      area: res.area,
      createdAtUser: new Date().toISOString()
    });
  }

  private clearSession(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.PWD_FLAG_KEY);
    this.currentUser.next(null);
  }

  private loadFromStorage(): void {
    if (this.isAuthenticated()) {
      this.me().subscribe({
        next: (u) => this.currentUser.next(u),
        error: () => this.logout()
      });
    }
  }
}