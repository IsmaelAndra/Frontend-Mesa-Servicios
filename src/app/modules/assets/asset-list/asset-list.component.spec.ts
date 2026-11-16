import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AssetListComponent } from './asset-list.component';
import { AssetService } from '../../../core/services/asset.service';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { Asset } from '../../../models/asset.model';

describe('AssetListComponent', () => {
  /** gestiona: permiso de activos del servidor (Tecnología, Desarrollo, súper admin). */
  function setup(role: string, gestiona: boolean, assets: Asset[] = [], falla = false) {
    const assetService = jasmine.createSpyObj('AssetService', ['search', 'tipos', 'etiquetas']);
    assetService.tipos.and.returnValue(of([]));
    if (falla) {
      assetService.search.and.returnValue(throwError(() => new Error('boom')));
    } else {
      assetService.search.and.returnValue(
        of({ content: assets, totalElements: assets.length, totalPages: 1, size: 10, number: 0 })
      );
    }

    const auth = jasmine.createSpyObj('AuthService', ['getRole', 'gestionaActivos', 'permisosCargados']);
    auth.permisosCargados.and.returnValue(of(undefined));
    auth.getRole.and.returnValue(role);
    auth.gestionaActivos.and.returnValue(gestiona);

    const adminService = jasmine.createSpyObj('AdminService', ['catalog']);
    adminService.catalog.and.returnValue(of({ areas: [], categories: [], priorities: [], statuses: [], sucursales: [] }));
    const toastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'warn']);
    const router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      declarations: [AssetListComponent],
      providers: [
        { provide: AssetService, useValue: assetService },
        { provide: AuthService, useValue: auth },
        { provide: AdminService, useValue: adminService },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: router }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    const fixture: ComponentFixture<AssetListComponent> = TestBed.createComponent(AssetListComponent);
    return { fixture, assetService, toastService, router };
  }

  const activo = (id: string, asignado: string | null = null): Asset => ({
    idAsset: id, codeAsset: id, nameAsset: id, typeAsset: 'LAPTOP', statusAsset: asignado ? 'ASIGNADO' : 'EN_BODEGA',
    assignedUserId: asignado, createdAtAsset: '', updatedAtAsset: ''
  });

  it('carga los activos al inicializar', () => {
    const { fixture, assetService } = setup('AGENT', true);
    fixture.detectChanges();
    expect(assetService.search).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.loading).toBeFalse();
  });

  it('quien no gestiona ni audita va a Mis equipos', () => {
    const { fixture, assetService, router } = setup('USER', false);
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/activos/mis-equipos'], { replaceUrl: true });
    expect(assetService.search).not.toHaveBeenCalled();
  });

  it('el auditor ve el inventario pero no gestiona', () => {
    const { fixture, router } = setup('AUDITOR', false);
    fixture.detectChanges();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.puedeGestionar).toBeFalse();
  });

  it('cambiar un filtro vuelve a la primera página y consulta', () => {
    const { fixture, assetService } = setup('SUPER_ADMIN', true);
    fixture.detectChanges();
    assetService.search.calls.reset();
    fixture.componentInstance.page = 3;
    fixture.componentInstance.status = 'ASIGNADO';
    fixture.componentInstance.onFilterChange();
    const args = assetService.search.calls.mostRecent().args[0];
    expect(args.page).toBe(0);
    expect(args.status).toBe('ASIGNADO');
  });

  it('limpiar filtros deja los campos vacíos', () => {
    const { fixture } = setup('SUPER_ADMIN', true);
    fixture.detectChanges();
    fixture.componentInstance.keyword = 'x';
    fixture.componentInstance.status = 'BAJA';
    fixture.componentInstance.type = 'LAPTOP';
    fixture.componentInstance.clearFilters();
    expect(fixture.componentInstance.hasFilters).toBeFalse();
  });

  it('un fallo de red deja de cargar y avisa', () => {
    const { fixture, toastService } = setup('SUPER_ADMIN', true, [], true);
    fixture.detectChanges();
    expect(fixture.componentInstance.loading).toBeFalse();
    expect(toastService.error).toHaveBeenCalled();
  });

  it('sin persona el estado es "En bodega" (también el DISPONIBLE antiguo)', () => {
    const c = setup('SUPER_ADMIN', true).fixture.componentInstance;
    expect(c.estado('EN_BODEGA').etiqueta).toBe('En bodega');
    expect(c.estado('DISPONIBLE').etiqueta).toBe('En bodega');
    expect(c.estado('BAJA').etiqueta).toBe('Dado de baja');
  });

  it('solo se entregan juntos los equipos en bodega', () => {
    const { fixture } = setup('SUPER_ADMIN', true, [activo('a'), activo('b', 'u1')]);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    const ev = new Event('change');
    c.alternar(c.assets[0], ev);
    expect(c.todosEnBodega).toBeTrue();
    c.alternar(c.assets[1], ev);
    expect(c.todosEnBodega).toBeFalse();
    c.entregarSeleccion();
    expect(c.actaTipo).toBe('ENTREGA');
    expect(c.actaActivos.length).toBe(2);
  });
});
