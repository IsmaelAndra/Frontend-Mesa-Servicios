import { markdownToHtml } from '../../../core/utils/markdown.util';
import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Quill from 'quill';
import { AdminService } from '../../../core/services/admin.service';
import { TicketService } from '../../../core/services/ticket.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Catalog } from '../../../models/user.model';
import { AiTicketFill } from '../../shared/components/ai-float-button/ai-float-button.component';
import { MasterOption } from '../../shared/components/master-select/master-select.component';

@Component({
  selector: 'app-ticket-new',
  templateUrl: './ticket-new.component.html'
})
export class TicketNewComponent implements OnInit, OnDestroy, AfterViewInit {
  form: FormGroup;
  loading = false;
  categories: { id: string; name: string; teamId: string | null; icon?: string; color?: string; areaId?: string | null }[] = [];
  /** Áreas que atienden tickets (las que tienen al menos una categoría). */
  areasQueAtienden: { id: string; name: string; icon?: string; color?: string }[] = [];
  /** Categorías del área elegida; se recalcula al cambiar de área, no en un getter. */
  categoriasDelArea: { id: string; name: string; teamId: string | null; icon?: string; color?: string; areaId?: string | null }[] = [];
  ticketTypes: { id: string; name: string; icon?: string; color?: string }[] = [];
  priorities: { id: string; name: string; level: number; icon?: string; color?: string }[] = [];
  /** Sucursal donde se reporta el problema. Opcional: si no se elige, el backend
   * hereda la del solicitante. */
  sucursales: { id: string; code: string; name: string; icon?: string; color?: string }[] = [];
  files: File[] = [];
  userRole = '';
  quill: Quill | null = null;

  /** Solicitante cuando el personal abre el ticket a nombre de otra persona. */
  aNombreDe: { id: string; nombre: string; correo: string } | null = null;

