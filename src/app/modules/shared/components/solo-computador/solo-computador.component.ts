import { Component } from '@angular/core';
import { NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

/** Aviso en el teléfono para las pantallas que solo se usan desde un computador. */
@Component({
  selector: 'app-solo-computador',
  standalone: true,
  imports: [NgIf, RouterLink],
  template: `
    <div class="min-h-[60vh] flex items-center justify-center">
      <div class="card bg-base-100 border border-base-200 shadow-sm max-w-md w-full">
        <div class="card-body items-center text-center gap-3">
          <span class="p-4 rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
            <i class="fa-solid fa-desktop text-3xl"></i>
          </span>
          <h1 class="text-xl font-bold">Disponible en el computador</h1>
          <p class="text-sm opacity-75">
            Esta pantalla tiene editores y configuraciones que necesitan una pantalla grande.
            Ábrala desde un computador; desde el teléfono puede seguir con tickets, actividades,
            proyectos, aprobaciones y sus equipos.
          </p>
          <p *ngIf="desde" class="text-xs font-mono opacity-60 break-all">{{ desde }}</p>
          <a routerLink="/inicio" class="btn btn-primary btn-sm text-white gap-2">
            <i class="fa-solid fa-house" aria-hidden="true"></i> Ir al inicio
          </a>
        </div>
      </div>
    </div>
  `,
})
export class SoloComputadorComponent {
  desde: string | null;

  constructor(route: ActivatedRoute) {
    this.desde = route.snapshot.queryParamMap.get('desde');
  }
}
