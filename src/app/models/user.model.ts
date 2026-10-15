import { Ticket } from './ticket.model';

export interface Role {
  idRole: string;
  nameRole: string;
  descriptionRole?: string;
}

export interface Sucursal {
  idSucursal: string;
  codeSucursal: string;
  nameSucursal: string;
  descriptionSucursal?: string;
  addressSucursal?: string;
  phoneSucursal?: string;
  iconSucursal?: string;
  colorSucursal?: string;
  statusSucursal: boolean;
}

export interface Area {
  idArea: string;
  nameArea: string;
  descriptionArea?: string;
  priorityLevel: number;
  statusArea: boolean;
  deletedArea?: boolean;
  iconArea?: string;
  colorArea?: string;
}

export interface User {
  idUser: string;
  identificationUser?: string;
  corporateEmailUser: string;
  phoneUser?: string;
  /** Extensión telefónica en la central (solo números). */
  extensionUser?: string | null;
  statusUser: string;
  /** Estado de sesión calculado en el backend: EN_LINEA | RECIENTE | DESCONECTADO. */
  sessionState?: string;
  role: string;
  area: string;
  /** Sede fisica de la persona. */
  sucursal?: string;
  sucursalId?: string | null;
  photoUrl?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  userPrincipalName?: string;
  microsoftActive?: boolean;
  microsoftSynced?: boolean;
  lastSync?: string;
  createdAtUser?: string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  userId: string;
  email: string;
  role: string;
  area: string;
  permissions: string[];
mustChangePassword: boolean;
     /**
      * Ya no llega en el cuerpo: viaja en una cookie HttpOnly que el navegador
      * adjunta solo. Se conserva en el tipo solo para que quede constancia de que
      * el contrato cambió a propósito.
      */
     refreshToken?: string | null;
     /**
      * Códigos de recuperación, y solo cuando el usuario acaba de enrolarse.
      *
      * <p>Es la única vez que se ven: el backend guarda únicamente el hash, así
      * que si se pierden hay que generar otros.
      */
     recoveryCodes?: string[] | null;
  /** Segundos de vida del token de acceso; alimenta el contador de sesión. */
  expiresInSeconds?: number;
  /** Minutos antes del vencimiento en que se avisa al usuario. */
  warningMinutes?: number;
  /** Si el frontend renueva el token por su cuenta. */
  autoRenew?: boolean;
  /** Si el cierre por inactividad está activo. */
  idleEnabled?: boolean;
  /** Minutos sin actividad antes de cerrar la sesión. */
idleMinutes?: number;
   }

   /**
    * Respuesta del login cuando el doble factor está activo.
    *
    * <p>En ese caso NO vienen tokens: el servidor devuelve esto en su lugar y la
    * sesión solo existe tras confirmar el código. Los campos opcionales se
    *Lmarcan así porque un mismo tipo cubre las dos fases: en `ENROLAR` llegan el
    * QR y la clave, en `VERIFICAR` ninguno de los dos.
    */
   export interface MfaChallengeResponse {
     status: 'VERIFICAR' | 'ENROLAR';
     challenge: string;
     /** Solo en el alta: el contenido del QR. */
     qrUri?: string | null;
     /** Solo en el alta: la clave para teclear a mano si el QR no funciona. */
     claveManual?: string | null;
     /** Nombre de la cuenta tal como aparecerá en la app. */
     emisor?: string | null;
   }

   export interface AuthRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  identification?: string;
  corporateEmail: string;
  password?: string;
  phone?: string;
roleName: string;
    areaId: string;
    /** Sede de la persona; opcional. */
    sucursalId?: string | null;
    /** Extensión telefónica; "" la quita. */
    extension?: string;
  }

export interface Catalog {
  roles: string[];
  areas: { id: string; name: string; priorityLevel: number; status: boolean; icon?: string; color?: string }[];
    /** Sedes activas. El catálogo es público y lo consumen los selectores. */
    sucursales: { id: string; code: string; name: string; status: boolean; icon?: string; color?: string }[];
  statuses: { id: string; name: string; icon?: string; color?: string }[];
  priorities: { id: string; name: string; level: number; icon?: string; color?: string }[];
  teams: { id: string; name: string; method: string; icon?: string; color?: string }[];
  categories: { id: string; name: string; teamId: string | null; icon?: string; color?: string }[];
  ticketTypes: { id: string; name: string; description?: string; icon?: string; color?: string }[];
  /**
   * Políticas SLA vigentes. `icon` y `color` los edita la pantalla de gestión de
   * políticas; el backend los devuelve en el catálogo para que cada una se
   * distinga de las demás. Vienen como cadena vacía cuando no se han configurado.
   */
  slaPolicies: {
    id: string;
    name: string;
    description?: string;
    response: number | null;
    resolution: number | null;
    icon?: string;
    color?: string;
  }[];
}

export interface SolicitanteResumen {
  solicitante: User;
  historial: Ticket[];
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  avgSatisfaction: number | null;
  avgResolutionHours: number | null;
  ticketsPorEstado: { [k: string]: number };
  ticketsUltimos6Meses: number[];
}