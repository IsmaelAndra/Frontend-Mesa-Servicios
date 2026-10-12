import {
  ERROR_GENERICO,
  ERROR_STATUSES,
  normalizarStatus,
  resolveErrorPage,
  resolveMaintenance,
} from './error-page.util';

/**
 * Resolucion de los textos de las pantallas de error.
 *
 * Lo que se prueba aqui es el contrato de "esta pantalla nunca falla": aunque el
 * backend no responda, o responda a medias, el visitante tiene que leer algo
 * coherente. Si estas reglas se rompen, un 500 real deja una pagina en blanco.
 */
describe('error-page.util', () => {
  describe('normalizarStatus', () => {
    it('acepta los cuatro estados con pantalla propia', () => {
      expect(normalizarStatus(404)).toBe(404);
      expect(normalizarStatus(403)).toBe(403);
      expect(normalizarStatus(500)).toBe(500);
      expect(normalizarStatus(503)).toBe(503);
    });

    it('acepta tambien el codigo como texto, que es como llega por la URL', () => {
      expect(normalizarStatus('403')).toBe(403);
    });

    it('devuelve null para lo que no tiene pantalla propia', () => {
      expect(normalizarStatus(401)).toBeNull();
      expect(normalizarStatus(0)).toBeNull();
      expect(normalizarStatus(null)).toBeNull();
      expect(normalizarStatus(undefined)).toBeNull();
      // NaN viene de Number() sobre un texto que no es un numero.
      expect(normalizarStatus('abc')).toBeNull();
      expect(normalizarStatus(NaN)).toBeNull();
    });

    it('cubre los cuatro estados, sin repeticiones', () => {
      expect(ERROR_STATUSES).toEqual([404, 403, 500, 503]);
    });
  });

  describe('resolveErrorPage con textos del backend', () => {
    const textos = {
      error404Title: 'No encontramos esa pagina',
      error404Message: 'Revisa el enlace.',
      error404Icon: 'fa-solid fa-map-location-dot',
      error404Color: '#0f766e',
      error403Title: 'Sin permisos',
      error403Message: 'Pide acceso al administrador.',
      error403Icon: 'fa-solid fa-user-lock',
      error403Color: '#7c3aed',
      error500Title: 'Algo fallo por nuestra parte',
      error500Message: 'Ya estamos avisando al equipo.',
      error500Icon: 'fa-solid fa-bug',
      error500Color: '#dc2626',
      error503Title: 'Estamos.mlivando',
      error503Message: 'Vuelve en diez minutos.',
      error503Icon: 'fa-solid fa-plug-circle-xmark',
      error503Color: '#2563eb',
    };

    it('usa el texto configurado para cada estado', () => {
      expect(resolveErrorPage(404, textos).title).toBe('No encontramos esa pagina');
      expect(resolveErrorPage(403, textos).message).toBe('Pide acceso al administrador.');
      expect(resolveErrorPage(500, textos).icon).toBe('fa-solid fa-bug');
      expect(resolveErrorPage(503, textos).color).toBe('#2563eb');
    });

    it('no mezcla los textos de un estado con los de otro', () => {
      // El fallo tipico al anadir un estado nuevo es copiar el bloque equivocado.
      expect(resolveErrorPage(404, textos).icon).toBe('fa-solid fa-map-location-dot');
      expect(resolveErrorPage(500, textos).title).toBe('Algo fallo por nuestra parte');
      expect(resolveErrorPage(500, textos).message).not.toBe('Revisa el enlace.');
    });

    it('el estado devuelto es el codigo pedido', () => {
      ERROR_STATUSES.forEach((s) => expect(resolveErrorPage(s, textos).status).toBe(s));
    });
  });

  describe('resolveErrorPage con datos ausentes o invalidos', () => {
    it('sin configuracion alguna usa los respaldos', () => {
      expect(resolveErrorPage(404, null).title).toBe('Página no encontrada');
      expect(resolveErrorPage(500, undefined).title).toBe('Error interno del servidor');
      expect(resolveErrorPage(503, {}).icon).toBe('fa-solid fa-screwdriver-wrench');
    });

    it('un objeto a medias rellena solo los campos que faltan', () => {
      const r = resolveErrorPage(404, { error404Title: 'Solo el titulo' });
      expect(r.title).toBe('Solo el titulo');
      expect(r.message).toBe('La dirección que buscas no existe o fue movida. Revisa el enlace o vuelve al inicio.');
      expect(r.icon).toBe('fa-solid fa-compass');
    });

    it('una cadena vacia o solo con espacios cae al respaldo', () => {
      const r = resolveErrorPage(403, {
        error403Title: '',
        error403Message: '   ',
        error403Icon: '\t',
      });
      expect(r.title).toBe('Acceso no autorizado');
      expect(r.message.length).toBeGreaterThan(10);
      expect(r.icon).toBe('fa-solid fa-lock');
    });

    it('un color que no es hexadecimal no llega a la pantalla', () => {
      const r = resolveErrorPage(500, { error500Color: 'rojo' });
      expect(r.color).toBe('#dc2626');
      const conScript = resolveErrorPage(500, { error500Color: 'red; background:url(x)' });
      expect(conScript.color).toBe('#dc2626');
    });

    it('acepta hexadecimal de tres y de seis digitos', () => {
      expect(resolveErrorPage(404, { error404Color: '#fff' }).color).toBe('#fff');
      expect(resolveErrorPage(404, { error404Color: '#AABBCC' }).color).toBe('#AABBCC');
    });

    it('un estado sin pantalla propia da el texto generico, no un hueco', () => {
      const r = resolveErrorPage(401, { error404Title: 'no debe usarse' });
      expect(r.status).toBe(0);
      expect(r.title).toBe(ERROR_GENERICO.title);
      expect(r.message.length).toBeGreaterThan(10);
      expect(r.title).not.toBe('no debe usarse');
    });

    it('sin codigo tambien da el texto generico', () => {
      expect(resolveErrorPage(null, null).title).toBe(ERROR_GENERICO.title);
    });
  });

  describe('resolveMaintenance', () => {
    it('avisa del mantenimiento con su fecha de vuelta', () => {
      const m = resolveMaintenance({
        maintenanceMode: true,
        maintenanceTitle: 'Ventana de mantenimiento',
        maintenanceMessage: 'No es una falla.',
        maintenanceEta: 'Domingo 02:00',
      });
      expect(m.activo).toBe(true);
      expect(m.titulo).toBe('Ventana de mantenimiento');
      expect(m.eta).toBe('Domingo 02:00');
    });

    it('sin marca de mantenimiento, inactivo pero con textos utilizables', () => {
      const m = resolveMaintenance({ maintenanceMode: false });
      expect(m.activo).toBe(false);
      expect(m.titulo.length).toBeGreaterThan(0);
      expect(m.eta).toBe('');
    });

    it('sin branding devuelve los respaldos', () => {
      const m = resolveMaintenance(null);
      expect(m.activo).toBe(false);
      expect(m.titulo).toBe('Mesa de servicios en mantenimiento');
    });
  });
});