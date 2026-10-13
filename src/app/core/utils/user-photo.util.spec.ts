import { environment } from '../../../environments/environment';
import { inicialesDe, urlFotoUsuario } from './user-photo.util';

describe('user-photo', () => {
  describe('urlFotoUsuario', () => {
    it('antepone la apiUrl a la ruta relativa que guarda el backend', () => {
      // Sin esto el <img> apunta al puerto 4200 y el avatar sale vacio.
      expect(urlFotoUsuario('/uploads/publico/avatars/user_17.png')).toBe(
        `${environment.apiUrl}/uploads/publico/avatars/user_17.png`
      );
    });

    it('deja intacta una URL ya absoluta', () => {
      expect(urlFotoUsuario('https://graph.microsoft.com/foto.jpg')).toBe(
        'https://graph.microsoft.com/foto.jpg'
      );
      expect(urlFotoUsuario('http://example.org/a.png')).toBe('http://example.org/a.png');
    });

    it('respeta una imagen en base64', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
      expect(urlFotoUsuario(dataUrl)).toBe(dataUrl);
    });

    it('devuelve null cuando no hay foto', () => {
      expect(urlFotoUsuario(null)).toBeNull();
      expect(urlFotoUsuario(undefined)).toBeNull();
      expect(urlFotoUsuario('')).toBeNull();
      expect(urlFotoUsuario('   ')).toBeNull();
    });
  });

  describe('inicialesDe', () => {
    it('toma la primera letra del nombre y la del apellido', () => {
      expect(inicialesDe('Ismael Andrade')).toBe('IA');
      expect(inicialesDe('Nicole  Ojeda')).toBe('NO');
    });

    it('con un solo nombre se queda con una letra', () => {
      expect(inicialesDe('Superadmin')).toBe('S');
    });

    it('devuelve "?" cuando no hay nombre', () => {
      expect(inicialesDe('')).toBe('?');
      expect(inicialesDe(null)).toBe('?');
      expect(inicialesDe(undefined)).toBe('?');
    });

    it('no se rompe con espacios de sobra', () => {
      expect(inicialesDe('  Manuel   Auqui  ')).toBe('MA');
    });
  });
});