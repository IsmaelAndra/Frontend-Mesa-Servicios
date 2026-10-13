import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { REGLAS_DESTINATARIO, TIPOS_PLANTILLA, opcionEventoPlantilla } from '../../../core/utils/opciones-select.util';
import { MasterOption } from '../../shared/components/master-select/master-select.component';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import Swal from 'sweetalert2';
import { AdminService, NotificationTemplate } from '../../../core/services/admin.service';
import { Paginacion } from '../../../core/utils/pagination.util';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-template-management',
  templateUrl: './template-management.component.html'
})
export class TemplateManagementComponent implements OnInit {
  @ViewChild('nuevoBody') nuevoBody?: ElementRef<HTMLTextAreaElement>;

  templates: NotificationTemplate[] = [];

  /** Paginacion en cliente: el endpoint devuelve la lista completa. */
  readonly pagTemplates = new Paginacion<NotificationTemplate>(() => this.templates);
  loading = false;
  showNew = false;
  showEdit = false;
  newTemplate: Partial<NotificationTemplate> = { activeTemplate: true, recipientRule: 'DEFAULT' };
  editingTemplate: Partial<NotificationTemplate> = {};
  previewTemplate: NotificationTemplate | null = null;
  logoUrl = '';

  types = ['TICKET', 'RATING', 'SLA', 'EVAL', 'TASK', 'CUENTA'];

  recipientRules = [
    { value: 'DEFAULT', label: 'Quien dispara el evento' },
    { value: 'SOLICITANTE', label: 'Dueño del ticket (solicitante)' },
    { value: 'AGENTE', label: 'Agente asignado' },
    { value: 'AMBOS', label: 'Solicitante y agente' },
    { value: 'CUSTOM', label: 'Correo personalizado' }
  ];

  triggerLabels: Record<string, string> = {
    TICKET_CREADO: 'Al crear un ticket',
    TICKET_ASIGNADO: 'Al asignar un agente',
    TICKET_ACTUALIZADO: 'Al actualizar el ticket',
    TICKET_RESUELTO: 'Al resolver el ticket',
    TICKET_CERRADO: 'Al cerrar el ticket',
    RATING_REQUEST: 'Al solicitar calificación',
    SLA_WARNING: 'SLA al 80%',
    SLA_BREACHED: 'SLA vencido',
    ESCALATION: 'Al escalar un ticket',
    MONTHLY_EVALUATION: 'Al generar la evaluación mensual',
    TASK_ASIGNADA: 'Al asignar una tarea',
    CREACION_USUARIO: 'Al crear una cuenta de usuario',
    RESET_PASSWORD: 'Al restablecer la contraseña'
  };

  /**
   * Eventos del sistema. El nombre de la plantilla ES la clave del evento que
   * dispara el envío, por eso solo una fila puede atender cada evento: si se
   * elige un evento existente se sobrescribe su texto.
   */
  readonly systemEvents = Object.keys(this.triggerLabels);

  /** Opciones con icono y color para los selects del formulario. */
  readonly opcionesEvento: MasterOption[] = this.systemEvents.map((e) => opcionEventoPlantilla(e, this.triggerLabels[e]));
  readonly tiposPlantilla = TIPOS_PLANTILLA;
  readonly reglasDestinatario = REGLAS_DESTINATARIO;

