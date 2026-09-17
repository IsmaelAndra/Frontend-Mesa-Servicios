import { Component, OnInit } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import Swal from 'sweetalert2';
import { TaskService } from '../../../core/services/task.service';
import { AdminService } from '../../../core/services/admin.service';
import { TaskItem, TaskRequest, TaskStatus, KANBAN_STATUSES } from '../../../models/task.model';
import { User } from '../../../models/user.model';

@Component({
  selector: 'app-kanban',
  templateUrl: './kanban.component.html',
  styleUrls: ['./kanban.component.css']
})
export class KanbanComponent implements OnInit {
  columns: { key: TaskStatus; label: string; color: string; tasks: TaskItem[] }[] = [];
  agents: User[] = [];
  loading = true;
  dragging = false;

  constructor(
    private taskService: TaskService,
    private adminService: AdminService
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
        Swal.fire('Error', 'No se pudieron cargar las tareas', 'error');
      }
    });
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

  private openModal(task: TaskItem | null): void {
    const editing = !!task;
    const agentOptions = this.agents
      .map(
        (a) =>
          `<option value="${a.idUser}"${task && task.assignedUserId === a.idUser ? ' selected' : ''
          }>${escHtml(a.corporateEmailUser)}</option>`
      )
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
            <select id="tk-assigned" class="swal-daisy-input">${agentOptions}</select>
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
        confirmButton: 'btn btn-primary btn-sm',
        cancelButton: 'btn btn-ghost btn-sm',
        denyButton: 'btn btn-error btn-sm'
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
        const assigned = (popup?.querySelector('#tk-assigned') as HTMLSelectElement)?.value ?? '';
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
          assignedUserId: Number(assigned),
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

  private saveTask(id: number | null, data: TaskRequest): void {
    const call = id ? this.taskService.update(id, data) : this.taskService.create(data);
    call.subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Tarea guardada',
          timer: 1200,
          showConfirmButton: false
        });
        this.load();
      },
      error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo guardar', 'error')
    });
  }

  deleteTask(id: number): void {
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
          Swal.fire({
            icon: 'success',
            title: 'Eliminada',
            timer: 1000,
            showConfirmButton: false
          });
          this.load();
        },
        error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo eliminar', 'error')
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
        Swal.fire({
          icon: 'success',
          title: `Movida a ${to.label}`,
          timer: 800,
          showConfirmButton: false
        });
      },
      error: () => {
        Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
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