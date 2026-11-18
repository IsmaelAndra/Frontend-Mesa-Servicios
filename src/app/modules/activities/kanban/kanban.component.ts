import { arrastreHabilitado } from '../../../core/utils/arrastre.util';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import { SseService } from '../../../core/services/sse.service';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import Swal from 'sweetalert2';
import { TaskService } from '../../../core/services/task.service';
import { AdminService, AssignableAgent } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { TaskItem, TaskRequest, TaskStatus, KANBAN_STATUSES, RECORDATORIOS } from '../../../models/task.model';
import { User } from '../../../models/user.model';
import { ToastService } from '../../../core/services/toast.service';
import { urlDelApi } from '../../../core/utils/url-api.util';

@Component({
  selector: 'app-kanban',
  templateUrl: './kanban.component.html',
  styleUrls: ['./kanban.component.css']
})
export class KanbanComponent implements OnInit, OnDestroy {
  private cambioSub?: Subscription;
  /** En pantallas táctiles no se arrastra: el dedo desliza el tablero. */
  readonly sinArrastre = !arrastreHabilitado();
  columns: { key: TaskStatus; label: string; color: string; tasks: TaskItem[] }[] = [];
  agents: AssignableAgent[] = [];
  loading = true;
  dragging = false;

  /**
   * Cuantas tarjetas se pintan por columna. No se usa un paginador porque el
   * arrastre entre columnas depende de que la lista que recibe el drop sea la
   * real: si se cortara, la tarjeta se moveria pero desapareceria de la vista.
   * Se revela de aplicationes de a 20 en su lugar.
   */
  private readonly PASO = 20;
  private visiblesPorColumna: Record<string, number> = {};

  tareasVisibles(col: { key: TaskStatus; tasks: TaskItem[] }): TaskItem[] {
    const pedidas = this.visiblesPorColumna[this.claveDe(col)] ?? this.PASO;
    return col.tasks.slice(0, pedidas);
  }

  quedanOcultas(col: { tasks: TaskItem[] }): number {
    const pedidas = this.visiblesPorColumna[this.claveDe(col)] ?? this.PASO;
    return Math.max(0, col.tasks.length - pedidas);
  }

  mostrarMas(col: { key: TaskStatus }): void {
    const clave = this.claveDe(col);
    this.visiblesPorColumna = {
      ...this.visiblesPorColumna,
      [clave]: (this.visiblesPorColumna[clave] ?? this.PASO) + this.PASO
    };
  }

  mostrarTodas(col: { key: TaskStatus }): void {
    this.visiblesPorColumna = { ...this.visiblesPorColumna, [this.claveDe(col)]: Number.MAX_SAFE_INTEGER };
  }

  private claveDe(col: { key?: TaskStatus; tasks?: TaskItem[] }): string {
    return col.key ?? (col.tasks?.[0]?.status as string) ?? '';
  }

  constructor(
    private taskService: TaskService,
    private adminService: AdminService,
    private toastService: ToastService,
    private authService: AuthService,
    private sse: SseService
  ) { }

  ngOnDestroy(): void {
    this.cambioSub?.unsubscribe();
  }

  ngOnInit(): void {
    // Una actividad que alguien me asignó (o cambió) aparece sin salir y volver a entrar.
    this.cambioSub = this.sse.cambio$.pipe(
      filter((c) => c.tipo === 'actividad'),
      debounceTime(400),
    ).subscribe(() => {
      if (!this.dragging) this.load();
    });
    this.columns = KANBAN_STATUSES.map((s) => ({ key: s.key, label: s.label, color: s.color, tasks: [] }));
    this.load();
    this.adminService.agents().subscribe({
      next: (a) => (this.agents = a),
      error: () => { }
    });
  }

  /** IDs de las columnas para conectar el drag & drop entre listas */
  get columnIds(): string[] {
    return this.columns.map((c) => c.key);
  }

  load(): void {
    this.loading = true;
    this.taskService.findAll().subscribe({
      next: (tasks) => {
        this.columns.forEach((c) => (c.tasks = []));
        tasks.forEach((t) => {
          const col = this.columns.find((c) => c.key === t.status);
          if (col) col.tasks.push(t);
        });
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toastService.error('No se pudieron cargar las tareas');
      }
    });
  }