  /** Icono y color por defecto según el evento elegido. */
  private eventDefaults: Record<string, { icon: string; color: string; type: string }> = {
    TICKET_CREADO: { icon: 'fa-solid fa-ticket', color: '#2563EB', type: 'TICKET' },
    TICKET_ASIGNADO: { icon: 'fa-solid fa-user-check', color: '#0E7490', type: 'TICKET' },
    TICKET_ACTUALIZADO: { icon: 'fa-solid fa-arrows-rotate', color: '#4F46E5', type: 'TICKET' },
    TICKET_RESUELTO: { icon: 'fa-solid fa-circle-check', color: '#16A34A', type: 'TICKET' },
    TICKET_CERRADO: { icon: 'fa-solid fa-lock', color: '#334155', type: 'TICKET' },
    RATING_REQUEST: { icon: 'fa-solid fa-star', color: '#CA8A04', type: 'RATING' },
    SLA_WARNING: { icon: 'fa-solid fa-hourglass-half', color: '#D97706', type: 'SLA' },
    SLA_BREACHED: { icon: 'fa-solid fa-triangle-exclamation', color: '#DC2626', type: 'SLA' },
    ESCALATION: { icon: 'fa-solid fa-arrow-up-right-from-square', color: '#B91C1C', type: 'SLA' },
    MONTHLY_EVALUATION: { icon: 'fa-solid fa-clipboard-check', color: '#7C3AED', type: 'EVAL' },
    TASK_ASIGNADA: { icon: 'fa-solid fa-list-check', color: '#0891B2', type: 'TASK' },
    CREACION_USUARIO: { icon: 'fa-solid fa-user-plus', color: '#15803D', type: 'CUENTA' },
    RESET_PASSWORD: { icon: 'fa-solid fa-key', color: '#B45309', type: 'CUENTA' }
  };

constructor(
    private adminService: AdminService,
    private toastService: ToastService,
    private sanitizer: DomSanitizer
  ) {}

  /** Caché del preview: ver safePreviewHtml. */
  private clavePreview: string | null = null;
  private htmlPreview: SafeHtml | null = null;

  /**
   * Cuerpo del preview ya envuelto para `[srcdoc]`.
   *
   * Hace falta `bypassSecurityTrustHtml` porque Angular sanea el atributo
   * `srcdoc` como si fuera contenido de plantilla: le quita el DOCTYPE, el
   * `<html>`, el `<head>`, el `<style>` y el `<body>`, y sobre todo **borra
   * todos los atributos `style`**. Como los correos se escriben con estilos en
   * linea (es lo que piden los clientes de correo), sin esto la vista previa
   * llegaba sin un solo color.
   *
   * Que sea seguro no depende de esta llamada, sino de dos cosas:
   *   1. El iframe lleva `sandbox` como atributo estatico y sin `allow-scripts`,
   *      asi que el documento no puede ejecutar nada ni alcanzar la aplicacion.
   *      Angular exige ademas que `sandbox` sea estatico: no admite binding.
   *   2. `sanitizarCuerpo` quita antes los <script>, los manejadores on*= y las
   *      URLs javascript:.
   *
   * Si algun dia se quita el `sandbox` del <iframe>, esto deja de ser seguro.
   * Hay una prueba que lo comprueba justamente para que no se pase inadvertido.
   *
   * El resultado se cachea porque `[srcdoc]` reescribe el atributo cuando cambia
   * la identidad del objeto, y eso recarga el iframe entero en cada ciclo de
   * deteccion, con el parpadeo que provoca.
   */
  safePreviewHtml(body: string, imagenUrl: string = ''): SafeHtml {
    // La imagen de la plantilla entra en la clave: si sube o se quita, el
    // preview tiene que volver a renderizarse.
    const clave = `${body} ${this.logoUrl ?? ''} ${imagenUrl ?? ''}`;
    if (this.clavePreview === clave && this.htmlPreview) {
      return this.htmlPreview;
    }
    this.clavePreview = clave;
    this.htmlPreview = this.sanitizer.bypassSecurityTrustHtml(
      this.previewHtml(body, imagenUrl),
    );
return this.htmlPreview;
  }

  triggerLabel(t: NotificationTemplate): string {
    return this.triggerLabels[t.nameTemplate] || 'Evento del sistema';
  }

  /** true si el sistema envía esa plantilla automáticamente. */
  isSystemEvent(t: NotificationTemplate): boolean {
    return !!this.triggerLabels[t.nameTemplate];
  }

  eventIcon(t: NotificationTemplate): string {
    return t.iconTemplate || this.eventDefaults[t.nameTemplate]?.icon || 'fa-regular fa-envelope';
  }

  eventColor(t: NotificationTemplate): string {
    return t.colorTemplate || this.eventDefaults[t.nameTemplate]?.color || '#64748B';
  }

  /** Al elegir el evento se completan nombre, tipo, icono y color. */
  onEventChange(): void {
    const event = this.newTemplate.nameTemplate || '';
    const def = this.eventDefaults[event];
    if (!def) return;
    this.newTemplate.typeTemplate = def.type;
    this.newTemplate.iconTemplate = def.icon;
    this.newTemplate.colorTemplate = def.color;
  }

