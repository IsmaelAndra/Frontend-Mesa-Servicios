import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MensajeProyecto,
  EstadoItem, InvitacionProyecto, ItemRequest, ProyectoDetalle, ProyectoItem, ProyectoMiembro,
  ProyectoObjetivo, ProyectoRequest, ProyectoResumen, ProyectoSprint, SprintRequest, ParticipanteChat } from '../../models/proyecto.model';

/** Proyectos (Fase 3): /proyectos en el backend. Los permisos los decide el servidor. */
@Injectable({ providedIn: 'root' })
export class ProyectoService {
  private readonly url = `${environment.apiUrl}/proyectos`;

  constructor(private http: HttpClient) {}

  listar(): Observable<ProyectoResumen[]> {
    return this.http.get<ProyectoResumen[]>(this.url);
  }

  crear(r: ProyectoRequest): Observable<ProyectoResumen> {
    return this.http.post<ProyectoResumen>(this.url, r);
  }

  detalle(id: string): Observable<ProyectoDetalle> {
    return this.http.get<ProyectoDetalle>(`${this.url}/${id}`);
  }

  editar(id: string, r: ProyectoRequest): Observable<ProyectoResumen> {
    return this.http.put<ProyectoResumen>(`${this.url}/${id}`, r);
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  // ---- áreas
  invitaciones(): Observable<InvitacionProyecto[]> {
    return this.http.get<InvitacionProyecto[]>(`${this.url}/invitaciones`);
  }

  invitarArea(id: string, areaId: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/areas`, { areaId });
  }

  decidir(id: string, areaId: string, aceptar: boolean, motivo?: string | null): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/areas/${areaId}/decidir`, { aceptar, motivo: motivo || null });
  }

  quitarArea(id: string, areaId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/areas/${areaId}`);
  }

  // ---- equipo
  candidatos(id: string): Observable<ProyectoMiembro[]> {
    return this.http.get<ProyectoMiembro[]>(`${this.url}/${id}/candidatos`);
  }

  agregarMiembro(id: string, userId: string, rol: 'RESPONSABLE' | 'MIEMBRO' = 'MIEMBRO'): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/miembros`, { userId, rol });
  }

  quitarMiembro(id: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/miembros/${userId}`);
  }

  // ---- sprints
  crearSprint(id: string, r: SprintRequest): Observable<ProyectoSprint> {
    return this.http.post<ProyectoSprint>(`${this.url}/${id}/sprints`, r);
  }

  editarSprint(id: string, sprintId: string, r: SprintRequest): Observable<void> {
    return this.http.put<void>(`${this.url}/${id}/sprints/${sprintId}`, r);
  }

  eliminarSprint(id: string, sprintId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/sprints/${sprintId}`);
  }

  // ---- tablero
  crearItem(id: string, r: ItemRequest): Observable<ProyectoItem> {
    return this.http.post<ProyectoItem>(`${this.url}/${id}/items`, r);
  }

  editarItem(id: string, itemId: string, r: ItemRequest): Observable<ProyectoItem> {
    return this.http.put<ProyectoItem>(`${this.url}/${id}/items/${itemId}`, r);
  }

  moverItem(id: string, itemId: string, estado: EstadoItem, orden: number): Observable<ProyectoItem> {
    return this.http.patch<ProyectoItem>(`${this.url}/${id}/items/${itemId}/mover`, { estado, orden });
  }

  eliminarItem(id: string, itemId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/items/${itemId}`);
  }

  // ---- objetivos y logros
  crearObjetivo(id: string, descripcion: string): Observable<ProyectoObjetivo> {
    return this.http.post<ProyectoObjetivo>(`${this.url}/${id}/objetivos`, { descripcion });
  }

  editarObjetivo(id: string, objetivoId: string, descripcion: string): Observable<void> {
    return this.http.put<void>(`${this.url}/${id}/objetivos/${objetivoId}`, { descripcion });
  }

  marcarLogro(id: string, objetivoId: string, logrado: boolean, nota?: string | null): Observable<void> {
    return this.http.put<void>(`${this.url}/${id}/objetivos/${objetivoId}/logro`, { logrado, nota: nota || null });
  }

  eliminarObjetivo(id: string, objetivoId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/objetivos/${objetivoId}`);
  }

  // ---------------------------------------------------------------- chat (V39)

  chat(id: string, antesDe?: string | null, tam = 50): Observable<MensajeProyecto[]> {
    const params: Record<string, string> = { tam: String(tam) };
    if (antesDe) params['antesDe'] = antesDe;
    return this.http.get<MensajeProyecto[]>(`${this.url}/${id}/chat`, { params });
  }

  /** texto es HTML del editor; menciones = ids de las personas nombradas con @. */
  enviarMensaje(id: string, texto: string, archivos: File[], menciones: string[] = []): Observable<MensajeProyecto> {
    const form = new FormData();
    if (texto) form.append('texto', texto);
    archivos.forEach((f) => form.append('archivos', f, f.name));
    menciones.forEach((m) => form.append('menciones', m));
    return this.http.post<MensajeProyecto>(`${this.url}/${id}/chat`, form);
  }

  /** Personas que se pueden mencionar con @ en el chat. */
  participantesChat(id: string): Observable<ParticipanteChat[]> {
    return this.http.get<ParticipanteChat[]>(`${this.url}/${id}/chat/participantes`);
  }

  marcarChatLeido(id: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/chat/leido`, {});
  }

  /** Mensajes sin leer por proyecto (los que no aparecen, 0). */
  noLeidos(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.url}/mensajes/no-leidos`);
  }

  adjuntoChat(id: string, adjuntoId: string): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/chat/adjuntos/${adjuntoId}`, { responseType: 'blob' });
  }
}
