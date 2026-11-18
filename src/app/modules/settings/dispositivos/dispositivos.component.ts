import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import { SseService } from '../../../core/services/sse.service';

import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { confirmar } from '../../../core/utils/confirmar.util';

/** Un dispositivo con sesión abierta (GET /auth/sesiones). */
export interface SesionDispositivo {
  id: string;
  dispositivo: string;
  ip: string | null;
  inicio: string;
  ultimoUso: string;
  actual: boolean;
}

/**
 * "Dispositivos con sesión abierta", como en las apps de mensajería: dónde
 * está abierta la cuenta y un botón para cerrar cada sesión o todas las demás.
 * Las peticiones llevan withCredentials: la cookie del refresh es la que dice
 * cuál es este dispositivo.
 */
@Component({
  selector: 'app-settings-dispositivos',
  templateUrl: './dispositivos.component.html',
})
export class SettingsDispositivosComponent implements OnInit, OnDestroy {
  private cambioSub?: Subscription;
  sesiones: SesionDispositivo[] = [];
  cargando = true;
  /** Id de la sesión que se está cerrando, 'todas' o null. */
  cerrando: string | null = null;
  private readonly url = `${environment.apiUrl}/auth/sesiones`;

  constructor(private http: HttpClient, private auth: AuthService, private toast: ToastService,
              private sse: SseService) {}

  ngOnInit(): void {
    this.cargar();
    // Un inicio de sesión en otro equipo, o una sesión cerrada, se ve sin recargar.
    this.cambioSub = this.sse.cambio$.pipe(filter((c) => c.tipo === 'sesiones'), debounceTime(600))
      .subscribe(() => this.cargar(false));
  }

  ngOnDestroy(): void {
    this.cambioSub?.unsubscribe();
  }

  /** La IP del propio servidor (pruebas en el mismo equipo) se muestra con nombre. */
  ip(s: SesionDispositivo): string | null {
    if (!s.ip) return null;
    return ['0:0:0:0:0:0:0:1', '::1', '127.0.0.1'].includes(s.ip) ? 'Este mismo equipo' : s.ip;
  }

  get otras(): number {
    return this.sesiones.filter((s) => !s.actual).length;
  }

  cargar(conSpinner = true): void {
    this.cargando = conSpinner;
    this.http.get<SesionDispositivo[]>(this.url, { withCredentials: true }).subscribe({
      next: (l) => { this.sesiones = l || []; this.cargando = false; },
      error: () => { this.cargando = false; this.toast.error('No se pudieron cargar los dispositivos'); },
    });
  }

  /** Teléfono, tableta o computador, según el nombre del dispositivo. */
  icono(s: SesionDispositivo): string {
    const d = s.dispositivo || '';
    if (/iPhone|Android/.test(d)) return 'fa-solid fa-mobile-screen';
    if (/iPad/.test(d)) return 'fa-solid fa-tablet-screen-button';
    return 'fa-solid fa-laptop';
  }

  trackSesion(_: number, s: SesionDispositivo): string {
    return s.id;
  }

  async cerrar(s: SesionDispositivo): Promise<void> {
    const ok = await confirmar({
      titulo: s.actual ? '¿Cerrar la sesión aquí?' : '¿Cerrar la sesión en ese dispositivo?',
      texto: `${s.dispositivo}${this.ip(s) ? ' · ' + this.ip(s) : ''}. Tendrá que volver a iniciar sesión en él.`,
      accion: 'Cerrar sesión',
    });
    if (!ok) return;
    if (s.actual) {
      this.auth.logout();
      return;
    }
    this.cerrando = s.id;
    this.http.delete<void>(`${this.url}/${s.id}`, { withCredentials: true }).subscribe({
      next: () => {
        this.cerrando = null;
        this.toast.success('Se cerró la sesión en ese dispositivo');
        this.sesiones = this.sesiones.filter((x) => x.id !== s.id);
      },
      error: (e) => {
        this.cerrando = null;
        this.toast.error(e?.error?.message || 'No se pudo cerrar la sesión');
        this.cargar();
      },
    });
  }

  async cerrarLasDemas(): Promise<void> {
    const n = this.otras;
    const ok = await confirmar({
      titulo: '¿Cerrar la sesión en los demás dispositivos?',
      texto: `Se cerrará en ${n} ${n === 1 ? 'dispositivo' : 'dispositivos'}. Este seguirá abierto.`,
      accion: 'Cerrar las demás',
    });
    if (!ok) return;
    this.cerrando = 'todas';
    this.http.post<{ cerradas: number }>(`${this.url}/cerrar-las-demas`, {}, { withCredentials: true }).subscribe({
      next: () => {
        this.cerrando = null;
        this.toast.success('Se cerró la sesión en los demás dispositivos');
        this.sesiones = this.sesiones.filter((x) => x.actual);
      },
      error: (e) => {
        this.cerrando = null;
        this.toast.error(e?.error?.message || 'No se pudieron cerrar las sesiones');
      },
    });
  }
}
