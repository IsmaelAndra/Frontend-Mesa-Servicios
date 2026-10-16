/** Tema de temporada que toca hoy (GET /pages/public/tema-temporada). */
export interface TemaActual {
  /** HALLOWEEN, NAVIDAD...: decide los adornos (data-temporada en <html>). */
  code: string;
  name: string;
  greeting: string | null;
  /** Fondo propio del login; null = el de Marca. */
  backgroundUrl: string | null;
  /** Logo propio; null = el de Marca. */
  logoUrl: string | null;
}

/** Un tema en la pantalla de administración. */
export interface TemaTemporada {
  id: string;
  code: string;
  name: string;
  active: boolean;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  greeting: string | null;
  backgroundUrl: string | null;
  logoUrl: string | null;
  /** Si hoy cae entre sus fechas. */
  vigenteHoy: boolean;
  /** CARNAVAL si las fechas se calculan solas cada año (entonces no se editan). */
  rule: string | null;
}

export interface PanelTemas {
  enabled: boolean;
  forcedCode: string | null;
  actual: TemaActual | null;
  temas: TemaTemporada[];
}
