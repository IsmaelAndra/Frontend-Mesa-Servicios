export interface Asset {
  idAsset: string;
  codeAsset: string;
  nameAsset: string;
  typeAsset: string;
  brandAsset?: string | null;
  modelAsset?: string | null;
  serialNumberAsset?: string | null;
  statusAsset: string;
  purchaseDateAsset?: string | null;
  providerAsset?: string | null;
  costAsset?: number | null;
  warrantyUntilAsset?: string | null;
  imageUrlAsset?: string | null;
  documentUrlAsset?: string | null;
  notesAsset?: string | null;
  assignedUserId?: string | null;
  assignedUser?: string | null;
  assignedUserDisplayName?: string | null;
  /** Foto de la persona asignada (ruta relativa: usar urlFotoUsuario). */
  assignedUserPhotoUrl?: string | null;
  /** Área de la persona asignada (puede no ser la del activo). */
  assignedUserArea?: string | null;
  areaId?: string | null;
  area?: string | null;
  sucursalId?: string | null;
  sucursal?: string | null;
  createdAtAsset: string;
  updatedAtAsset: string;
  /** Tipo del maestro (V36). */
  assetTypeId?: string | null;
  descriptionAsset?: string | null;
  /** Ubicación detallada: piso, oficina, escritorio... */
  ubicacionAsset?: string | null;
  accesoriosAsset?: string | null;
  /** NUEVO | BUENO | REGULAR | CON_NOVEDADES (como en el acta). */
  estadoFisicoAsset?: string | null;
  configuracionAsset?: string | null;
  novedadesAsset?: string | null;
}

export interface AssetRequest {
  /** Vacío = el siguiente de la numeración configurada. */
  codeAsset?: string;
  nameAsset: string;
  typeAsset?: string;
  assetTypeId?: string | null;
  descriptionAsset?: string | null;
  ubicacionAsset?: string | null;
  accesoriosAsset?: string | null;
  estadoFisicoAsset?: string | null;
  configuracionAsset?: string | null;
  novedadesAsset?: string | null;
  brandAsset?: string;
  modelAsset?: string;
  serialNumberAsset?: string;
  statusAsset?: string;
  purchaseDateAsset?: string;
  providerAsset?: string;
  costAsset?: number;
  warrantyUntilAsset?: string;
  imageUrlAsset?: string;
  documentUrlAsset?: string;
  notesAsset?: string;
  assignedUserId?: string;
  areaId?: string;
  sucursalId?: string;
}

