import { Component, Input } from "@angular/core";
import { AuditLog } from "../../../models/ticket.model";
import { Paginacion } from "../../../core/utils/pagination.util";

/** HTML a texto plano: sin etiquetas, entidades básicas resueltas y espacios compactados. */
function textoPlano(text: string): string {
  if (!text) return "";
  return String(text)
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cómo se pinta cada acción: texto en español, icono y tono de daisyUI. */
interface Accion {
  etiqueta: string;
  icono: string;
  tono: string;
  /** Si existe, se muestra esta frase en lugar de los valores guardados. */
  frase?: string;
}

/** Clases literales por tono (Tailwind no genera clases armadas en tiempo de ejecución): [texto, fondo del icono]. */
const TONOS: Record<string, [string, string]> = {
  info: ["text-info", "bg-info text-white"],
  secondary: ["text-secondary", "bg-secondary text-white"],
  warning: ["text-warning", "bg-warning text-white"],
  primary: ["text-primary", "bg-primary text-white"],
  neutral: ["text-base-content", "bg-neutral text-neutral-content"],
  success: ["text-success", "bg-success text-white"],
  error: ["text-error", "bg-error text-white"],
  "base-content": ["text-base-content", "bg-base-300 text-base-content"],
};

const DEFECTO: Accion = { etiqueta: "", icono: "fa-solid fa-clock", tono: "base-content" };

const ACCIONES: Record<string, Accion> = {
  CREATE: { etiqueta: "Ticket creado", icono: "fa-solid fa-plus", tono: "info" },
  ASSIGN: { etiqueta: "Asignación", icono: "fa-solid fa-user-check", tono: "secondary" },
  TEAM_ASSIGN: { etiqueta: "Cambio de equipo", icono: "fa-solid fa-users", tono: "secondary" },
  STATUS_CHANGE: { etiqueta: "Cambio de estado", icono: "fa-solid fa-rotate", tono: "warning" },
  PRIORITY_CHANGE: { etiqueta: "Cambio de prioridad", icono: "fa-solid fa-flag", tono: "warning" },
  CATEGORY_CHANGE: { etiqueta: "Cambio de categoría", icono: "fa-solid fa-tag", tono: "warning" },
  TYPE_CHANGE: { etiqueta: "Cambio de tipo", icono: "fa-solid fa-shapes", tono: "warning" },
  AREA_TRANSFER: { etiqueta: "Traslado de área", icono: "fa-solid fa-right-left", tono: "secondary" },
  ANSWER: { etiqueta: "Respuesta", icono: "fa-solid fa-comment-dots", tono: "primary" },
  ANSWER_EDITED: { etiqueta: "Mensaje editado", icono: "fa-solid fa-pen", tono: "primary" },
  ANSWER_DELETED: { etiqueta: "Mensaje eliminado", icono: "fa-solid fa-comment-slash", tono: "error" },
  ATTACH: { etiqueta: "Adjunto", icono: "fa-solid fa-paperclip", tono: "neutral" },
  RATING: { etiqueta: "Calificación", icono: "fa-solid fa-star", tono: "success" },
  LLAMADA: { etiqueta: "Llamada", icono: "fa-solid fa-phone", tono: "info" },
  CONFIDENTIALITY_CHANGE: { etiqueta: "Cambio de confidencialidad", icono: "fa-solid fa-user-shield", tono: "warning" },
  CONFIDENTIAL_READ: {
    etiqueta: "Lectura con acceso de emergencia", icono: "fa-solid fa-eye", tono: "error",
    frase: "Abrió el ticket confidencial con un acceso aprobado por el jefe del área",
  },
  CONFIDENTIAL_ACCESS_REQUEST: {
    etiqueta: "Pidió acceso al ticket confidencial", icono: "fa-solid fa-key", tono: "warning",
  },
  CONFIDENTIAL_ACCESS_APPROVED: { etiqueta: "Acceso confidencial aprobado", icono: "fa-solid fa-lock-open", tono: "success" },
  CONFIDENTIAL_ACCESS_REJECTED: { etiqueta: "Acceso confidencial rechazado", icono: "fa-solid fa-ban", tono: "error" },
};

/**
 * Línea de tiempo de auditoría de un ticket (pestaña Historial del detalle).
 *
 * <p>Vivía dentro de TicketDetailComponent, que pasaba de 1.400 líneas. Solo
 * pinta: recibe los registros ya cargados y pagina en cliente. Quién puede verla
 * lo decide el detalle (solo el personal que gestiona el ticket).
 */
@Component({
  selector: "app-ticket-historial",
  templateUrl: "./ticket-historial.component.html",
})
export class TicketHistorialComponent {
  @Input() audit: AuditLog[] = [];

  readonly pagAudit = new Paginacion<AuditLog>(() => this.audit, 15);

  timelineLabel(action: string): string {
    return (ACCIONES[action] || DEFECTO).etiqueta || action || "Evento";
  }

  /** Color del texto del encabezado de cada evento del timeline. */
  timelineTextColor(action: string): string {
    return TONOS[(ACCIONES[action] || DEFECTO).tono][0];
  }

  /** Fondo sólido del icono circular del timeline. */
  timelineIconBg(action: string): string {
    return TONOS[(ACCIONES[action] || DEFECTO).tono][1];
  }

  timelineIcon(action: string): string {
    return (ACCIONES[action] || DEFECTO).icono;
  }

  /** Acciones cuyos valores no aportan (p. ej. el correo de quien leyó): se muestra una frase. */
  sinValores(a: AuditLog): boolean {
    return !!(ACCIONES[a.actionType] || DEFECTO).frase;
  }

  timelineDetail(a: AuditLog): string {
    const frase = (ACCIONES[a.actionType] || DEFECTO).frase;
    if (frase) {
      return frase;
    }
    if (a.actionType === "STATUS_CHANGE") {
      return `${a.oldValue || "—"} → ${a.newValue || "—"}`;
    }
    if (a.actionType === "ASSIGN" && a.newValue) {
      return `De: ${a.oldValue || "sin asignar"} · Para: ${a.newValue}`;
    }
    if (a.actionType === "CREATE" && a.newValue) {
      return a.newValue;
    }
    if (a.actionType === "ATTACH" && a.newValue) {
      return a.newValue;
    }
    const detail = a.newValue || a.oldValue || "";
    return detail ? this.timelineSnippet(detail) : "";
  }

  timelineSnippet(text: string): string {
    const plain = String(text)
      .replace(/<\/?[^>]+(>|$)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return plain.length > 140 ? plain.slice(0, 140) + "…" : plain;
  }

  /** Convierte el HTML del historial a texto plano (sin etiquetas ni imágenes base64). */
  timelineText(text: string): string {
    return textoPlano(text);
  }

  timelineInitial(a: AuditLog): string {
    const name = a.user || "SISTEMA";
    return name.charAt(0).toUpperCase();
  }
}
