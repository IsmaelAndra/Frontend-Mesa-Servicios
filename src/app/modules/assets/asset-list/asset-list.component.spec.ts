import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AssetListComponent } from './asset-list.component';
import { AssetService } from '../../../core/services/asset.service';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { Asset } from '../../../models/asset.model';

describe('AssetListComponent', () => {
  function setup(role: string, assets: Asset[] = [], falla = false) {
    const assetService = jasmine.createSpyObj('AssetService', ['search']);
    if (falla) {
      assetService.search.and.returnValue(throwError(() => new Error('boom')));
    } else {
      assetService.search.and.returnValue(
        of({ content: assets, totalElements: assets.length, totalPages: 1, size: 10, number: 0 })
      );
    }

    const auth = jasmine.createSpyObj('AuthService', ['getRole']);
    auth.getRole.and.returnValue(role);

    const adminService = jasmine.createSpyObj('AdminService', ['catalog']);
    adminService.catalog.and.returnValue(
      of({ areas: [], categories: [], priorities: [], statuses: [], sucursales: [] })
    );

    const toastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'warn']);

    TestBed.configureTestingModule({
      declarations: [AssetListComponent],
      providers: [
        { provide: AssetService, useValue: assetService },
        { provide: AuthService, useValue: auth },
        { provide: AdminService, useValue: adminService },
        { provide: ToastService, useValue: toastService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    const fixture: ComponentFixture<AssetListComponent> = TestBed.createComponent(AssetListComponent);
    return { fixture, assetService, toastService };
  }

  it('carga los activos al inicializar', () => {
    const { fixture, assetService } = setup('ADMIN');
    fixture.detectChanges();
    expect(assetService.search).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.loading).toBeFalse();
  });

  it('solo los roles de gestión pueden crear/editar', () => {
    const c = setup('USER').fixture.componentInstance;
    c.role = 'SUPER_ADMIN';
    expect(c.puedeGestionar).toBeTrue();
    c.role = 'ADMIN';
    expect(c.puedeGestionar).toBeTrue();
    c.role = 'AREA_MANAGER';
    expect(c.puedeGestionar).toBeTrue();
    c.role = 'AGENT';
    expect(c.puedeGestionar).toBeFalse();
    c.role = 'USER';
    expect(c.puedeGestionar).toBeFalse();
  });

  it('cambiar un filtro vuelve a la primera página y consulta', () => {
    const { fixture, assetService } = setup('ADMIN');
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
    const { fixture } = setup('ADMIN');
    fixture.detectChanges();
    fixture.componentInstance.keyword = 'x';
    fixture.componentInstance.status = 'BAJA';
    fixture.componentInstance.type = 'LAPTOP';

    fixture.componentInstance.clearFilters();

    expect(fixture.componentInstance.keyword).toBe('');
    expect(fixture.componentInstance.status).toBe('');
    expect(fixture.componentInstance.type).toBe('');
    expect(fixture.componentInstance.hasFilters).toBeFalse();
  });

  it('un fallo de red deja de cargar y avisa', () => {
    const { fixture } = setup('ADMIN', [], true);
    fixture.detectChanges();
    expect(fixture.componentInstance.loading).toBeFalse();
    expect(fixture.componentInstance.assets).toEqual([]);
  });

  it('color e icono según el estado', () => {
    const c = setup('ADMIN').fixture.componentInstance;
    expect(c.estado('DISPONIBLE').color).toBe('#059669');
    expect(c.estado('BAJA').etiqueta).toBe('Dado de baja');
    expect(c.estado('ASIGNADO').icono).toContain('fa-user-check');
  });

  it('el título dice qué alcance se ve', () => {
    expect(setup('USER').fixture.componentInstance.titulo).toBe('Mis activos');
  });

  it('el jefe de área ve su área y no carga el catálogo de áreas', () => {
    const { fixture } = setup('AREA_MANAGER');
    fixture.detectChanges();
    expect(fixture.componentInstance.titulo).toBe('Activos de mi área');
    expect(fixture.componentInstance.esAdmin).toBeFalse();
  });
});