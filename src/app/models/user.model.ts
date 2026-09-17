export interface Role {
  idRole: number;
  nameRole: string;
  descriptionRole?: string;
}

export interface Area {
  idArea: number;
  nameArea: string;
  descriptionArea?: string;
  priorityLevel: number;
  statusArea: boolean;
  deletedArea?: boolean;
}

export interface User {
  idUser: number;
  identificationUser: string;
  corporateEmailUser: string;
  phoneUser?: string;
  statusUser: string;
  role: string;
  area: string;
  createdAtUser?: string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  userId: number;
  email: string;
  role: string;
  area: string;
  permissions: string[];
  mustChangePassword: boolean;
  refreshToken: string;
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  identification: string;
  corporateEmail: string;
  password?: string;
  phone?: string;
  roleName: string;
  areaId: number;
}

export interface Catalog {
  roles: string[];
  areas: { id: number; name: string; priorityLevel: number; status: boolean }[];
  statuses: string[];
  priorities: { id: number; name: string; level: number; color: string }[];
  teams: { id: number; name: string; method: string }[];
  categories: { id: number; name: string; teamId: number | null }[];
  ticketTypes: { id: number; name: string; description?: string }[];
  slaPolicies: { id: number; name: string; response: number; resolution: number }[];
}