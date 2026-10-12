import {
  SESION_META,
  SESION_PUNTO_NAVBAR,
  estadoDesdeConexion,
  metaSesion,
  normalizarSesion
} from './session-presence.util';

describe('session-presence', () => {
  describe('normalizarSesion', () => {
    it('deja pasar los tres estados validos', () => {
      expect(normalizarSesion('EN_LINEA')).toBe('EN_LINEA');
      expect(normalizarSesion('RECIENTE')).toBe('RECIENTE');
      expect(normalizarSesion('DESCONECTADO')).toBe('DESCONECTADO');
    });

    it('trata lo que no llega como desconectado', () => {
      // Un ticket guardado de una version anterior puede no traer el estado.
      expect(normalizarSesion(undefined)).toBe('DESCONECTADO');
      expect(normalizarSesion(null)).toBe('DESCONECTADO');
      expect(normalizarSesion('')).toBe('DESCONECTADO');
      expect(normalizarSesion('OTRA_COSA')).toBe('DESCONECTADO');
    });
  });

  describe('estadoDesdeConexion', () => {
    it('con la conexion abierta da en linea', () => {
      expect(estadoDesdeConexion('connected', 'DESCONECTADO')).toBe('EN_LINEA');
    });

    it('mientras se abre la conexion tambien da en linea', () => {
      // Durante el handshake el backend todavia no registra la conexion y
      // devuelve DESCONECTADO. Pintar el punto rojo en ese margen hacia creer
      // que la sesion estaba caida cuando lo unico que faltaba era el onopen.
      expect(estadoDesdeConexion('connecting', 'DESCONECTADO')).toBe('EN_LINEA');
      expect(estadoDesdeConexion('connecting', undefined)).toBe('EN_LINEA');
    });

    it('sin conexion manda lo que dice el servidor', () => {
      expect(estadoDesdeConexion('closed', 'RECIENTE')).toBe('RECIENTE');
      expect(estadoDesdeConexion('closed', 'DESCONECTADO')).toBe('DESCONECTADO');
      expect(estadoDesdeConexion('closed', undefined)).toBe('DESCONECTADO');
    });

    it('nunca devuelve un estado que no existe', () => {
      const estados = ['EN_LINEA', 'RECIENTE', 'DESCONECTADO'];
      (['connecting', 'connected', 'closed'] as const).forEach(sse => {
        [undefined, null, '', 'inventado'].forEach(ss => {
          expect(estados).toContain(estadoDesdeConexion(sse, ss));
        });
      });
    });
  });

  describe('colores y etiquetas', () => {
    it('los tres estados tienen punto y etiqueta', () => {
      (['EN_LINEA', 'RECIENTE', 'DESCONECTADO'] as const).forEach(estado => {
        expect(SESION_META[estado].dot).toBeTruthy();
        expect(SESION_META[estado].label).toBeTruthy();
        expect(SESION_PUNTO_NAVBAR[estado]).toBeTruthy();
      });
    });

    it('el punto de desconectado es rojo y el de conectado no', () => {
      expect(SESION_PUNTO_NAVBAR.DESCONECTADO).toContain('bg-error');
      expect(SESION_PUNTO_NAVBAR.EN_LINEA).not.toContain('bg-error');
      expect(SESION_PUNTO_NAVBAR.EN_LINEA).toContain('bg-white');
    });

    it('metaSesion nunca se rompe con un estado raro', () => {
      expect(metaSesion('lo-que-sea').label).toBe('Desconectado');
      expect(metaSesion(null).label).toBe('Desconectado');
    });
  });
});