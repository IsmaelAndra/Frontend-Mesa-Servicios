import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';

import { GlobalSearchComponent } from './global-search.component';
import { GlobalSearchService } from '../../../../core/services/global-search.service';
import { GlobalSearchResponse } from '../../../../models/search.model';
import { fakeAsync, tick } from '@angular/core/testing';

const RESPUESTA: GlobalSearchResponse = {
  query: 'impresora',
  tickets: [
    { idTicket: '5', titleTicket: 'Impresora', status: 'NUEVO', priority: 'ALTA' },
  ],
  agents: [],
  users: [],
  teams: [],
  areas: [],
  workflows: [],
  assets: [],
};

describe('GlobalSearchComponent', () => {
  let fixture: ComponentFixture<GlobalSearchComponent>;
  let comp: GlobalSearchComponent;
  let router: jasmine.SpyObj<Router>;
  let globalSearch: jasmine.SpyObj<GlobalSearchService>;
  let openSubject: Subject<void>;
  /** `url` de Router es un getter de solo lectura: se controla por separado. */
  let urlActual = '/dashboard';

  beforeEach(() => {
    openSubject = new Subject<void>();
    urlActual = '/dashboard';
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    Object.defineProperty(router, 'url', {
      get: () => urlActual,
      configurable: true,
      enumerable: true,
    });
    globalSearch = jasmine.createSpyObj('GlobalSearchService', ['buscar', 'open']);
    Object.defineProperty(globalSearch, 'open$', {
      get: () => openSubject.asObservable(),
    });
    globalSearch.buscar.and.returnValue(of(RESPUESTA));

    TestBed.configureTestingModule({
      declarations: [GlobalSearchComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: GlobalSearchService, useValue: globalSearch },
      ],
    });
    fixture = TestBed.createComponent(GlobalSearchComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  function escribir(termino: string): void {
    comp.onTermino({ target: { value: termino } } as unknown as Event);
  }

  function abrirYBuscar(termino: string): void {
    openSubject.next();
    escribir(termino);
    tick(400);
    fixture.detectChanges();
  }

  it('Ctrl+K abre y vuelve a cerrar el modal', () => {
    expect(comp.abierto).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    expect(comp.abierto).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    expect(comp.abierto).toBe(false);
  });

  it('Ctrl+K no abre en las rutas de autenticación', () => {
    urlActual = '/auth/login';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    expect(comp.abierto).toBe(false);
  });

  it('se abre cuando la lupa del navbar lo pide', () => {
    openSubject.next();
    expect(comp.abierto).toBe(true);
  });

  it('con menos de dos caracteres no consulta y muestra la pista', fakeAsync(() => {
    openSubject.next();
    escribir('a');
    tick(400);
    fixture.detectChanges();
    expect(globalSearch.buscar).not.toHaveBeenCalled();
    expect(comp.respuesta).toBeNull();
    expect(fixture.debugElement.query(By.css('.fa-keyboard'))).not.toBeNull();
  }));

  it('consulta tras el antirrebote y pinta las filas del grupo', fakeAsync(() => {
    abrirYBuscar('impresora');
    expect(globalSearch.buscar).toHaveBeenCalledWith('impresora');
    expect(fixture.debugElement.queryAll(By.css('[data-search-row]')).length).toBe(1);
  }));

  it('abrir un ticket navega a su detalle y cierra el modal', fakeAsync(() => {
    abrirYBuscar('impresora');
    const fila = fixture.debugElement.query(By.css('[data-search-row]')).nativeElement as HTMLButtonElement;
    fila.click();
    expect(router.navigate).toHaveBeenCalledWith(['/tickets', '5']);
    expect(comp.abierto).toBe(false);
  }));

  it('abrir un agente lleva a la gestión con su correo como término', fakeAsync(() => {
    globalSearch.buscar.and.returnValue(
      of({
        ...RESPUESTA,
        tickets: [],
        agents: [
          { idUser: '10', displayName: 'Ana Lopez', corporateEmailUser: 'ana@coac.local', role: 'AGENT' },
        ],
      }),
    );
    abrirYBuscar('ana');
    const fila = fixture.debugElement.query(By.css('[data-search-row]')).nativeElement as HTMLButtonElement;
    fila.click();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/users'], {
      queryParams: { search: 'ana@coac.local' },
    });
  }));

  it('Ver todos de tickets lleva al listado con el término aplicado', fakeAsync(() => {
    abrirYBuscar('impresora');
    const verTodos = fixture.debugElement
      .queryAll(By.css('button'))
      .find((b) => b.nativeElement.textContent?.includes('Ver todos'));
    verTodos?.nativeElement.click();
    expect(router.navigate).toHaveBeenCalledWith(['/tickets'], {
      queryParams: { keyword: 'impresora' },
    });
  }));

  it('flecha abajo y Enter abren la fila seleccionada', fakeAsync(() => {
    abrirYBuscar('impresora');
    comp.onInputKeydown({ key: 'ArrowDown', preventDefault: () => undefined } as unknown as KeyboardEvent);
    expect(comp.indiceSeleccionado).toBe(0);
    comp.onInputKeydown({ key: 'Enter', preventDefault: () => undefined } as unknown as KeyboardEvent);
    expect(router.navigate).toHaveBeenCalledWith(['/tickets', '5']);
  }));

  it('Escape cierra el modal', fakeAsync(() => {
    openSubject.next();
    tick();
    comp.onInputKeydown({ key: 'Escape', preventDefault: () => undefined } as unknown as KeyboardEvent);
    expect(comp.abierto).toBe(false);
  }));

  it('abrir un activo navega a su ficha y "Ver todos" al inventario', fakeAsync(() => {
    globalSearch.buscar.and.returnValue(
      of({
        query: 'lap',
        tickets: [],
        agents: [],
        users: [],
        teams: [],
        areas: [],
        workflows: [],
        assets: [
          {
            idAsset: 'a1',
            codeAsset: 'TI-LAP-001',
            nameAsset: 'Laptop Dell',
            typeAsset: 'LAPTOP',
            statusAsset: 'ASIGNADO',
            assignedUserName: 'Ana',
            area: 'TI',
          },
        ],
      }),
    );
    abrirYBuscar('lap');
    const fila = fixture.debugElement.query(By.css('[data-search-row]')).nativeElement as HTMLButtonElement;
    fila.click();
    expect(router.navigate).toHaveBeenCalledWith(['/activos', 'a1']);
  }));

  it('un grupo vacío no pinta cabecera', fakeAsync(() => {
    abrirYBuscar('impresora');
    const cabeceras = fixture.debugElement.queryAll(By.css('.uppercase')).map((d) =>
      d.nativeElement.textContent?.trim(),
    );
    // Solo la cabecera de tickets; no deben existir "Agentes" ni "Usuarios".
    expect(cabeceras).toEqual(['Tickets']);
  }));
});