  /** Foto del usuario asignado cuando está disponible (fallback a iniciales). */
  assignedPhoto(task: TaskItem): string | null {
    const agent = this.agents.find((a) => a.corporateEmailUser === task.assignedUserEmail);
    const url = agent?.photoUrl;
    if (!url) {
      return null;
    }
    return urlDelApi(url);
  }

  /**
   * Nombre corto del responsable. Antes se pintaba el correo completo
   * (agente@coacmagisterio.fin.ec), que es larguisimo y estiraba la tarjeta
   * hasta hacer el tablero ilegible. Se usa el nombre del agente y, si no hay,
   * la parte del correo antes de la arroba.
   */
  asignado(task: TaskItem): string {
    const agent = this.agents.find((a) => a.corporateEmailUser === task.assignedUserEmail);
    const nombre = agent?.displayName?.trim();
    if (nombre) {
      return nombre;
    }
    const email = (task.assignedUserEmail || '').trim();
    return email.includes('@') ? email.split('@')[0] : email || 'Sin asignar';
  }

  /**
   * "Te la asignó X" cuando otra persona me la encargó, o "Encargada a X"
   * cuando yo se la encargué a otra. Null si es una actividad propia.
   */
  origenTarea(task: TaskItem): { icono: string; texto: string } | null {
    const yo = this.currentUser()?.corporateEmailUser;
    if (!yo || !task.createdByEmail || task.createdByEmail === task.assignedUserEmail) return null;
    if (task.assignedUserEmail === yo) {
      return { icono: 'fa-share', texto: `Te la asignó ${this.nombreDe(task.createdByEmail)}` };
    }
    if (task.createdByEmail === yo) {
      return { icono: 'fa-paper-plane', texto: `Encargada a ${this.asignado(task)}` };
    }
    return null;
  }

  private nombreDe(email: string): string {
    const agente = this.agents.find((a) => a.corporateEmailUser === email);
    return agente?.displayName?.trim() || (email.includes('@') ? email.split('@')[0] : email);
  }

  /**
   * Estado de sesión de la persona asignada. Se busca en la lista de agentes
   * (con su sessionState) y, si es el usuario con sesión, se usa el suyo: sin
   * esto el avatar no distinguía a nadie en línea de nadie desconectado.
   */
  sesionDe(task: TaskItem): string {
    const agente = this.agents.find((a) => a.corporateEmailUser === task.assignedUserEmail);
    if (agente) return agente.sessionState || 'DESCONECTADO';
    if (task.assignedUserEmail === this.currentUser()?.corporateEmailUser) {
      return this.sesionPropia;
    }
    return 'DESCONECTADO';
  }

  private get sesionPropia(): string {
    return this.authService.currentUserSnapshot()?.sessionState || 'DESCONECTADO';
  }

  openNew(): void {
    this.openModal(null);
  }

  openEdit(task: TaskItem): void {
    if (this.dragging) return;
    this.openModal(task);
  }

  /** Vencida: tiene plazo, ya pasó y no está HECHA. */
  vencida(task: TaskItem): boolean {
    return !!task.due && task.status !== 'HECHO' && new Date(task.due).getTime() < Date.now();
  }

  onDragStart(): void {
    this.dragging = true;
  }

  onDragEnd(): void {
    setTimeout(() => (this.dragging = false), 120);
  }

  /**
   * Agentes a los que se puede asignar. Incluye al usuario con sesion aunque no
   * venga en /users/agents (un admin, por ejemplo), para que crear una actividad
   * propia no quede bloqueado.
   */
  private opcionesDeAsignado(task: TaskItem | null = null): AssignableAgent[] {
    const yo = this.currentUser();
    // Solo el jefe de área y el súper admin encargan actividades a otras personas;
    // un agente o un usuario se las asigna a sí mismo (lo exige también el backend).
    const rol = this.authService.getRole();
    if (rol !== 'AREA_MANAGER' && rol !== 'SUPER_ADMIN') {
      const propias: AssignableAgent[] = yo ? [yo] : [];
      // Al editar una que ya tenía otra persona, se conserva esa opción.
      const actual = task ? this.agents.find((a) => a.idUser === task.assignedUserId) : undefined;
      if (actual && !propias.some((a) => a.idUser === actual.idUser)) propias.push(actual);
      return propias;
    }
    const lista = [...this.agents];
    if (yo && !lista.some((a) => a.idUser === yo.idUser)) {
      lista.unshift(yo);
    }
    return lista;
  }

