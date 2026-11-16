import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { registrarTiposActivo } from '../utils/asset-type.util';
import { environment } from '../../../environments/environment';
import { Acta, ActaRequest, Asset, AssetArchivo, AssetAssignableUser, AssetConfig, AssetHistory, AssetPage, AssetRequest, AssetTipo } from '../../models/asset.model';

@Injectable({ providedIn: 'root' })
export class AssetService {
  private url = `${environment.apiUrl}/assets`;

  constructor(private http: HttpClient) {}

  search(query: {
    search?: string;
    status?: string;
    type?: string;
    areaId?: string;
    sucursalId?: string;
    page?: number;
    size?: number;
  } = {}): Observable<AssetPage> {
    let params = new HttpParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    });
    return this.http.get<AssetPage>(this.url, { params });
  }

  /**
   * Personas a las que el usuario puede asignar activos: todas para un
   * administrador, las de su área para un jefe de área. Va aparte de /users,
   * que es solo de administradores.
   */
  asignables(): Observable<AssetAssignableUser[]> {
    return this.http.get<AssetAssignableUser[]>(`${this.url}/asignables`);
  }

  getById(id: string): Observable<Asset> {
    return this.http.get<Asset>(`${this.url}/${id}`);
  }

  create(data: AssetRequest): Observable<Asset> {
    return this.http.post<Asset>(this.url, data);
  }

  update(id: string, data: AssetRequest): Observable<Asset> {
    return this.http.put<Asset>(`${this.url}/${id}`, data);
  }

  assign(id: string, userId: string, notes?: string): Observable<Asset> {
    let params = new HttpParams().set('userId', userId);
    if (notes) params = params.set('notes', notes);
    return this.http.post<Asset>(`${this.url}/${id}/assign`, {}, { params });
  }

  unassign(id: string, notes?: string): Observable<Asset> {
    let params = new HttpParams();
    if (notes) params = params.set('notes', notes);
    return this.http.post<Asset>(`${this.url}/${id}/unassign`, {}, { params });
  }

  changeStatus(id: string, statusName: string): Observable<Asset> {
    return this.http.patch<Asset>(`${this.url}/${id}/status`, { statusName });
  }

  getHistory(id: string): Observable<AssetHistory[]> {
    return this.http.get<AssetHistory[]>(`${this.url}/${id}/history`);
  }

  findByUser(userId: string): Observable<Asset[]> {
    return this.http.get<Asset[]>(`${this.url}/user/${userId}`);
  }

  findByArea(areaId: string): Observable<Asset[]> {
    return this.http.get<Asset[]>(`${this.url}/area/${areaId}`);
  }

  findBySucursal(sucursalId: string): Observable<Asset[]> {
    return this.http.get<Asset[]>(`${this.url}/sucursal/${sucursalId}`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  // ============================ Fase 4 ============================

  /** Tipos del maestro; al llegar se registran para nombres e iconos en toda la app. */
  tipos(): Observable<AssetTipo[]> {
    return this.http.get<AssetTipo[]>(`${this.url}/tipos`).pipe(tap((t) => registrarTiposActivo(t || [])));
  }

  guardarTipo(id: string | null, t: Partial<AssetTipo>): Observable<AssetTipo> {
    return id ? this.http.put<AssetTipo>(`${this.url}/tipos/${id}`, t) : this.http.post<AssetTipo>(`${this.url}/tipos`, t);
  }

  eliminarTipo(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/tipos/${id}`);
  }

  config(): Observable<AssetConfig> {
    return this.http.get<AssetConfig>(`${this.url}/config`);
  }

  guardarConfig(c: Partial<AssetConfig>): Observable<AssetConfig> {
    return this.http.put<AssetConfig>(`${this.url}/config`, c);
  }

  /** Para el escáner: busca por el código leído con la cámara. */
  porCodigo(codigo: string): Observable<Asset> {
    return this.http.get<Asset>(`${this.url}/codigo/${encodeURIComponent(codigo)}`);
  }

  etiquetas(ids: string[]): Observable<Blob> {
    return this.http.post(`${this.url}/etiquetas`, { ids }, { responseType: 'blob' });
  }

  archivos(id: string): Observable<AssetArchivo[]> {
    return this.http.get<AssetArchivo[]>(`${this.url}/${id}/archivos`);
  }

  subirArchivo(id: string, tipo: string, archivo: File, vence?: string | null): Observable<AssetArchivo> {
    const fd = new FormData();
    fd.append('tipo', tipo);
    fd.append('archivo', archivo);
    if (vence) fd.append('vence', vence);
    return this.http.post<AssetArchivo>(`${this.url}/${id}/archivos`, fd);
  }

  descargarArchivo(id: string, archivoId: string): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/archivos/${archivoId}`, { responseType: 'blob' });
  }

  eliminarArchivo(id: string, archivoId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/archivos/${archivoId}`);
  }

  actas(assetId?: string): Observable<Acta[]> {
    const params = assetId ? new HttpParams().set('assetId', assetId) : undefined;
    return this.http.get<Acta[]>(`${this.url}/actas`, { params });
  }

  revisores(): Observable<{ id: string; nombre: string; cargo: string | null; correo: string }[]> {
    return this.http.get<{ id: string; nombre: string; cargo: string | null; correo: string }[]>(`${this.url}/actas/revisores`);
  }

  /** Firmantes sin nombre o cargo para esa acta ("correo (cargo)"); vacío si está todo. */
  faltantesActa(r: ActaRequest): Observable<string[]> {
    return this.http.post<string[]>(`${this.url}/actas/faltantes`, r);
  }

  crearActa(r: ActaRequest): Observable<Acta> {
    return this.http.post<Acta>(`${this.url}/actas`, r);
  }

  aceptarActa(id: string): Observable<Acta> {
    return this.http.post<Acta>(`${this.url}/actas/${id}/aceptar`, {});
  }

  actaPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.url}/actas/${id}/pdf`, { responseType: 'blob' });
  }

  subirActaFirmada(id: string, archivo: File): Observable<Acta> {
    const fd = new FormData();
    fd.append('archivo', archivo);
    return this.http.post<Acta>(`${this.url}/actas/${id}/firmada`, fd);
  }

  actaFirmada(id: string): Observable<Blob> {
    return this.http.get(`${this.url}/actas/${id}/firmada`, { responseType: 'blob' });
  }
}
