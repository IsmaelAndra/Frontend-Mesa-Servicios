import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly KEY = 'theme';
  private current: ThemeMode = 'system';
  private resolved: ResolvedTheme = 'light';
  private subject = new BehaviorSubject<ResolvedTheme>('light');

  constructor() {
    const saved = localStorage.getItem(this.KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      this.current = saved;
    }
    this.apply();
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
          if (this.current === 'system') this.apply();
        });
    }
  }

  get theme(): Observable<ResolvedTheme> {
    return this.subject.asObservable();
  }

  get mode(): ThemeMode {
    return this.current;
  }

  toggle(): void {
    this.setMode(this.resolved === 'dark' ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    this.current = mode;
    localStorage.setItem(this.KEY, mode);
    this.apply();
  }

  private apply(): void {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = this.current === 'dark' || (this.current === 'system' && prefersDark);
    this.resolved = dark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.resolved);
    this.subject.next(this.resolved);
  }
}