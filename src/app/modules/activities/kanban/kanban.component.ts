import { Component, OnInit } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import Swal from 'sweetalert2';
import { TaskService } from '../../../core/services/task.service';
import { AdminService, AssignableAgent } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { TaskItem, TaskRequest, TaskStatus, KANBAN_STATUSES } from '../../../models/task.model';
import { User } from '../../../models/user.model';
import { ToastService } from '../../../core/services/toast.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-kanban',
  templateUrl: './kanban.component.html',
  styleUrls: ['./kanban.component.css']
})
export class KanbanComponent implements OnInit {
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
    private authService: AuthService
  ) { }

  ngOnInit(): void {
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
    return /^https?:\/\//i.test(url) ? url : `${environment.apiUrl}${url}`;
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
  private opcionesDeAsignado(): AssignableAgent[] {
    const lista = [...this.agents];
    const yo = this.currentUser();
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
    const opciones = this.opcionesDeAsignado();
    const preseleccionado = task
      ? task.assignedUserId
      : (this.currentUser()?.idUser ?? opciones[0]?.idUser ?? null);

    const agentOptions = opciones
      .map((a) => {
        const selected = preseleccionado != null && a.idUser === preseleccionado;
        const url = a.photoUrl
          ? /^https?:\/\//i.test(a.photoUrl)
            ? a.photoUrl
            : `${environment.apiUrl}${a.photoUrl}`
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

    Swal.fire({
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
          <div>
            <label class="block text-sm font-medium mb-1">Duración (min)</label>
            <input id="tk-duration" type="number" min="1" class="swal-daisy-input" value="${task?.durationMinutes ?? 5
        }" />
          </div>
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
        const duration =
          Number((popup?.querySelector('#tk-duration') as HTMLInputElement)?.value) || undefined;
        return {
          title,
          description:
            (popup?.querySelector('#tk-desc') as HTMLTextAreaElement)?.value.trim() || undefined,
          assignedUserId: assigned,
          start: start ? new Date(start).toISOString() : undefined,
          due: due ? new Date(due).toISOString() : undefined,
          durationMinutes: duration
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
    Swal.fire({
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