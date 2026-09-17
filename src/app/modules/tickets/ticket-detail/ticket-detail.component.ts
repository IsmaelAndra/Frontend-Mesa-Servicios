import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import Quill from 'quill';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { TicketService } from '../../../core/services/ticket.service';
import { Ticket, Answer, Attach, AuditLog, Rating } from '../../../models/ticket.model';
import { User } from '../../../models/user.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-ticket-detail',
  templateUrl: './ticket-detail.component.html'
})
export class TicketDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  ticketId!: number;
  ticket?: Ticket;
  answers: Answer[] = [];
  audit: AuditLog[] = [];
  agents: User[] = [];
  statuses = ['NUEVO', 'ASIGNADO', 'EN_PROCESO', 'RESUELTO', 'CERRADO', 'ESCALADO'];
  message = new FormControl('');
  rating?: Rating;
  userRole = '';
  currentUserEmail = '';
  quill: any;
  attachments: Attach[] = [];
  messageFiles: File[] = [];
  internalMessage = false;
  file?: File;

  constructor(
    private route: ActivatedRoute,
    private ticketService: TicketService,
    private adminService: AdminService,
    private authService: AuthService
  ) {
    this.userRole = this.authService.getRole();
    this.currentUserEmail = this.authService.getEmail();
  }

  ngOnDestroy(): void {
    if (this.quill) {
      if (typeof this.quill.destroy === 'function') {
        this.quill.destroy();
      }
      this.quill = null;
    }
  }

  ngOnInit(): void {
    this.ticketId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
    if (this.canManage && (this.userRole === 'ADMIN' || this.userRole === 'SUPER_ADMIN' || this.userRole === 'AGENT')) {
      this.adminService.agents().subscribe({ next: (a) => (this.agents = a) });
    }
  }

  ngAfterViewInit(): void {
    // El editor Quill se inicializa cuando el ticket ya está en el DOM (ver load()).
    this.initQuill();
  }

  private initQuill(): void {
    if (this.quill) return;
    const host = document.querySelector('#quillEditorDetail');
    if (!host) return;
    this.quill = new Quill(host as HTMLElement, {
      theme: 'snow',
      placeholder: 'Escriba una respuesta... (puede incluir imágenes)',
      modules: {
        toolbar: {
          container: [
            [{ header: [false, 1, 2, 3] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['blockquote'],
            ['link', 'image'],
            ['clean']
          ],
          handlers: {
            image: () => this.onEditorImage()
          }
        }
      }
    });
    this.quill.on('text-change', () => {
      this.message.setValue(this.quill.root.innerHTML);
    });
  }

  onEditorImage(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const range = this.quill.getSelection(true);
        const index = range ? range.index : this.quill.getLength();
        this.quill.insertEmbed(index, 'image', e.target?.result, 'user');
        this.quill.setSelection(index + 1, 0);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  load(): void {
    this.ticketService.getById(this.ticketId).subscribe({
      next: (t) => {
        this.ticket = t;
        this.loadAnswers();
        this.loadAttachments();
        this.loadAudit();
        if (t.status === 'RESUELTO' || t.status === 'CERRADO') {
          this.loadRating();
        }
        // El *ngIf="ticket" ya renderizó el editor: inicializar Quill ahora.
        setTimeout(() => this.initQuill());
      },
      error: () => Swal.fire('Error', 'Ticket no encontrado', 'error')
    });
  }

  private loadAnswers(): void {
    this.ticketService.answers(this.ticketId).subscribe({ next: (a) => (this.answers = a) });
  }

  private loadAttachments(): void {
    this.ticketService.attachments(this.ticketId).subscribe({ next: (a) => (this.attachments = a) });
  }

  private loadAudit(): void {
    this.ticketService.audit(this.ticketId).subscribe({ next: (a) => (this.audit = a) });
  }

  private loadRating(): void {
    this.ticketService.getRating(this.ticketId).subscribe({
      next: (r) => (this.rating = r),
      error: () => undefined
    });
  }

  get canManage(): boolean {
    return this.userRole === 'ADMIN' || this.userRole === 'SUPER_ADMIN' || this.userRole === 'AGENT';
  }

  get canRate(): boolean {
    return this.userRole === 'USER'
      && (this.ticket?.status === 'RESUELTO' || this.ticket?.status === 'CERRADO')
      && !this.rating;
  }

  get ticketFiles(): Attach[] {
    return this.attachments.filter((a) => !a.answerId);
  }

  get hasMessage(): boolean {
    const text = (this.message.value || '').toString();
    return !!(text && text.replace(/<\/?[^>]+(>|$)/g, '').trim());
  }

  isMine(a: Answer): boolean {
    return !!a.user && a.user === this.currentUserEmail;
  }

  authorLabel(a: Answer): string {
    if (this.isMine(a)) {
      return 'Tú';
    }
    if (a.user === this.ticket?.user) {
      return `${a.user} (Solicitante)`;
    }
    return `${a.user} (Agente)`;
  }

  attachUrl(a: Attach): string {
    const name = a.storagePathAttach.split(/[\\/]/).pop() || a.fileNameAttach;
    return `${environment.apiUrl}/uploads/${name}`;
  }

  messageFilesOf(answerId: number): Attach[] {
    return this.attachments.filter((a) => a.answerId === answerId);
  }

  onMessageFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.messageFiles = Array.from(input.files || []);
    input.value = '';
  }

  removeMessageFile(i: number): void {
    this.messageFiles.splice(i, 1);
  }

  sendAnswer(): void {
    const text = (this.message.value || '').toString();
    if (!text || !text.replace(/<\/?[^>]+(>|$)/g, '').trim()) return;
    const files = [...this.messageFiles];
    const internal = this.internalMessage && this.canManage;
    this.ticketService.addAnswer(this.ticketId, { message: text, internal }).subscribe({
      next: (created) => {
        this.message.setValue('');
        if (this.quill) this.quill.setContents([]);
        this.messageFiles = [];
        this.internalMessage = false;
        this.loadAnswers();
        this.loadAttachments();
        if (files.length) {
          this.uploadMessageFiles(files, created.idAnswer);
        }
        Swal.fire({ icon: 'success', title: 'Respuesta enviada', timer: 1200, showConfirmButton: false });
      },
      error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo enviar', 'error')
    });
  }

  private uploadMessageFiles(files: File[], answerId: number): void {
    files.forEach((f, i) => {
      setTimeout(() => {
        this.ticketService.uploadAttachment(this.ticketId, f, answerId).subscribe({
          next: () => this.loadAttachments(),
          error: () => Swal.fire('Aviso', `No se pudo adjuntar ${f.name}`, 'warning')
        });
      }, i * 300 + 300);
    });
  }

  changeStatus(statusName: string): void {
    this.ticketService.changeStatus(this.ticketId, statusName).subscribe({
      next: () => {
        this.load();
        Swal.fire({ icon: 'success', title: `Estado: ${statusName}`, timer: 1400, showConfirmButton: false });
      },
      error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo cambiar el estado', 'error')
    });
  }

  assign(agentId: number | string): void {
    this.ticketService.assign(this.ticketId, Number(agentId)).subscribe({
      next: () => {
        this.load();
        Swal.fire({ icon: 'success', title: 'Ticket asignado', timer: 1400, showConfirmButton: false });
      },
      error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo asignar', 'error')
    });
  }

  async rateTicket(): Promise<void> {
    const { value: formValues } = await Swal.fire({
      title: 'Calificar ticket',
      html: `
        <div class="text-left space-y-2 text-sm">
          <label>Requerimientos cumplidos (1-5)</label>
          <input id="req" type="number" min="1" max="5" value="5" class="input input-bordered input-sm w-full"/>
          <label>Tiempo de respuesta (1-5)</label>
          <input id="respt" type="number" min="1" max="5" value="5" class="input input-bordered input-sm w-full"/>
          <label>Calidad de resolución (1-5)</label>
          <input id="qual" type="number" min="1" max="5" value="5" class="input input-bordered input-sm w-full"/>
          <label>Comunicación del agente (1-5)</label>
          <input id="comm" type="number" min="1" max="5" value="5" class="input input-bordered input-sm w-full"/>
          <label>Satisfacción general (1-5)</label>
          <input id="sat" type="number" min="1" max="5" value="5" class="input input-bordered input-sm w-full"/>
          <label>Comentarios</label>
          <textarea id="comments" class="textarea textarea-bordered textarea-sm w-full"></textarea>
        </div>`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Guardar calificación',
      preConfirm: () => {
        const g = (i: string) => Number((Swal.getPopup()!.querySelector(`#${i}`) as HTMLInputElement).value);
        return {
          requirementsMet: g('req'),
          allRequirementsMet: g('req') === 5,
          responseTimeRating: g('respt'),
          resolutionQuality: g('qual'),
          agentCommunication: g('comm'),
          overallSatisfaction: g('sat'),
          comments: (Swal.getPopup()!.querySelector('#comments') as HTMLTextAreaElement).value
        };
      }
    });

    if (formValues) {
      this.ticketService.rate(this.ticketId, formValues).subscribe({
        next: () => {
          this.loadRating();
          Swal.fire({ icon: 'success', title: '¡Gracias por calificar!', timer: 1500, showConfirmButton: false });
        },
        error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo calificar', 'error')
      });
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0];
  }

  upload(): void {
    if (!this.file) return;
    this.ticketService.uploadAttachment(this.ticketId, this.file).subscribe({
      next: () => {
        this.file = undefined;
        this.loadAttachments();
        Swal.fire({ icon: 'success', title: 'Archivo subido', timer: 1200, showConfirmButton: false });
      },
      error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo subir', 'error')
    });
  }
}