export interface AssetPage {
  content: Asset[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/**
 * Movimiento del historial. `user` es la persona a la que afecta (el nuevo
 * responsable, quien lo devuelve...), `previousUser` quién lo tenía en una
 * reasignación y `performedBy` quién hizo el cambio.
 */
export interface AssetHistory {
  idAssetHistory: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  userId?: string | null;
  user?: string | null;
  userDisplayName?: string | null;
  userPhotoUrl?: string | null;
  previousUserId?: string | null;
  previousUser?: string | null;
  previousUserDisplayName?: string | null;
  performedById?: string | null;
  performedBy?: string | null;
  performedByDisplayName?: string | null;
  /** ALTA, ASIGNACION, REASIGNACION, DEVOLUCION, REPARACION, FIN_REPARACION, BAJA */
  actionType: string;
  notes?: string | null;
  createdAtAssetHistory: string;
}

/** Persona a la que se puede asignar un activo (GET /assets/asignables). */
export interface AssetAssignableUser {
  idUser: string;
  displayName: string;
  corporateEmailUser: string;
  photoUrl?: string | null;
  area?: string | null;
  sessionState?: string | null;
}
/** Tipo de activo del maestro (GET /assets/tipos). */
export interface AssetTipo {
  id: string;
  nombre: string;
  prefijo: string;
  icono: string | null;
  color: string | null;
  activo: boolean;
}

/** Foto o documento de un activo. */
export interface AssetArchivo {
  id: string;
  tipo: 'FOTO' | 'GARANTIA' | 'FACTURA' | 'OTRO';
  nombre: string;
  mime: string;
  tamano: number;
  vence: string | null;
  subido: string;
}

export interface AssetConfig {
  formatoCodigo: string;
  contadorPorTipo: boolean;
  formatoActa: string;
  ciudad: string;
  codigoFormulario: string;
  versionFormulario: string;
  diasAvisoGarantia: number;
  ejemploCodigo?: string;
  ejemploActa?: string;
}

export interface ActaPersona {
  id: string;
  nombre: string;
  cargo: string | null;
  correo: string;
}

export interface ActaItem {
  assetId: string;
  principal: boolean;
  codigo: string;
  tipoEquipo: string | null;
  nombre: string | null;
  marcaModelo: string | null;
  serie: string | null;
  estadoFisico: string | null;
  accesorios: string | null;
  configuracion: string | null;
  novedades: string | null;
}

export type TipoActa = 'ENTREGA' | 'DEVOLUCION' | 'REASIGNACION';

/** Acta FOR-POL-TIC-01-10. */
export interface Acta {
  id: string;
  numero: string;
  tipo: TipoActa;
  estado: 'PENDIENTE' | 'ACEPTADA' | 'FIRMADA' | 'ANULADA';
  fecha: string;
  ciudad: string;
  asunto: string | null;
  cc: string | null;
  custodio: ActaPersona;
  custodioAnterior: ActaPersona | null;
  entregadoPor: ActaPersona | null;
  recibidoPor: ActaPersona | null;
  autorizadoPor: ActaPersona | null;
  revisadoPor: ActaPersona | null;
  sucursal: string | null;
  observaciones: string | null;
  aceptadaAt: string | null;
  firmada: boolean;
  firmadaAt: string | null;
  items: ActaItem[];
  puedoAceptar: boolean;
  puedoGestionar: boolean;
  creada: string;
}

export interface ActaRequest {
  tipo: TipoActa;
  custodioId?: string | null;
  /** El primero es el equipo principal. */
  activos: string[];
  revisadoPorId?: string | null;
  sucursalId?: string | null;
  ciudad?: string | null;
  asunto?: string | null;
  cc?: string | null;
  observaciones?: string | null;
}

/** Textos e iconos de los estados del activo. "En bodega" = sin persona. */
export const ESTADOS_ACTIVO: Record<string, { texto: string; color: string; icono: string }> = {
  EN_BODEGA: { texto: 'En bodega', color: '#0891B2', icono: 'fa-solid fa-warehouse' },
  ASIGNADO: { texto: 'Asignado', color: '#2563EB', icono: 'fa-solid fa-user-check' },
  EN_REPARACION: { texto: 'En reparación', color: '#D97706', icono: 'fa-solid fa-screwdriver-wrench' },
  BAJA: { texto: 'De baja', color: '#DC2626', icono: 'fa-solid fa-ban' },
};

export const ESTADOS_FISICOS: { valor: string; texto: string; color: string; icono: string }[] = [
  { valor: 'NUEVO', texto: 'Nuevo', color: '#16A34A', icono: 'fa-solid fa-star' },
  { valor: 'BUENO', texto: 'Bueno', color: '#2563EB', icono: 'fa-solid fa-thumbs-up' },
  { valor: 'REGULAR', texto: 'Regular', color: '#D97706', icono: 'fa-solid fa-hand' },
  { valor: 'CON_NOVEDADES', texto: 'Con novedades', color: '#DC2626', icono: 'fa-solid fa-triangle-exclamation' },
];

export const TIPOS_ACTA: Record<TipoActa, { texto: string; color: string; icono: string }> = {
  ENTREGA: { texto: 'Entrega', color: '#16A34A', icono: 'fa-solid fa-hand-holding' },
  DEVOLUCION: { texto: 'Devolución', color: '#D97706', icono: 'fa-solid fa-rotate-left' },
  REASIGNACION: { texto: 'Reasignación', color: '#7C3AED', icono: 'fa-solid fa-right-left' },
};

export const ESTADOS_ACTA: Record<string, { texto: string; color: string; icono: string }> = {
  PENDIENTE: { texto: 'Por firmar', color: '#D97706', icono: 'fa-regular fa-clock' },
  ACEPTADA: { texto: 'Aceptada', color: '#2563EB', icono: 'fa-solid fa-check' },
  FIRMADA: { texto: 'Firmada', color: '#16A34A', icono: 'fa-solid fa-file-signature' },
  ANULADA: { texto: 'Anulada', color: '#64748B', icono: 'fa-solid fa-ban' },
};

/** Límites de archivos (iguales al backend). */
export const LIMITES_ARCHIVOS = { fotos: 2, fotoMb: 5, pdfMb: 10 };
