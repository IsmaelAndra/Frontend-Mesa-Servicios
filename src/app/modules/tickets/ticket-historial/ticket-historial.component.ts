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
    switch (action) {
      case "CREATE":
        return "Ticket creado";
      case "ASSIGN":
        return "Asignación";
      case "STATUS_CHANGE":
        return "Cambio de estado";
      case "ANSWER":
        return "Respuesta";
      case "ATTACH":
        return "Adjunto";
      case "RATING":
        return "Calificación";
      default:
        return action || "Evento";
    }
  }

  /** Color del texto del encabezado de cada evento del timeline. */
  timelineTextColor(action: string): string {
    switch (action) {
      case "CREATE":
        return "text-info";
      case "ASSIGN":
        return "text-secondary";
      case "STATUS_CHANGE":
        return "text-warning";
      case "ANSWER":
        return "text-primary";
      case "ATTACH":
        return "text-base-content";
      case "RATING":
        return "text-success";
      default:
        return "text-base-content";
    }
  }

  /** Fondo sólido del icono circular del timeline. */
  timelineIconBg(action: string): string {
    switch (action) {
      case "CREATE":
        return "bg-info text-white text-white";
      case "ASSIGN":
        return "bg-secondary text-white text-white";
      case "STATUS_CHANGE":
        return "bg-warning text-white text-white";
      case "ANSWER":
        return "bg-primary text-white text-white";
      case "ATTACH":
        return "bg-neutral text-neutral-content text-white";
      case "RATING":
        return "bg-success text-white text-white";
      default:
        return "bg-base-300 text-base-content text-white";
    }
  }

  timelineIcon(action: string): string {
    switch (action) {
      case "CREATE":
        return "fa-solid fa-plus";
      case "ASSIGN":
        return "fa-solid fa-user-check";
      case "STATUS_CHANGE":
        return "fa-solid fa-rotate";
      case "ANSWER":
        return "fa-solid fa-comment-dots";
      case "ATTACH":
        return "fa-solid fa-paperclip";
      case "RATING":
        return "fa-solid fa-star";
      default:
        return "fa-solid fa-clock";
    }
  }

  timelineDetail(a: AuditLog): string {
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