  private currentUser(): User | null {
    return this.authService.currentUserSnapshot();
  }

  private openModal(task: TaskItem | null): void {
    const editing = !!task;
    // /users/agents solo devuelve los usuarios con rol AGENT, asi que quien
    // logged como ADMIN no aparecia en la lista y no podia asignarse a si mismo
    // (el backend lo marca como obligatorio). Se agrega el usuario actual a las
    // opciones y se deja preseleccionado al crear.
    const opciones = this.opcionesDeAsignado(task);
    const preseleccionado = task
      ? task.assignedUserId
      : (this.currentUser()?.idUser ?? opciones[0]?.idUser ?? null);

    const agentOptions = opciones
      .map((a) => {
        const selected = preseleccionado != null && a.idUser === preseleccionado;
        const url = a.photoUrl
          ? urlDelApi(a.photoUrl)
          : '';
        const initial = (a.corporateEmailUser || '?').charAt(0).toUpperCase();
        const avatar = url
          ? `<img src="${escHtml(url)}" alt="" class="w-6 h-6 rounded-full object-cover shrink-0" />`
          : `<span class="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">${escHtml(
              initial
            )}</span>`;
        const label = a.displayName || a.corporateEmailUser;
        return `<label class="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-base-200 transition-colors${
          selected ? ' bg-base-200/70' : ''
        }">
            <input type="radio" name="tk-assigned" value="${a.idUser}"${
          selected ? ' checked' : ''
        } class="radio radio-primary radio-xs shrink-0" />
            ${avatar}
            <span class="text-sm min-w-0 truncate">${escHtml(label)}</span>
          </label>`;
      })
      .join('');

    Swal.fire({ reverseButtons: true, cancelButtonColor: '#6b7280', confirmButtonColor: '#dc2626', focusCancel: true,
      title: editing ? 'Editar tarea' : 'Nueva tarea',
      width: '600px',
      html: `
        <div class="text-left space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Título <span class="text-error">*</span></label>
            <input id="tk-title" class="swal-daisy-input" placeholder="Título de la tarea" value="${escHtml(
        task?.title ?? ''
      )}" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Descripción</label>
            <textarea id="tk-desc" class="swal-daisy-input" rows="3" placeholder="Detalle (opcional)">${escHtml(
        task?.description ?? ''
      )}</textarea>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Asignado <span class="text-error">*</span></label>
            <div class="border border-base-300 rounded-lg p-1.5 max-h-48 overflow-y-auto space-y-1 text-left">${agentOptions}</div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium mb-1">Inicio</label>
              <input id="tk-start" type="datetime-local" class="swal-daisy-input" value="${toLocalInput(
        task?.start
      )}" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Fin</label>
              <input id="tk-end" type="datetime-local" class="swal-daisy-input" value="${toLocalInput(
        task?.due
      )}" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium mb-1">Duración (min)</label>
              <input id="tk-duration" type="number" min="1" class="swal-daisy-input" value="${task?.durationMinutes ?? 5
        }" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Avisarme por correo</label>
              <select id="tk-recordatorio" class="swal-daisy-input" title="Aviso antes de la fecha de fin">${RECORDATORIOS
        .map((r) => `<option value="${r.valor ?? ''}" ${(task?.recordatorioMinutos ?? null) === r.valor ? 'selected' : ''}>${r.texto}</option>`)
        .join('')}</select>
            </div>
          </div>
          <p class="text-xs opacity-60 text-left">El aviso se envía antes de la fecha de fin; sin fecha de fin no hay aviso.</p>
        </div>`,
      customClass: {
        popup: 'rounded-xl',
        title: 'text-lg font-bold',
        confirmButton: 'btn btn-primary btn-sm text-white',
        cancelButton: 'btn btn-ghost btn-sm text-white',
        denyButton: 'btn btn-error btn-sm text-white'
      },
      buttonsStyling: false,
      showCancelButton: true,
      showDenyButton: editing,
      denyButtonText: 'Eliminar',
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      didOpen: (popup) => enlazarDuracion(popup),
      preConfirm: () => {
        const popup = Swal.getPopup();
        const title = (popup?.querySelector('#tk-title') as HTMLInputElement)?.value.trim() ?? '';
        const assigned =
          (popup?.querySelector('input[name="tk-assigned"]:checked') as HTMLInputElement)?.value ??
          '';
        if (!title || !assigned) {
          Swal.showValidationMessage('Complete el título y seleccione el asignado');
          return false;
        }
        const start = (popup?.querySelector('#tk-start') as HTMLInputElement)?.value || undefined;
        const due = (popup?.querySelector('#tk-end') as HTMLInputElement)?.value || undefined;
        if (start && due && new Date(due).getTime() < new Date(start).getTime()) {
          Swal.showValidationMessage('La fecha de fin no puede ser anterior a la de inicio');
          return false;
        }
        const duration =
          Number((popup?.querySelector('#tk-duration') as HTMLInputElement)?.value) || undefined;
        const recordatorio =
          Number((popup?.querySelector('#tk-recordatorio') as HTMLSelectElement)?.value) || null;
        return {
          title,
          description:
            (popup?.querySelector('#tk-desc') as HTMLTextAreaElement)?.value.trim() || undefined,
          assignedUserId: assigned,
          start: start ? new Date(start).toISOString() : undefined,
          due: due ? new Date(due).toISOString() : undefined,
          durationMinutes: duration,
          recordatorioMinutos: due ? recordatorio : null
        } as TaskRequest;
      }
    }).then((result) => {
      if (result.isDenied && task) {
        this.deleteTask(task.id);
        return;
      }
      if (result.isConfirmed && result.value) {
        this.saveTask(task ? task.id : null, result.value as TaskRequest);
      }
    });
  }