  /** Quitar la persona elegida: el ticket vuelve a ser propio. */
  quitarSolicitante(): void {
    this.aNombreDe = null;
    this.router.navigate([], { queryParams: {} , replaceUrl: true });
  }

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private ticketService: TicketService,
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    route: ActivatedRoute
  ) {
    this.userRole = this.authService.getRole();
    // Ticket a nombre de otra persona (desde la búsqueda global). Solo el
    // personal: el backend lo vuelve a comprobar y responde 403 a un solicitante.
    const q = route.snapshot.queryParamMap;
    if (q.get('solicitante') && ['AGENT', 'AREA_MANAGER', 'SUPER_ADMIN'].includes(this.userRole ?? '')) {
      this.aNombreDe = {
        id: q.get('solicitante')!,
        nombre: q.get('nombre') || q.get('correo') || 'otra persona',
        correo: q.get('correo') || '',
      };
    }
    const controls: Record<string, unknown> = {
      title: ['', [Validators.required, noSoloEspacios, Validators.maxLength(255)]],
      description: ['', Validators.required],
      areaDestinoId: [null, Validators.required],
      confidencial: [false],
      categoryId: [null],
      typeId: [null],
      priorityId: [null],
      sucursalId: [null]
    };
    if (!this.isUser) {
      controls['categoryId'] = [null, Validators.required];
    }
    this.form = this.fb.group(controls);
  }

  get isUser(): boolean {
    return this.userRole === 'USER';
  }

  /**
   * Contexto para el asistente IA flotante: el usuario explica el problema en el
   * chat y la IA responde con la información del ticket (JSON) para prellenar el
   * formulario; el usuario solo revisa y presiona Enviar.
   */
  get aiContext(): string {
    // Se le pasan los catálogos REALES: sin ellos la IA adivinaba un nombre
    // genérico y siempre caía en "Soporte Técnico", MEDIA e INCIDENTE.
    const nombres = (l: { name: string }[]) => (l || []).map((x) => x.name).join(', ') || '(sin datos)';
    // "Correo (Problemas con correo corporativo)": con la descripción que el
    // administrador escribe en cada categoría y tipo, la IA elige la específica.
    const conDescripcion = (l: { name: string; description?: string }[]) =>
      (l || []).map((x) => (x.description ? `${x.name} (${x.description})` : x.name)).join('; ') || '(sin datos)';
    return 'Estás ayudando a crear un NUEVO ticket de la mesa de servicios COAC. '
      + 'Haz al usuario preguntas cortas para reunir: título breve del problema, descripción '
      + 'detallada (qué pasó, desde cuándo, qué se intentó, a cuántas personas o agencias afecta). '
      + 'Con esa información decide tú la categoría, el tipo y la prioridad; no se los preguntes al usuario. '
      + `Categorías permitidas: ${conDescripcion(this.categories)}. Elige la MÁS ESPECÍFICA que encaje `
      + '(por ejemplo, un problema de correo o de su contraseña va en la de correo, no en una genérica); '
      + 'usa una genérica solo si ninguna otra corresponde. '
      + `Tipos permitidos: ${conDescripcion(this.ticketTypes)}. `
      + `Prioridades permitidas: ${nombres(this.priorities)}. CRITICA = cae un sistema core, una agencia `
      + 'entera sin servicio o hay riesgo de fraude o seguridad; ALTA = un área o varias personas no pueden '
      + 'trabajar; MEDIA = una persona afectada o hay alternativa; BAJA = consulta o algo que puede esperar. '
      + 'Cuando tengas la información suficiente, confirma en español que el formulario quedó '
      + 'prellenado y que el usuario debe revisar y presionar ENVIAR para crear el ticket. '
      + 'Además, al final de tu respuesta añade un bloque JSON entre ```json y ``` con la forma: '
      + '{"titulo": "texto breve", "descripcion": "descripción completa en markdown", '
      + '"categoria": "una categoría permitida", "tipo": "un tipo permitido", "prioridad": "una prioridad permitida"}. '
      + 'Escribe categoría, tipo y prioridad exactamente como aparecen en las listas. '
      + 'No inventes datos que el usuario no haya confirmado. El JSON debe ser válido, de una sola '
      + 'línea, y la descripción no debe contener llaves ni comillas dobles literales.';
  }

  /** Pinta en el formulario los datos sugeridos por la IA. */
  fillFromAi(d: AiTicketFill): void {
    if (d.titulo) {
      this.form.patchValue({ title: d.titulo });
    }
    if (d.descripcion) {
      // La descripción la redacta la IA a partir de lo que escribió el usuario, así
      // que puede traer HTML inyectado. markdownToHtml escapa antes de convertir;
      // el conversor local que había aquí no lo hacía y el resultado iba directo
      // al innerHTML del editor.
      const html = markdownToHtml(d.descripcion);
      this.form.patchValue({ description: html });
      if (this.quill) {
        this.quill.root.innerHTML = html;
      }
    }
    this.matchSelect(d.categoria, this.categories, 'categoryId');
    this.matchSelect(d.tipo, this.ticketTypes, 'typeId');
    this.matchSelect(d.prioridad, this.priorities, 'priorityId');
    if (d.titulo || d.descripcion) {
      this.toastService.info(
        'Ticket prellenado',
        'Revisa la información y presiona Enviar para crear el ticket.'
      );
    }
  }

  private matchSelect(value: string | undefined, options: { id: string; name: string }[], control: string): void {
    if (!value) return;
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const target = norm(value);
    const opt = options.find((o) => norm(o.name) === target)
      || options.find((o) => norm(o.name).includes(target) || target.includes(norm(o.name)));
    if (opt) {
      this.form.patchValue({ [control]: opt.id });
    }
  }

  /** Filtra las categorías por el área elegida y suelta la categoría si era de otra. */
  alCambiarArea(): void {
    const area = this.form.get('areaDestinoId')?.value as string | null;
    this.categoriasDelArea = this.categories.filter((c) => !area || c.areaId === area);
    const cat = this.form.get('categoryId')?.value as string | null;
    if (cat && !this.categoriasDelArea.some((c) => c.id === cat)) {
      this.form.patchValue({ categoryId: null });
    }
  }

  /** Si se elige (o MAPI propone) una categoría de otra área, el área la sigue. */
  private alCambiarCategoria(id: string | null): void {
    const area = this.categories.find((c) => c.id === id)?.areaId;
    if (area && area !== this.form.get('areaDestinoId')?.value) {
      this.form.patchValue({ areaDestinoId: area }, { emitEvent: false });
      this.alCambiarArea();
    }
  }

  ngOnInit(): void {
    this.form.get('categoryId')?.valueChanges.subscribe((id) => this.alCambiarCategoria(id));
    this.adminService.catalog().subscribe({
      next: (c: Catalog) => {
        this.categories = c.categories;
        const conCategoria = new Set(this.categories.map((x) => x.areaId).filter(Boolean));
        this.areasQueAtienden = (c.areas || []).filter((a) => a.status !== false && conCategoria.has(a.id));
        // Casi todo lo que llega es de Tecnología: se propone por defecto.
        const tecnologia = this.areasQueAtienden.find((a) => (a.name || '').toLowerCase().startsWith('tecnolog')) ?? this.areasQueAtienden[0];
        if (tecnologia && !this.form.get('areaDestinoId')?.value) {
          this.form.patchValue({ areaDestinoId: tecnologia.id });
        }
        this.alCambiarArea();
        this.ticketTypes = c.ticketTypes || [];
        this.priorities = c.priorities || [];
          this.sucursales = c.sucursales || [];
        // Prioridad MEDIA por defecto: casi todo lo es, y la persona (o MAPI, si
        // la automatización está activa) la cambia si hace falta.
        const media = this.priorities.find((p) => (p.name || '').trim().toUpperCase() === 'MEDIA');
        if (media && !this.form.get('priorityId')?.value) {
          this.form.patchValue({ priorityId: media.id });
        }
        // Borrador de MAPI preparado en otra pantalla ("Crear ticket con este
        // borrador"): se aplica cuando ya están los catálogos para casar valores.
        const borrador = (typeof history !== 'undefined' ? history.state?.borradorMapi : null) as AiTicketFill | null;
        if (borrador) {
          this.fillFromAi(borrador);
          this.toastService.info('Revise el borrador de MAPI y pulse Crear ticket para registrarlo.', 'Borrador cargado');
        }
      },
      error: () => this.toastService.warn('No se pudieron cargar los catálogos')
    });
    // Sucursal de la persona por defecto (se puede cambiar). No aplica cuando el
    // personal abre el ticket a nombre de otra persona: su sucursal puede ser otra.
    if (!this.aNombreDe) {
      this.authService.me().subscribe({
        next: (u) => {
          if (u?.sucursalId && !this.form.get('sucursalId')?.value) {
            this.form.patchValue({ sucursalId: u.sucursalId });
          }
        },
        error: () => undefined,
      });
    }
  }

  /**
   * Convierte un maestro de la BD en opciones de app-master-select.
   *
   * El componente pide {value,label,icon,color} y los maestros traen
   * {id,name,icon,color}, asi que se traduce una vez aqui en vez de repetir el
   * mapeo en cada plantilla.
   */
  masterOptions(
    list: { id: string; name: string; icon?: string; color?: string }[] | undefined
  ): MasterOption[] {
    return (list || []).map((x) => ({
      value: x.id,
      label: x.name,
      icon: x.icon,
      color: x.color
    }));
  }

  ngAfterViewInit(): void {
    const quill = new Quill('#quillEditorNew', {
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
    this.quill = quill;
    quill.on('text-change', () => {
      this.form.get('description')?.setValue(quill.root.innerHTML);
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
        const quill = this.quill;
        if (!quill) return;
        const range = quill.getSelection(true);
        const index = range ? range.index : quill.getLength();
        quill.insertEmbed(index, 'image', e.target?.result, 'user');
        quill.setSelection(index + 1, 0);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  ngOnDestroy(): void {
    if (this.quill) {
      // Quill 2 no declara destroy en sus tipos; algunas builds lo traen.
      const conDestroy = this.quill as unknown as { destroy?: () => void };
      if (typeof conDestroy.destroy === 'function') {
        conDestroy.destroy();
      }
      this.quill = null;
    }
  }

  /**
   * Añade lo elegido o soltado en la zona de adjuntos. Se suma a lo que ya
   * había (antes, elegir otra vez reemplazaba la lista) y sin repetir archivos.
   */
  agregarArchivos(nuevos: File[]): void {
    const grandes = nuevos.filter(f => f.size > MAX_BYTES_ADJUNTO);
    if (grandes.length) {
      this.toastService.warn(`Supera 20 MB y no se adjunta: ${grandes.map(f => f.name).join(', ')}`);
    }
    const clave = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;
    const ya = new Set(this.files.map(clave));
    const validos = nuevos.filter(f => f.size <= MAX_BYTES_ADJUNTO && !ya.has(clave(f)));
    this.files = [...this.files, ...validos];
  }

  avisarRechazados(nombres: string[]): void {
    this.toastService.warn(`Tipo de archivo no permitido: ${nombres.join(', ')}`);
  }

  tamanoLegible(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  iconoArchivo(nombre: string): string {
    const ext = nombre.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'fa-regular fa-file-image';
    if (ext === 'pdf') return 'fa-regular fa-file-pdf';
    if (['doc', 'docx'].includes(ext)) return 'fa-regular fa-file-word';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'fa-regular fa-file-excel';
    if (['ppt', 'pptx'].includes(ext)) return 'fa-regular fa-file-powerpoint';
    if (ext === 'zip') return 'fa-regular fa-file-zipper';
    return 'fa-regular fa-file-lines';
  }

  removeFile(i: number): void {
    this.files = this.files.filter((_, j) => j !== i);
  }

  submit(): void {
    if (this.form.invalid) {
      // Se marcan todos para que cada campo enseñe su mensaje, y el aviso dice
      // cuáles faltan en lugar de un genérico.
      this.form.markAllAsTouched();
      const faltan = [
        this.form.get('title')?.invalid ? 'título' : '',
        this.form.get('description')?.invalid ? 'descripción' : '',
        this.form.get('areaDestinoId')?.invalid ? 'área que atiende' : '',
        this.form.get('categoryId')?.invalid ? 'categoría' : '',
      ].filter(Boolean);
      this.toastService.warn(`Falta completar: ${faltan.join(', ') || 'campos obligatorios'}`);
      return;
    }
    const description = this.form.value.description;
    if (!description || !String(description).replace(/<\/?[^>]+(>|$)/g, '').trim()) {
      this.toastService.warn('Complete la descripción del problema');
      return;
    }
    this.loading = true;
    const payload = {
      title: String(this.form.value.title).trim(),
      description,
      categoryId: this.form.value.categoryId ?? undefined,
      areaDestinoId: this.form.value.areaDestinoId ?? undefined,
      confidencial: !!this.form.value.confidencial,
      typeId: this.form.value.typeId ?? undefined,
      priorityId: this.form.value.priorityId ?? undefined,
      // Solo cuenta como elegida si la persona tocó el selector (no la MEDIA
      // por defecto ni la que propuso el asistente).
      priorityManual: !!this.form.get('priorityId')?.dirty && !!this.form.value.priorityId,
      sucursalId: this.form.value.sucursalId ?? undefined,
      requesterId: this.aNombreDe?.id
    };
    this.ticketService.create(payload).subscribe({
      next: (t) => {
        this.uploadFilesAfterCreate(t.idTicket);
        // Se avisa de la revisión: si MAPI o el personal ajustan la categoría o
        // el tipo, que no parezca un cambio sin motivo.
        this.toastService.success(
          'Revisaremos que la categoría, la prioridad y el tipo sean correctos y los ajustaremos si hace falta.'
            + (payload.priorityManual ? ' La prioridad que elegiste se respeta.' : ''),
          `Ticket #${t.numberTicket ?? ''} creado`,
          { duration: 9000 },
        );
        this.router.navigate(['/tickets', t.idTicket]);
      },
      error: (err) => {
        this.loading = false;
        this.toastService.error(err?.error?.message || 'No se pudo crear el ticket');
      }
    });
  }

  private uploadFilesAfterCreate(ticketId: string): void {
    this.files.forEach((f, i) => {
      setTimeout(() => {
        this.ticketService.uploadAttachment(ticketId, f).subscribe({
          error: () => this.toastService.warn(`No se pudo subir ${f.name}`)
        });
      }, i * 300 + 500);
    });
    this.files = [];
  }
}

/** Igual que spring.servlet.multipart.max-file-size del backend. */
const MAX_BYTES_ADJUNTO = 20 * 1024 * 1024;

/** Un título hecho solo de espacios no es un título (habilitaba "Crear"). */
function noSoloEspacios(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  return typeof v === 'string' && v.length > 0 && !v.trim() ? { soloEspacios: true } : null;
}