  recipientLabel(t: NotificationTemplate): string {
    if (t.recipientRule === 'CUSTOM' && t.recipientEmail) {
      return t.recipientEmail;
    }
    return this.recipientRules.find(r => r.value === (t.recipientRule || 'DEFAULT'))?.label || 'Quien dispara el evento';
  }

  /**
   * Variables que el backend realmente rellena para cada tipo de plantilla. El
   * backend solo resuelve las del evento disparador, así que ofrecer una lista
   * global hacía que quedaran tokens literales en el correo.
   */
  private readonly variablesPorTipo: Record<string, string[]> = {
    TICKET: ['[id]', '[titulo]', '[title]', '[estado]', '[status]', '[prioridad]', '[priority]', '[nombre]', '[agente]'],
    RATING: ['[id]', '[titulo]', '[title]', '[nombre]'],
    SLA: ['[id]', '[percentage]', '[titulo]', '[title]'],
    EVAL: ['[nombre]'],
    TASK: ['[task]', '[descripcion]', '[estado]', '[status]', '[nombre]', '[agente]'],
    CUENTA: ['[nombre]', '[email]', '[correo]', '[password]', '[clave]']
  };

  variablesDe(tipo?: string | null): string[] {
    const base = this.variablesPorTipo[(tipo || '').toUpperCase()] || [];
    // La imagen es propia de cada plantilla, asi que esta disponible en todas.
    // Solo se ofrece la direccion: el HTML lo escribe el administrador.
    return [...new Set([...base, '[imagenUrl]'])];
  }

  // ================= IMAGEN DE LA PLANTILLA =================

  /** Imagen de la plantilla que se está creando. */
  nuevoImageUrl = '';
  /** Imagen de la plantilla que se está editando. */
  editImageUrl = '';
  private imageFile: File | null = null;
  uploadingImage = false;

  /** Hay un archivo elegido en el selector, pendiente de subir. */
  get imagenSeleccionada(): boolean {
    return this.imageFile !== null;
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.imageFile = input.files?.[0] || null;
  }

  // ================= VISOR DE PLANTILLAS =================

  /** Plantilla abierta en el visor lateral. */
  viewerTemplate: NotificationTemplate | null = null;
  /** El visor ocupa toda la pantalla en vez de la mitad derecha. */
  viewerFullScreen = false;

  abrirVisor(t: NotificationTemplate): void {
    // Se guarda la plantilla tal cual: el HTML con los marcadores se resuelve en
    // la plantilla con safePreviewHtml, no aquí, o se resolvería dos veces.
    this.viewerTemplate = { ...t };
    this.viewerFullScreen = false;
    this.previewTemplate = null;
  }

  cerrarVisor(): void {
    this.viewerTemplate = null;
    this.viewerFullScreen = false;
  }

  /**
   * Markup de imagen recomendado para los correos.
   *
   * Va sin height:100% porque dentro de una celda sin altura fija eso colapsa
   * la imagen a cero alto en varios clientes de correo (y en la vista previa),
   * y sin object-fit, que Outlook no soporta. El ancho se limita y la altura
   * se deja en auto para que respete la proporción.
   */
  readonly markupImagenSeguro =
    '<img src="[imagenUrl]" alt="Mesa de Servicios" width="600" ' +
    'style="display:block;max-width:100%;height:auto;border:0;border-radius:10px;">';

  /** Inserta el markup de imagen en el textarea que se está editando. */
  insertarImagen(destino: 'nuevo' | 'cuerpo'): void {
    const ref = destino === 'nuevo' ? this.nuevoBody : this.editingBody;
    if (!ref) return;
    const el = ref.nativeElement;
    el.value = (el.value || '') + this.markupImagenSeguro;
    el.dispatchEvent(new Event('input'));
    el.focus();
  }

