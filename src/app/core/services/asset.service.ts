import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Asset, AssetAssignableUser, AssetPage, AssetRequest, AssetHistory } from '../../models/asset.model';

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
}