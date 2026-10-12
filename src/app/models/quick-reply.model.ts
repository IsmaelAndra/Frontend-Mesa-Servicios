/** Respuesta rápida del chat: texto guardado que el personal inserta con un clic o con "/". */
export interface QuickReply {
  id: string;
  title: string;
  content: string;
  /** Visible para todo el personal (solo la publica un administrador). */
  shared: boolean;
  /** Es mía. */
  mine: boolean;
  /** Puedo cambiarla (es mía o soy administrador). */
  editable: boolean;
  ownerName: string;
}

export interface QuickReplyRequest {
  title: string;
  content: string;
  shared?: boolean;
}