  /**
   * Avisos sobre el HTML que el administrador está escribiendo. Se muestran en
   * la propia pantalla en vez de fallar en silencio en el correo del
   * destinatario, que es donde el problema se descubre tarde.
   */
  avisosDe(cuerpo: string | null | undefined): string[] {
    const avisos: string[] = [];
    const html = cuerpo || '';
    if (!html) return avisos;

    if (/\[imagen\]/.test(html)) {
      avisos.push(
        '[imagen] ya no existe: solo está [imagenUrl], que es la dirección de la imagen.',
      );
    }
    if (/<img[^>]*height\s*:\s*100%/i.test(html)) {
      avisos.push(
        'Hay una imagen con height:100%. Dentro de una celda sin altura fija la imagen se aplasta a cero alto: usa height:auto.',
      );
    }
    if (/<img[^>]*object-fit/i.test(html)) {
      avisos.push(
        'object-fit no lo soporta Outlook: en ese cliente la imagen se verá recortada o con la proporción rota.',
      );
    }
    if (/\[imagenUrl\]/i.test(html) && !html.match(/<img[^>]*\[imagenUrl\]/i)) {
      avisos.push('[imagenUrl] está en el cuerpo pero no dentro de una etiqueta <img>: no se verá nada.');
    }
    return avisos;
  }

  avisosEditando(): string[] {
    return this.avisosDe(this.editingTemplate?.bodyTemplate);
  }

  avisosNuevo(): string[] {
    return this.avisosDe(this.newTemplate?.bodyTemplate);
  }

  /** Sube la imagen elegida y la deja vinculada a la plantilla en edición. */
  uploadImage(destino: 'nuevo' | 'editar'): void {
    if (!this.imageFile) return;
    this.uploadingImage = true;
    this.adminService.uploadTemplateImage(this.imageFile).subscribe({
      next: (res) => {
        if (destino === 'nuevo') {
          this.nuevoImageUrl = res.url;
        } else {
          this.editImageUrl = res.url;
        }
        this.imageFile = null;
        this.uploadingImage = false;
        this.toastService.success('Imagen de la plantilla subida');
      },
      error: (e) => {
        this.uploadingImage = false;
        this.toastService.error(
          e?.error?.message || 'No se pudo subir la imagen de la plantilla',
        );
      },
    });
  }

  /** Quita la imagen de la plantilla que se está editando. */
  clearEditImage(): void {
    this.editImageUrl = '';
    this.imageFile = null;
  }

  /** Inserta la variable en el cuerpo del textarea que se está editando. */
  insertarVariable(variable: string, destino: 'nuevo' | 'cuerpo'): void {
    const ref = destino === 'nuevo'
      ? this.nuevoBody
      : this.editingBody;
    if (!ref) return;
    const el = ref.nativeElement;
    el.value = (el.value || '') + variable;
    el.dispatchEvent(new Event('input'));
    el.focus();
  }

  @ViewChild('editBody') set editingBodyRef(ref: ElementRef<HTMLTextAreaElement> | undefined) {
    if (ref) this.editingBody = ref;
  }

  private editingBody?: ElementRef<HTMLTextAreaElement>;

  /**
   * Cuerpo de la vista previa.
   * <p>
   * Esto NO pasa por `sanitizer.sanitize(SecurityContext.HTML, ...)` a propósito.
   * Ese método está pensado para fragmentos que Angular mete con `[innerHTML]`, no
   * para documentos completos: al aplicarlo a un `<!DOCTYPE html><html><head>`
   * le adds `ng-reflect-*`, elimina `<head>`, `<style>`, `<html>` y `<body>` porque
   * no son "contenido", y el resultado dentro de `[srcdoc]` es un documento roto
   * (por eso la vista previa salía en blanco o sin estilos).
   * <p>
   * El peligro real no es el `srcdoc` en sí (por sí solo no ejecuta nada) sino que
   * este HTML lo escribe un administrador, se guarda en la base y además es el
   * mismo cuerpo que se manda por correo. Por eso aquí se neutraliza a mano lo
   * que de verdad importa y se apoya en el `sandbox` del iframe (sin
   * `allow-scripts`) como segunda capa: aunque se colara algo, el documento se
   * renderiza sin permisos ni acceso a la aplicación.
   */
  previewHtml(body: string, imagenUrl: string = ''): string {
    const seguro = this.sanitizarCuerpo(this.resolveVariables(body, imagenUrl));
    return `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          html, body { margin: 0; padding: 0; background: #ffffff; color: #1f2937; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        ${seguro}
      </body>
      </html>`;
  }

