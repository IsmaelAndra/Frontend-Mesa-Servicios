import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { AssetDetailComponent } from './asset-detail.component';
import { AssetService } from '../../../core/services/asset.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { Asset, AssetAssignableUser } from '../../../models/asset.model';

describe('AssetDetailComponent', () => {
  const activoBase: Asset = {
    idAsset: 'a1',
    codeAsset: 'TI-IMP-003',
    nameAsset: 'Impresora HP',
    typeAsset: 'IMPRESORA',
    statusAsset: 'DISPONIBLE',
    createdAtAsset: '2026-01-01T00:00:00-05:00',
    updatedAtAsset: '2026-01-01T00:00:00-05:00'
  };

  const personas: AssetAssignableUser[] = [
    { idUser: 'u2', displayName: 'Zoila Pérez', corporateEmailUser: 'z@coac.ec', photoUrl: null, area: 'TI' },
    { idUser: 'u1', displayName: 'Ana Torres', corporateEmailUser: 'a@coac.ec', photoUrl: '/uploads/a.png', area: 'TI' }
  ];

  function setup(role: string, activo: Asset = activoBase) {
    const assetService = jasmine.createSpyObj('AssetService', [
      'getById', 'getHistory', 'asignables', 'assign', 'unassign', 'changeStatus', 'delete'
    ]);
    assetService.getById.and.returnValue(of({ ...activo }));
    assetService.getHistory.and.returnValue(of([]));
    assetService.asignables.and.returnValue(of(personas));
    assetService.assign.and.returnValue(of({ ...activo, assignedUser: 'u1' }));
    assetService.unassign.and.returnValue(of({ ...activo }));
    assetService.changeStatus.and.returnValue(of({ ...activo }));
    assetService.delete.and.returnValue(of(void 0));

    const auth = jasmine.createSpyObj('AuthService', ['getRole']);
    auth.getRole.and.returnValue(role);
    const toastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'warn']);
    const router = jasmine.createSpyObj('Router', ['navigate']);
    const breadcrumb = jasmine.createSpyObj('BreadcrumbService', ['fijar', 'quitar']);

    TestBed.configureTestingModule({
      declarations: [AssetDetailComponent],
      providers: [
        { provide: AssetService, useValue: assetService },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: router },
        { provide: BreadcrumbService, useValue: breadcrumb },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'a1' } } } }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    const fixture: ComponentFixture<AssetDetailComponent> = TestBed.createComponent(AssetDetailComponent);
    return { fixture, c: fixture.componentInstance, assetService, router, toastService, breadcrumb };
  }

  it('carga el activo y su historial', () => {
    const { fixture, c, assetService } = setup('ADMIN');
    fixture.detectChanges();
    expect(assetService.getById).toHaveBeenCalledWith('a1');
    expect(assetService.getHistory).toHaveBeenCalledWith('a1');
    expect(c.asset?.nameAsset).toBe('Impresora HP');
  });

  it('el breadcrumb muestra el nombre y el icono del tipo de activo', () => {
    const { fixture, breadcrumb } = setup('USER');
    fixture.detectChanges();
    expect(breadcrumb.fijar).toHaveBeenCalledWith('/activos/a1', { label: 'Impresora HP', icon: 'fa-solid fa-print' });
    fixture.destroy();
    expect(breadcrumb.quitar).toHaveBeenCalledWith('/activos/a1');
  });

  it('un USER no carga la lista de personas (no gestiona)', () => {
    const { fixture, assetService } = setup('USER');
    fixture.detectChanges();
    expect(assetService.asignables).not.toHaveBeenCalled();
  });

  it('las opciones de personas van ordenadas y sin quien ya lo tiene', () => {
    const { fixture, c } = setup('ADMIN', { ...activoBase, statusAsset: 'ASIGNADO', assignedUserId: 'u2', assignedUser: 'z@coac.ec' });
    fixture.detectChanges();
    expect(c.userOptions.map((o) => o.label)).toEqual(['Ana Torres']);
    expect(c.userOptions[0].initials).toBe('AT');
    expect(c.userOptions[0].detail).toBe('TI');
  });

  it('solo ADMIN/SUPER_ADMIN pueden eliminar', () => {
    const { c } = setup('USER');
    c.role = 'SUPER_ADMIN';
    expect(c.puedeEliminar).toBeTrue();
    c.role = 'AREA_MANAGER';
    expect(c.puedeEliminar).toBeFalse();
    expect(c.puedeGestionar).toBeTrue();
  });

  it('asigna a la persona elegida con la nota', () => {
    const { fixture, c, assetService, toastService } = setup('ADMIN');
    fixture.detectChanges();
    c.abrir('asignar');
    c.personaElegida = 'u1';
    c.nota = '  acta 12 ';
    c.confirmar();
    expect(assetService.assign).toHaveBeenCalledWith('a1', 'u1', 'acta 12');
    expect(toastService.success).toHaveBeenCalled();
    expect(c.accion).toBeNull();
  });

  it('no asigna sin persona y avisa', () => {
    const { fixture, c, assetService, toastService } = setup('ADMIN');
    fixture.detectChanges();
    c.abrir('asignar');
    c.confirmar();
    expect(assetService.assign).not.toHaveBeenCalled();
    expect(toastService.warn).toHaveBeenCalled();
  });

  it('devolver registra la devolución', () => {
    const { fixture, c, assetService } = setup('ADMIN', { ...activoBase, statusAsset: 'ASIGNADO', assignedUser: 'z@coac.ec' });
    fixture.detectChanges();
    c.abrir('devolver');
    c.confirmar();
    expect(assetService.unassign).toHaveBeenCalledWith('a1', undefined);
  });

  it('cada acción de estado pide el estado correcto', () => {
    const { fixture, c, assetService } = setup('ADMIN');
    fixture.detectChanges();
    c.abrir('reparar');
    c.confirmar();
    expect(assetService.changeStatus).toHaveBeenCalledWith('a1', 'EN_REPARACION');
    c.abrir('baja');
    c.confirmar();
    expect(assetService.changeStatus).toHaveBeenCalledWith('a1', 'BAJA');
    c.abrir('finReparacion');
    c.confirmar();
    expect(assetService.changeStatus).toHaveBeenCalledWith('a1', 'DISPONIBLE');
  });

  it('en reparación o de baja no se puede asignar', () => {
    const { fixture, c } = setup('ADMIN', { ...activoBase, statusAsset: 'EN_REPARACION' });
    fixture.detectChanges();
    expect(c.asignable).toBeFalse();
  });

  it('eliminar navega de vuelta al inventario', () => {
    const { fixture, c, assetService, router } = setup('SUPER_ADMIN');
    fixture.detectChanges();
    c.abrir('eliminar');
    c.confirmar();
    expect(assetService.delete).toHaveBeenCalledWith('a1');
    expect(router.navigate).toHaveBeenCalledWith(['/activos']);
  });

  it('el historial se cuenta en frases legibles', () => {
    const { c } = setup('ADMIN');
    const base = { idAssetHistory: 'h', assetId: 'a1', assetCode: 'x', assetName: 'x', createdAtAssetHistory: '' };
    expect(c.frase({ ...base, actionType: 'REASIGNACION', userDisplayName: 'Ana' })).toBe('Reasignado a Ana');
    expect(c.frase({ ...base, actionType: 'DEVOLUCION', userDisplayName: 'Luis' })).toBe('Devuelto por Luis');
    expect(c.accionMeta('FIN_REPARACION').etiqueta).toBe('Reparación finalizada');
  });
});
