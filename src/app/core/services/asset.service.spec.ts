import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AssetService } from './asset.service';
import { environment } from '../../../environments/environment';
import { Asset, AssetHistory } from '../../models/asset.model';

describe('AssetService', () => {
  let service: AssetService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/assets`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AssetService]
    });
    service = TestBed.inject(AssetService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('busca con los filtros ya saneados como parámetros', () => {
    service.search({ search: 'dell', status: 'ASIGNADO', page: 1, size: 10 }).subscribe();
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('search')).toBe('dell');
    expect(req.request.params.get('status')).toBe('ASIGNADO');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('10');
    req.flush({ content: [], totalElements: 0, totalPages: 0, size: 10, number: 0 });
  });

  it('omite los filtros vacíos', () => {
    service.search({ search: '', status: undefined }).subscribe();
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.params.has('search')).toBeFalse();
    expect(req.request.params.has('status')).toBeFalse();
    req.flush({ content: [], totalElements: 0, totalPages: 0, size: 10, number: 0 });
  });

  it('obtiene un activo por id', () => {
    const activo = { idAsset: 'a1', nameAsset: 'X' } as Asset;
    service.getById('a1').subscribe((a) => expect(a.idAsset).toBe('a1'));
    const req = http.expectOne(`${url}/a1`);
    expect(req.request.method).toBe('GET');
    req.flush(activo);
  });

  it('crea un activo por POST', () => {
    service.create({ codeAsset: 'C1', nameAsset: 'N', typeAsset: 'LAPTOP' }).subscribe();
    const req = http.expectOne(url);
    expect(req.request.method).toBe('POST');
    req.flush({ idAsset: 'a2' });
  });

  it('cambia el estado con PATCH', () => {
    service.changeStatus('a1', 'BAJA').subscribe();
    const req = http.expectOne(`${url}/a1/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ statusName: 'BAJA' });
    req.flush({ idAsset: 'a1' });
  });

  it('asigna y desasigna con los parámetros esperados', () => {
    service.assign('a1', 'u1', 'acta 12').subscribe();
    const asignar = http.expectOne((r) => r.url === `${url}/a1/assign`);
    expect(asignar.request.method).toBe('POST');
    expect(asignar.request.params.get('userId')).toBe('u1');
    expect(asignar.request.params.get('notes')).toBe('acta 12');
    asignar.flush({ idAsset: 'a1' });

    service.unassign('a1').subscribe();
    const desasignar = http.expectOne((r) => r.url === `${url}/a1/unassign`);
    expect(desasignar.request.method).toBe('POST');
    expect(desasignar.request.params.has('notes')).toBeFalse();
    desasignar.flush({ idAsset: 'a1' });
  });

  it('consulta el historial', () => {
    service.getHistory('a1').subscribe((h: AssetHistory[]) => expect(h.length).toBe(0));
    const req = http.expectOne(`${url}/a1/history`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});