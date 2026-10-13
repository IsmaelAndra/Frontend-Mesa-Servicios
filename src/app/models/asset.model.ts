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
}

export interface AssetRequest {
  codeAsset: string;
  nameAsset: string;
  typeAsset: string;
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