  /**
   * Quita de la plantilla lo que podría ejecutarse oastedarse de la aplicación.
   * <p>
   * No es un parser HTML completo: se trabaja sobre texto, que es lo que llega del
   * textarea, y se cubren los vectores habituales. El `sandbox` sin
   * `allow-scripts` del iframe es la red de seguridad real: aunque algo se colara,
   * el navegador no lo ejecuta. Aquí se trata de no dejar ni rastro visible ni
   * riesgos innecesarios.
   */
  private sanitizarCuerpo(html: string): string {
    if (!html) return '';
    let salida = this.escaparUrlAtributo(html);

    // Elimina bloques completos con su contenido: <script>...</script>, etc.
    salida = salida.replace(/<\s*(script|iframe|object|embed|form|applet|frame|frameset|base|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
    // Elimina la etiqueta de apertura si quedó huérfana (p. ej. <script src=...> sin cierre).
    salida = salida.replace(/<\s*(script|iframe|object|embed|form|applet|frame|frameset|base|link|meta)\b[^>]*>/gi, '');

    // Manejadores de evento en línea: onerror=, onclick=, onload=...
    salida = salida.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
    salida = salida.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
    salida = salida.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');

    // URLs ejecutables: javascript:, vbscript:, data: con HTML.
    salida = salida.replace(/(href|src|action|formaction|xlink:href|background|poster)\s*=\s*"\s*(javascript|vbscript)\s*:[^"]*"/gi, '$1="#"');
    salida = salida.replace(/(href|src|action|formaction|xlink:href|background|poster)\s*=\s*'\s*(javascript|vbscript)\s*:[^']*'/gi, "$1='#'");
    salida = salida.replace(/(href|src|action|formaction|xlink:href|background|poster)\s*=\s*(javascript|vbscript)\s*:[^\s>]*/gi, '$1="#"');
    salida = salida.replace(/(href|src|action|formaction|xlink:href|background|poster)\s*=\s*"\s*data\s*:\s*text\/html[^"]*"/gi, '$1="#"');

    // Estilos con expresión (algunos clientes de correo antiguos lo evaluan) y
    // cualquier import de CSS externo dentro de style.
    salida = salida.replace(/expression\s*\(/gi, 'void(');
    salida = salida.replace(/@import/gi, '/* @import */');

    return salida;
  }

  /**
   * Rompe los valores de `src`/`href` que llevan comillas dobles dentro, para que
   * no se puedan cerrar el atributo y colar atributos propios como `onerror`.
   * <p>
   * Se hace ANTES de resolver el logo, porque el `src` que genera `resolveVariables`
   * es una URL que viene de la configuración de marca, no del textarea.
   */
  private escaparUrlAtributo(html: string): string {
    return html.replace(
      /(<img[^>]*?\ssrc\s*=\s*")([^"]*)(")/gi,
      (_, apertura: string, url: string, cierre: string) =>
        `${apertura}${url.replace(/"/g, '&quot;')}${cierre}`
    );
  }

  /**
   * La vista previa reemplaza todas las variables, no solo [logo], para que lo que
   * se ve en el editor sea lo que llega por correo.
   */
  private resolveVariables(body: string, imagenUrlCrudo: string = ''): string {
    if (body == null) return '';
    const logoHtml = this.logoUrl
      ? `<img src="${this.logoUrl}" alt="Mesa de Ayuda COAC" style="max-height:60px;max-width:220px;width:auto;height:auto;display:inline-block;" />`
      : `<span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;">Mesa de Ayuda COAC</span>`;

    // La imagen se recibe como parametro en vez de deducirla del formulario:
    // si se adivinara, la vista previa de la lista y el visor no tendrian forma
    // de saber que imagen lleva la plantilla que estan enseñando.
    const imagenUrl = (imagenUrlCrudo || '').trim();

  let result = body
        .replace(/\[logo\]/g, logoHtml)
        .replace(/\[appName\]/g, 'Mesa de Servicios')
        .replace(/\[fecha\]/g, new Date().toLocaleDateString('es-EC'))
        .replace(/\[hora\]/g, new Date().toTimeString().slice(0, 5))
        .replace(/\[nombre\]|\[agente\]/g, 'Nombre Apellido')
        .replace(/\[email\]|\[correo\]/g, 'usuario@coacmagisterio.fin.ec')
        .replace(/\[password\]|\[clave\]/g, '••••••••')
        .replace(/\[porcentaje\]|\[percentage\]/g, '80')
        .replace(/\[id\]|\[ticket\]/g, '123')
        .replace(/\[titulo\]|\[asunto\]|\[title\]/g, 'Título de ejemplo')
        .replace(/\[area\]/g, 'Soporte Técnico')
        .replace(/\[categoria\]/g, 'Acceso a sistemas')
        .replace(/\[prioridad\]|\[priority\]/g, 'Media')
        .replace(/\[estado\]|\[status\]/g, 'En proceso')
        .replace(/\[sla\]/g, '4 horas')
        .replace(/\[telefono\]/g, '000 000 0000')
        .replace(/\[observacion\]|\[comentario\]/g, 'Comentario de ejemplo')
        .replace(/\[solicitante\]/g, 'Nombre Apellido')
        .replace(/\[motivo\]/g, 'Solicitud de escalado')
        .replace(/\[fechaEscalado\]/g, new Date().toLocaleDateString('es-EC'))
        .replace(/\[compania\]|\[empresa\]/g, 'COAC Magisterio de Pichincha');

      // Mismo regex que el backend: acepta {{var}} o [var]
      result = result.replace(/\{\{(\w+)\}\}|\[(\w+)\]/g, (_: string, doble: string | undefined, simple: string | undefined) => {
        const clave = doble ?? simple ?? '';
        switch (clave) {
          case 'imagenUrl':
          case 'imageUrl':
            return imagenUrl;
          case 'logo':
            return logoHtml;
          case 'appName':
            return 'Mesa de Servicios';
          case 'fecha':
            return new Date().toLocaleDateString('es-EC');
          case 'hora':
            return new Date().toTimeString().slice(0, 5);
          case 'nombre':
          case 'agente':
          case 'solicitante':
            return 'Nombre Apellido';
          case 'email':
          case 'correo':
            return 'usuario@coacmagisterio.fin.ec';
          case 'password':
          case 'clave':
            return '••••••••';
          case 'porcentaje':
          case 'percentage':
            return '80';
          case 'id':
          case 'ticket':
            return '123';
          case 'titulo':
          case 'asunto':
          case 'title':
            return 'Título de ejemplo';
          case 'area':
            return 'Soporte Técnico';
          case 'categoria':
            return 'Acceso a sistemas';
          case 'prioridad':
          case 'priority':
            return 'Media';
          case 'estado':
          case 'status':
            return 'En proceso';
          case 'sla':
            return '4 horas';
          case 'telefono':
            return '000 000 0000';
          case 'observacion':
          case 'comentario':
            return 'Comentario de ejemplo';
          case 'motivo':
            return 'Solicitud de escalado';
          case 'fechaEscalado':
            return new Date().toLocaleDateString('es-EC');
          case 'compania':
          case 'empresa':
            return 'COAC Magisterio de Pichincha';
          default:
            return 'dato de ejemplo';
        }
      });

      // Cualquier marcador que quede sin resolver (notacion distinta)
      result = result.replace(/\{\{[^{}]{1,80}\}\}/g, 'dato de ejemplo');
      result = result.replace(/\[[a-zA-Z_áéíóúÁÉÍÓÚñÑ][^\]\n]{0,60}\]/g, 'dato de ejemplo');

      return result;
  }

  preview(t: NotificationTemplate): void {
    this.previewTemplate = this.previewTemplate?.idTemplate === t.idTemplate ? null : t;
  }

  startEdit(t: NotificationTemplate): void {
    this.editingTemplate = {
      idTemplate: t.idTemplate,
      nameTemplate: t.nameTemplate,
      typeTemplate: t.typeTemplate,
      subjectTemplate: t.subjectTemplate,
      bodyTemplate: t.bodyTemplate,
      activeTemplate: !!t.activeTemplate,
      recipientRule: t.recipientRule || 'DEFAULT',
      recipientEmail: t.recipientEmail || null,
      iconTemplate: t.iconTemplate || this.eventDefaults[t.nameTemplate]?.icon,
      colorTemplate: t.colorTemplate || this.eventDefaults[t.nameTemplate]?.color,
      imageUrl: t.imageUrl || ''
    };
    this.editImageUrl = t.imageUrl || '';
    this.imageFile = null;
    this.showEdit = true;
    this.showNew = false;
  }

  saveEdit(): void {
    const e = this.editingTemplate;
    if (!e.idTemplate) return;
    this.adminService.updateTemplate(e.idTemplate, {
      subjectTemplate: e.subjectTemplate,
      bodyTemplate: e.bodyTemplate,
      activeTemplate: !!e.activeTemplate,
      recipientRule: e.recipientRule || 'DEFAULT',
      recipientEmail: e.recipientEmail || null,
      iconTemplate: e.iconTemplate || '',
      colorTemplate: e.colorTemplate || '',
      imageUrl: this.editImageUrl
    }).subscribe({
      next: (saved: NotificationTemplate) => {
        this.showEdit = false;
        this.previewTemplate = this.previewTemplate?.idTemplate === saved.idTemplate
          ? saved
          : this.previewTemplate;
        this.load();
        this.toastService.success('Plantilla actualizada');
      },
      error: (err) => this.toastService.error(err?.error?.message || 'No se pudo actualizar la plantilla')
    });
  }

  ngOnInit(): void {
    this.adminService.getBranding().subscribe({
      next: (b) => (this.logoUrl = b.logoUrl || ''),
      error: () => (this.logoUrl = '')
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.adminService.getTemplates().subscribe({ next: (t) => { this.templates = t; this.loading = false; }, error: () => { this.loading = false; this.toastService.error('No se pudieron cargar las plantillas'); } });
  }

  create(): void {
    if (!this.newTemplate.nameTemplate || !this.newTemplate.typeTemplate || !this.newTemplate.subjectTemplate || !this.newTemplate.bodyTemplate) return;
    const overwrites = this.templates.some(t => t.nameTemplate === this.newTemplate.nameTemplate);
    const proceed = () => this.adminService.createTemplate({
      nameTemplate: this.newTemplate.nameTemplate,
      typeTemplate: this.newTemplate.typeTemplate,
      subjectTemplate: this.newTemplate.subjectTemplate,
      bodyTemplate: this.newTemplate.bodyTemplate,
      activeTemplate: !!this.newTemplate.activeTemplate,
      recipientRule: this.newTemplate.recipientRule || 'DEFAULT',
      recipientEmail: this.newTemplate.recipientEmail || null,
      iconTemplate: this.newTemplate.iconTemplate || '',
      colorTemplate: this.newTemplate.colorTemplate || '',
      imageUrl: this.nuevoImageUrl
    }).subscribe({
      next: () => {
        this.load();
        this.newTemplate = { activeTemplate: true, recipientRule: 'DEFAULT' as string };
        this.nuevoImageUrl = '';
        this.imageFile = null;
        this.showNew = false;
        this.toastService.success(overwrites ? 'Plantilla del evento actualizada' : 'Plantilla creada');
      },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo crear')
    });

    if (overwrites) {
      // Solo hay una fila por evento: se avisa antes de sustituir el texto.
      Swal.fire({
        title: 'Sobrescribir la plantilla del evento?',
        html: `Ya existe una plantilla para <b>${this.newTemplate.nameTemplate}</b>.<br>Su texto se reemplazará por el que estás creando.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sobrescribir',
        confirmButtonColor: '#062e86'
      }).then((r) => {
        if (r.isConfirmed) proceed();
      });
      return;
    }
    proceed();
  }

  delete(t: NotificationTemplate): void {
    const system = this.isSystemEvent(t);
    Swal.fire({
      title: '¿Eliminar?',
      html: system
        ? `<b>${t.nameTemplate}</b> es una plantilla de un evento del sistema.<br>Si la eliminas, ese correo se enviará con el texto predeterminado del sistema.`
        : t.nameTemplate,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33'
    })
      .then((r) => { if (r.isConfirmed) this.adminService.deleteTemplate(t.idTemplate).subscribe({ next: () => this.load(), error: (e) => this.toastService.error(e?.error?.message || 'No se pudo eliminar') }); });
  }
}
