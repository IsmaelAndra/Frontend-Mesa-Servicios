import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Lo que se guarda de un reporte del modal: tabla, columnas en orden y filtros
 * (clave → id). Con medidas es un resumen: las columnas son "Agrupar por".
 */
export interface DefinicionReporte {
  tabla: string;
  columnas: string[];
  filtros: Record<string, string>;
  medidas?: string[] | null;
}

export interface ReporteUsuario {
  id: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  color: string | null;
  propietario: string;
  propio: boolean;
  /** Reporte del sistema: lo ven todos los que ven reportes y solo lo edita el súper admin. */
  sistema: boolean;
  definicion: DefinicionReporte;
  actualizado: string;
}

export interface TablaReporte {
  clave: string;
  nombre: string;
  descripcion: string;
  icono: string;
  columnas: { clave: string; etiqueta: string; agrupable: boolean }[];
  /** Totales por grupo (solo en un resumen). */
  medidas: { clave: string; etiqueta: string }[];
  /** tipo: AREA | ESTADO | PRIORIDAD | CATEGORIA | SUCURSAL | TIPO */
  filtros: { clave: string; etiqueta: string; tipo: string }[];
}

export interface VistaPreviaReporte {
  columnas: string[];
  filas: string[][];
  /** Hay más filas de las que se muestran (la exportación las trae todas). */
  recortada: boolean;
}

/** Reportes hechos desde el modal (Fase 2). El backend arma la consulta con un catálogo cerrado. */
@Injectable({ providedIn: 'root' })
export class ReporteUsuarioService {
  private readonly url = `${environment.apiUrl}/reportes-personalizados`;

  constructor(private http: HttpClient) {}

  catalogo(): Observable<TablaReporte[]> {
    return this.http.get<TablaReporte[]>(`${this.url}/catalogo`);
  }

  listar(): Observable<ReporteUsuario[]> {
    return this.http.get<ReporteUsuario[]>(this.url);
  }

  guardar(id: string | null, nombre: string, descripcion: string, definicion: DefinicionReporte,
          icono?: string | null, color?: string | null): Observable<ReporteUsuario> {
    const cuerpo = { nombre, descripcion, icono: icono || null, color: color || null, definicion };
    return id ? this.http.put<ReporteUsuario>(`${this.url}/${id}`, cuerpo) : this.http.post<ReporteUsuario>(this.url, cuerpo);
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  vistaPrevia(definicion: DefinicionReporte, desde?: string, hasta?: string): Observable<VistaPreviaReporte> {
    return this.http.post<VistaPreviaReporte>(`${this.url}/vista-previa`, { definicion, desde: desde || null, hasta: hasta || null });
  }

  vistaPreviaGuardado(id: string, desde?: string, hasta?: string): Observable<VistaPreviaReporte> {
    return this.http.get<VistaPreviaReporte>(`${this.url}/${id}/vista-previa`, { params: this.periodo(desde, hasta) });
  }

  exportar(id: string, formato: 'PDF' | 'EXCEL', desde?: string, hasta?: string, orientacion?: string): Observable<Blob> {
    const params: Record<string, string> = { ...this.periodo(desde, hasta), formato };
    if (orientacion) params['orientacion'] = orientacion;
    return this.http.get(`${this.url}/${id}/exportar`, { params, responseType: 'blob' });
  }

  private periodo(desde?: string, hasta?: string): Record<string, string> {
    const p: Record<string, string> = {};
    if (desde) p['desde'] = desde;
    if (hasta) p['hasta'] = hasta;
    return p;
  }
}
