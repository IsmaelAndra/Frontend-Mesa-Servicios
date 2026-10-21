import { environment } from '../../../environments/environment';
import { urlDelApi } from './url-api.util';

describe('urlDelApi', () => {
  const base = environment.apiUrl.replace(/\/+$/, '');
  const contexto = base.replace(/^https?:\/\/[^/]+/i, '');
  const origen = base.slice(0, base.length - contexto.length);

  it('deja intactas las absolutas, data: y blob:', () => {
    expect(urlDelApi('https://x.test/a.png')).toBe('https://x.test/a.png');
    expect(urlDelApi('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
    expect(urlDelApi('blob:http://x/1')).toBe('blob:http://x/1');
  });

  it('antepone la API a una ruta relativa a ella', () => {
    expect(urlDelApi('/uploads/publico/a.png')).toBe(base + '/uploads/publico/a.png');
  });

  it('no duplica el contexto si la ruta ya lo trae (antes salía /api/api/...)', () => {
    expect(urlDelApi(contexto + '/uploads/publico/logo.png')).toBe(origen + contexto + '/uploads/publico/logo.png');
    expect(urlDelApi(contexto + '/uploads/publico/logo.png')).not.toContain(contexto + contexto + '/');
  });

  it('vacío o nulo da cadena vacía', () => {
    expect(urlDelApi(null)).toBe('');
    expect(urlDelApi('  ')).toBe('');
  });
});
