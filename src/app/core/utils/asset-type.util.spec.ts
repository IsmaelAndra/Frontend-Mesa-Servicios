import {
  ETIQUETA_TIPO_ACTIVO,
  TIPOS_ACTIVO,
  etiquetaTipoActivo,
  iconoTipoActivo
} from './asset-type.util';

describe('asset-type', () => {
  describe('iconoTipoActivo', () => {
    it('devuelve un icono distinto para cada tipo del catálogo', () => {
      const iconos = TIPOS_ACTIVO.map((t) => iconoTipoActivo(t));
      // Si dos tipos comparten icono, el listado muestra lo mismo para equipos
      // que el usuario tiene que distinguir de un vistazo.
      expect(new Set(iconos).size).toBe(TIPOS_ACTIVO.length);
    });

    it('usa el icono que corresponde a cada tipo', () => {
      expect(iconoTipoActivo('LAPTOP')).toBe('fa-solid fa-laptop');
      expect(iconoTipoActivo('IMPRESORA')).toBe('fa-solid fa-print');
      expect(iconoTipoActivo('SERVIDOR')).toBe('fa-solid fa-server');
      expect(iconoTipoActivo('MONITOR')).toBe('fa-solid fa-display');
    });

    it('acepta el tipo en cualquier mayuscula', () => {
      expect(iconoTipoActivo('laptop')).toBe(iconoTipoActivo('LAPTOP'));
    });

    it('cae en la caja generica con un tipo desconocido o vacio', () => {
      const generico = iconoTipoActivo('OTRO');
      expect(iconoTipoActivo('CAMARA_DE_VIDEO')).toBe(generico);
      expect(iconoTipoActivo('')).toBe(generico);
      expect(iconoTipoActivo(null)).toBe(generico);
      expect(iconoTipoActivo(undefined)).toBe(generico);
    });
  });

  describe('etiquetaTipoActivo', () => {
    it('devuelve un nombre legible, no el codigo', () => {
      expect(etiquetaTipoActivo('LAPTOP')).toBe('Laptop');
      expect(etiquetaTipoActivo('IMPRESORA')).toBe('Impresora');
    });

    it('tiene etiqueta para todos los tipos del catálogo', () => {
      TIPOS_ACTIVO.forEach((tipo) => expect(ETIQUETA_TIPO_ACTIVO[tipo]).toBeTruthy());
    });

    it('muestra el codigo tal cual si el tipo no se reconoce', () => {
      // Puede llegar un tipo nuevo del backend: ocultarlo detras de "Otro"
      // haria creer que es un equipo generico cuando es otra cosa.
      expect(etiquetaTipoActivo('DESCONOCIDO')).toBe('DESCONOCIDO');
    });

    it('devuelve "Otro" cuando no hay tipo', () => {
      expect(etiquetaTipoActivo('')).toBe('Otro');
      expect(etiquetaTipoActivo(null)).toBe('Otro');
      expect(etiquetaTipoActivo(undefined)).toBe('Otro');
    });
  });
});