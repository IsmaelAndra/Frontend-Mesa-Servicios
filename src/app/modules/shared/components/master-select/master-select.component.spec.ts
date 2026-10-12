import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';

import { MasterOption, MasterSelectComponent } from './master-select.component';

@Component({
  standalone: false,
  template: `<app-master-select
    [formControl]="control"
    [options]="opciones"
    [allowEmpty]="true"
    emptyLabel="Sin especificar"
    label="Prioridad"
  ></app-master-select>`
})
class HostComponent {
  control = new FormControl<number | null>(null);
  opciones: MasterOption[] = [
    { value: 1, label: 'CRITICA', icon: 'fa-solid fa-bolt', color: '#DC2626' },
    { value: 2, label: 'ALTA', icon: 'fa-solid fa-arrow-up', color: '#EA580C' },
    { value: 3, label: 'BAJA', icon: 'fa-solid fa-arrow-down', color: '#2563EB' }
  ];
}

describe('MasterSelectComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MasterSelectComponent, HostComponent],
      imports: [ReactiveFormsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** Filas de la lista desplegable, tal como las ve el usuario. */
  function filas(): HTMLElement[] {
    return fixture.debugElement.queryAll(By.css('[role="option"]')).map(d => d.nativeElement);
  }

  function disparador(): HTMLButtonElement {
    return fixture.debugElement.query(By.css('button[role="combobox"]')).nativeElement;
  }

  it('abre la lista al pulsar el boton', () => {
    expect(filas().length).toBe(0);

    disparador().click();
    fixture.detectChanges();

    // Tres maestros mas la fila "Sin especificar".
    expect(filas().length).toBe(4);
  });

  it('al pulsar una opcion se actualiza el formControl', () => {
    disparador().click();
    fixture.detectChanges();

    // Con allowEmpty la fila 0 es "Sin especificar"; la 1 es CRITICA.
    filas()[1].click();
    fixture.detectChanges();

    expect(host.control.value).toBe(1);
    // La lista se cierra tras elegir.
    expect(filas().length).toBe(0);
  });

  it('muestra en el boton la etiqueta del valor elegido', () => {
    disparador().click();
    fixture.detectChanges();
    filas()[1].click();
    fixture.detectChanges();

    expect(disparador().textContent).toContain('CRITICA');
  });

  it('la opcion vacia deja el control en null', () => {
    host.control.setValue(1);
    fixture.detectChanges();

    disparador().click();
    fixture.detectChanges();
    // La primera fila es la vacia.
    filas()[0].click();
    fixture.detectChanges();

    expect(host.control.value).toBeNull();
  });

  it('navega con el teclado y elige con Enter', () => {
    disparador().click();
    fixture.detectChanges();
    disparador().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    disparador().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    // Se abre resaltando la fila vacia y la primera flecha la salta.
    expect(host.control.value).toBe(1);
  });

  it('las filas no se recrean al mover el raton', () => {
    disparador().click();
    fixture.detectChanges();

    const antes = filas();
    const nodo = antes[1];
    // Un mouseenter dispara la deteccion de cambios a traves del enlace del
    // componente. Si las filas se reconstruyeran, el nodo debajo del cursor
    // cambiaria y el clic posterior no llegaria.
    nodo.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    fixture.detectChanges();

    expect(filas()[1]).toBe(nodo);
  });

  it('pinta el icono y el color del maestro en la fila', () => {
    disparador().click();
    fixture.detectChanges();

    const icono = filas()[1].querySelector('i');
    expect(icono).toBeTruthy();
    expect(icono?.className).toContain('fa-bolt');
    expect((icono as HTMLElement).style.color).toBe('rgb(220, 38, 38)');
  });

  it('se cierra al pulsar fuera y se abre al pulsar el boton', () => {
    disparador().click();
    fixture.detectChanges();
    expect(filas().length).toBe(4);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(filas().length).toBe(0);

    // Y volver a pulsar el boton la reabre.
    disparador().click();
    fixture.detectChanges();
    expect(filas().length).toBe(4);
  });

  it('rebuilds las filas cuando el catalogo llega asincrono', () => {
    // El catalogo se pide al backend, asi que las opciones llegan despues de
    // que el componente ya esta en pantalla.
    host.opciones = [];
    fixture.detectChanges();
    disparador().click();
    fixture.detectChanges();
    expect(filas().length).toBe(1);

    host.opciones = [
      { value: 7, label: 'UNICA', icon: 'fa-solid fa-star', color: '#7C3AED' }
    ];
    fixture.detectChanges();

    expect(filas().length).toBe(2);
    filas()[1].click();
    fixture.detectChanges();
    expect(host.control.value).toBe(7);
  });
});