  private saveTask(id: string | null, data: TaskRequest): void {
    const call = id ? this.taskService.update(id, data) : this.taskService.create(data);
    call.subscribe({
      next: () => {
        this.toastService.success('Tarea guardada');
        this.load();
      },
      error: (err) => this.toastService.error(err?.error?.message || 'No se pudo guardar')
    });
  }

  deleteTask(id: string): void {
    Swal.fire({ reverseButtons: true, focusCancel: true,
      title: '¿Eliminar tarea?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.taskService.delete(id).subscribe({
        next: () => {
          this.toastService.success('Tarea eliminada');
          this.load();
        },
        error: (err) => this.toastService.error(err?.error?.message || 'No se pudo eliminar')
      });
    });
  }

  drop(event: CdkDragDrop<TaskItem[]>): void {
    const to = this.columns.find((c) => c.tasks === event.container.data)!;
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const task = event.previousContainer.data[event.previousIndex];
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    // 🎨 Actualiza el color de la tarea al color de la columna destino
    task.color = to.color;

    this.taskService.changeStatus(task.id, to.key).subscribe({
      next: () => {
        task.status = to.key;
        this.toastService.info(`Tarea movida a ${to.label}`);
      },
      error: () => {
        this.toastService.error('No se pudo actualizar el estado');
        this.load();
      }
    });
  }
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/**
 * La duración sigue a las fechas: con inicio y fin se calcula sola (09:00–11:00 → 120)
 * y, si se escribe la duración con un inicio puesto, se mueve el fin.
 */
function enlazarDuracion(popup: HTMLElement): void {
  const inicio = popup.querySelector('#tk-start') as HTMLInputElement | null;
  const fin = popup.querySelector('#tk-end') as HTMLInputElement | null;
  const duracion = popup.querySelector('#tk-duration') as HTMLInputElement | null;
  if (!inicio || !fin || !duracion) return;
  const desdeFechas = () => {
    if (!inicio.value || !fin.value) return;
    const min = Math.round((new Date(fin.value).getTime() - new Date(inicio.value).getTime()) / 60000);
    if (min > 0) duracion.value = String(min);
  };
  inicio.addEventListener('change', desdeFechas);
  fin.addEventListener('change', desdeFechas);
  duracion.addEventListener('change', () => {
    const min = Number(duracion.value);
    if (!inicio.value || !(min > 0)) return;
    fin.value = toLocalInput(new Date(new Date(inicio.value).getTime() + min * 60000).toISOString());
  });
  desdeFechas();
}

function toLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}