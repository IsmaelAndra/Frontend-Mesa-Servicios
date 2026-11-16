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

describe('AssetFormComponent', () => {
  function setup(id: string | null, activo?: Asset, role = 'SUPER_ADMIN') {
    const assetService = jasmine.createSpyObj('AssetService', ['getById', 'create', 'update', 'asignables', 'tipos', 'config']);
    assetService.asignables.and.returnValue(of([]));
    assetService.tipos.and.returnValue(of([{ id: 't1', nombre: 'Laptop', prefijo: 'LAP', icono: 'fa-solid fa-laptop', color: '#2563EB', activo: true }]));
    assetService.config.and.returnValue(of({ formatoCodigo: 'TI-{TIPO}-{NUM:6}' }));
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

  it('no guarda sin nombre ni tipo y avisa', () => {
    const { fixture, assetService, toastService } = setup(null);
    fixture.detectChanges();

    fixture.componentInstance.guardar();

    expect(assetService.create).not.toHaveBeenCalled();
    expect(toastService.warn).toHaveBeenCalled();
  });

  it('crea el activo y navega a su ficha', () => {
    const { fixture, assetService, router } = setup(null);
    fixture.detectChanges();

    // Sin código: el servidor pone el siguiente de la numeración.
    fixture.componentInstance.request.nameAsset = 'Laptop';
    fixture.componentInstance.request.assetTypeId = 't1';
    // Lo que hace la pantalla al elegir el tipo.
    fixture.componentInstance.actualizarEjemplo();
    fixture.componentInstance.guardar();

    expect(assetService.create).toHaveBeenCalled();
    expect(assetService.create.calls.mostRecent().args[0].codeAsset).toBeUndefined();
    expect(fixture.componentInstance.ejemploCodigo).toBe('TI-LAP-00000N');
    expect(router.navigate).toHaveBeenCalledWith(['/activos', 'nuevo']);
  });

  it('un activo asignado se edita como "Operativo": la asignación decide el estado', () => {
    const activo = { idAsset: 'a1', codeAsset: 'C1', nameAsset: 'N', typeAsset: 'LAPTOP', statusAsset: 'ASIGNADO', assignedUserId: 'u1' } as Asset;
    const { fixture } = setup('a1', activo);
    fixture.detectChanges();
    expect(fixture.componentInstance.request.statusAsset).toBe('EN_BODEGA');
    expect(fixture.componentInstance.estadoResultante).toBe('ASIGNADO');
  });

  it('no deja dar de baja un activo con persona asignada', () => {
    const { fixture, assetService, toastService } = setup(null);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.request.assetTypeId = 't1';
    c.request.nameAsset = 'Laptop';
    c.request.statusAsset = 'BAJA';
    c.request.assignedUserId = 'u1';
    c.guardar();
    expect(assetService.create).not.toHaveBeenCalled();
    expect(toastService.warn).toHaveBeenCalled();
  });

  it('el área se elige libremente: Tecnología y Desarrollo gestionan todos los activos', () => {
    const { fixture } = setup(null, undefined, 'AGENT');
    fixture.detectChanges();
    expect(fixture.componentInstance.areaBloqueada).toBeFalse();
  });
});
