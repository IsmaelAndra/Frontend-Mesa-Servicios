import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { AssetFormComponent } from './asset-form.component';
import { AssetService } from '../../../core/services/asset.service';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { Asset } from '../../../models/asset.model';
import { Catalog } from '../../../models/user.model';

describe('AssetFormComponent', () => {
  function setup(id: string | null, activo?: Asset, role = 'ADMIN') {
    const assetService = jasmine.createSpyObj('AssetService', ['getById', 'create', 'update', 'asignables']);
    assetService.asignables.and.returnValue(of([]));
    assetService.getById.and.returnValue(of(activo ?? ({} as Asset)));
    assetService.create.and.returnValue(of({ idAsset: 'nuevo' } as Asset));
    assetService.update.and.returnValue(of({ idAsset: id ?? '' } as Asset));

    const adminService = jasmine.createSpyObj('AdminService', ['catalog', 'users']);
    adminService.catalog.and.returnValue(
      of({ areas: [], categories: [], priorities: [], statuses: [], sucursales: [] })
    );
    adminService.users.and.returnValue(of([]));

    const toastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'warn']);
    const router = jasmine.createSpyObj('Router', ['navigate']);
    const auth = jasmine.createSpyObj('AuthService', ['getRole', 'currentUserSnapshot']);
    auth.getRole.and.returnValue(role);
    auth.currentUserSnapshot.and.returnValue({ area: 'TI' });

    TestBed.configureTestingModule({
      declarations: [AssetFormComponent],
      providers: [
        { provide: AssetService, useValue: assetService },
        { provide: AdminService, useValue: adminService },
        { provide: ToastService, useValue: toastService },
        { provide: AuthService, useValue: auth },
        { provide: BreadcrumbService, useValue: jasmine.createSpyObj('BreadcrumbService', ['fijar', 'quitar']) },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => id } } } }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    const fixture: ComponentFixture<AssetFormComponent> = TestBed.createComponent(AssetFormComponent);
    return { fixture, assetService, router, toastService };
  }

  it('en modo nuevo no pide el activo y arranca sin id', () => {
    const { fixture, assetService } = setup(null);
    fixture.detectChanges();
    expect(fixture.componentInstance.editando).toBeFalse();
    expect(assetService.getById).not.toHaveBeenCalled();
  });

  it('en modo edición carga el activo', () => {
    const activo = {
      idAsset: 'a1', codeAsset: 'C1', nameAsset: 'N', typeAsset: 'LAPTOP', statusAsset: 'DISPONIBLE',
      purchaseDateAsset: '2026-05-01T00:00:00-05:00'
    } as Asset;
    const { fixture, assetService } = setup('a1', activo);
    fixture.detectChanges();
    expect(assetService.getById).toHaveBeenCalledWith('a1');
    expect(fixture.componentInstance.editando).toBeTrue();
    expect(fixture.componentInstance.request.codeAsset).toBe('C1');
    expect(fixture.componentInstance.request.purchaseDateAsset).toBe('2026-05-01');
  });

  it('no guarda sin código ni nombre y avisa', () => {
    const { fixture, assetService, toastService } = setup(null);
    fixture.detectChanges();

    fixture.componentInstance.guardar();

    expect(assetService.create).not.toHaveBeenCalled();
    expect(toastService.warn).toHaveBeenCalled();
  });

  it('crea el activo y navega a su ficha', () => {
    const { fixture, assetService, router } = setup(null);
    fixture.detectChanges();

    fixture.componentInstance.request.codeAsset = 'C1';
    fixture.componentInstance.request.nameAsset = 'Laptop';
    fixture.componentInstance.guardar();

    expect(assetService.create).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/activos', 'nuevo']);
  });

  it('un activo asignado se edita como "Operativo": la asignación decide el estado', () => {
    const activo = { idAsset: 'a1', codeAsset: 'C1', nameAsset: 'N', typeAsset: 'LAPTOP', statusAsset: 'ASIGNADO', assignedUserId: 'u1' } as Asset;
    const { fixture } = setup('a1', activo);
    fixture.detectChanges();
    expect(fixture.componentInstance.request.statusAsset).toBe('DISPONIBLE');
    expect(fixture.componentInstance.estadoResultante).toBe('ASIGNADO');
  });

  it('no deja dar de baja un activo con persona asignada', () => {
    const { fixture, assetService, toastService } = setup(null);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.request.codeAsset = 'C1';
    c.request.nameAsset = 'Laptop';
    c.request.statusAsset = 'BAJA';
    c.request.assignedUserId = 'u1';
    c.guardar();
    expect(assetService.create).not.toHaveBeenCalled();
    expect(toastService.warn).toHaveBeenCalled();
  });

  it('el jefe de área no elige área: queda la suya', () => {
    const { fixture } = setup(null, undefined, 'AREA_MANAGER');
    const admin = TestBed.inject(AdminService) as jasmine.SpyObj<AdminService>;
    admin.catalog.and.returnValue(of({ areas: [{ id: 'ar1', name: 'TI' }], categories: [], priorities: [], statuses: [], sucursales: [] } as unknown as Catalog));
    fixture.detectChanges();
    expect(fixture.componentInstance.areaBloqueada).toBeTrue();
    expect(fixture.componentInstance.request.areaId).toBe('ar1');
  });
});
