import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import Quill from 'quill';
import Swal from 'sweetalert2';
import { AdminService } from '../../../core/services/admin.service';
import { TicketService } from '../../../core/services/ticket.service';
import { AuthService } from '../../../core/services/auth.service';
import { Catalog } from '../../../models/user.model';

@Component({
  selector: 'app-ticket-new',
  templateUrl: './ticket-new.component.html'
})
export class TicketNewComponent implements OnInit, OnDestroy, AfterViewInit {
  form: FormGroup;
  loading = false;
  categories: { id: number; name: string; teamId: number | null }[] = [];
  ticketTypes: { id: number; name: string }[] = [];
  priorities: { id: number; name: string; level: number }[] = [];
  files: File[] = [];
  userRole = '';
  quill: any;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private ticketService: TicketService,
    private authService: AuthService,
    private router: Router
  ) {
    this.userRole = this.authService.getRole();
    const controls: Record<string, unknown> = {
      title: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['', Validators.required],
      categoryId: [null],
      typeId: [null],
      priorityId: [null]
    };
    if (!this.isUser) {
      controls['categoryId'] = [null, Validators.required];
    }
    this.form = this.fb.group(controls);
  }

  get isUser(): boolean {
    return this.userRole === 'USER';
  }

  ngOnInit(): void {
    this.adminService.catalog().subscribe({
      next: (c: Catalog) => {
        this.categories = c.categories;
        this.ticketTypes = c.ticketTypes || [];
        this.priorities = c.priorities || [];
      },
      error: () => Swal.fire('Aviso', 'No se pudieron cargar los catálogos', 'warning')
    });
  }

  ngAfterViewInit(): void {
    this.quill = new Quill('#quillEditorNew', {
      theme: 'snow',
      placeholder: 'Describa el problema detalladamente. Puede adjuntar imágenes aquí mismo.',
      modules: {
        toolbar: {
          container: [
            [{ header: [false, 1, 2, 3] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['blockquote', 'code-block'],
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
      this.form.get('description')?.setValue(this.quill.root.innerHTML);
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

  ngOnDestroy(): void {
    if (this.quill) {
      if (typeof this.quill.destroy === 'function') {
        this.quill.destroy();
      }
      this.quill = null;
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.files = Array.from(input.files || []);
    input.value = '';
  }

  removeFile(i: number): void {
    this.files.splice(i, 1);
  }

  submit(): void {
    if (this.form.invalid) {
      Swal.fire('Atención', 'Complete los campos obligatorios', 'warning');
      return;
    }
    const description = this.form.value.description;
    if (!description || !String(description).replace(/<\/?[^>]+(>|$)/g, '').trim()) {
      Swal.fire('Atención', 'Complete la descripción del problema', 'warning');
      return;
    }
    this.loading = true;
    const payload = {
      title: this.form.value.title,
      description,
      categoryId: this.form.value.categoryId ?? undefined,
      typeId: this.form.value.typeId ?? undefined,
      priorityId: this.form.value.priorityId ?? undefined
    };
    this.ticketService.create(payload).subscribe({
      next: (t) => {
        this.uploadFilesAfterCreate(t.idTicket);
        Swal.fire({ icon: 'success', title: 'Ticket creado', text: `Ticket #${t.idTicket}`, timer: 1500, showConfirmButton: false });
        this.router.navigate(['/tickets', t.idTicket]);
      },
      error: (err) => {
        this.loading = false;
        Swal.fire('Error', err?.error?.message || 'No se pudo crear el ticket', 'error');
      }
    });
  }

  private uploadFilesAfterCreate(ticketId: number): void {
    this.files.forEach((f, i) => {
      setTimeout(() => {
        this.ticketService.uploadAttachment(ticketId, f).subscribe({
          error: () => Swal.fire('Aviso', `No se pudo subir ${f.name}`, 'warning')
        });
      }, i * 300 + 500);
    });
    this.files = [];
  }
}