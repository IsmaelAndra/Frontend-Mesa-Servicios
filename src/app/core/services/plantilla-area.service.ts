import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Una plantilla tal como la ve un área: la general y, si existe, la suya (V38). */
export interface PlantillaDeArea {
  nombre: string;
  tipo: string;
  icono: string | null;
  color: string | null;
  asuntoGeneral: string;
  cuerpoGeneral: string;
  personalizada: boolean;
  asunto: string;
  cuerpo: string;
  activa: boolean;
  actualizada: string | null;
}

@Injectable({ providedIn: 'root' })
export class PlantillaAreaService {
  private readonly url = `${environment.apiUrl}/plantillas-area`;

  constructor(private http: HttpClient) {}

  listar(areaId: string): Observable<PlantillaDeArea[]> {
    return this.http.get<PlantillaDeArea[]>(`${this.url}/${areaId}`);
  }

  guardar(areaId: string, nombre: string, asunto: string, cuerpo: string, activa: boolean): Observable<PlantillaDeArea> {
    return this.http.put<PlantillaDeArea>(`${this.url}/${areaId}/${nombre}`, { asunto, cuerpo, activa });
  }

  restablecer(areaId: string, nombre: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${areaId}/${nombre}`);
  }
}
