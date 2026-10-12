import { markdownToHtml, previewMarkdown } from './markdown.util';

/**
 * Renderizador de Markdown de la politica de privacidad.
 *
 * El cuerpo se pinta con [innerHTML], asi que el caso que hay que cubrir de verdad
 * es el escapado: si un caracter reservado se cuela, se abre un XSS servido
 * desde el propio dominio. Los demas tests fijan que los titulos, listas y citas
 * del borrador se reconozcan, porque si no la pagina sale toda en un solo
 * bloque y el super administrador no puede dar formato al texto.
 */
describe('markdown.util', () => {
  describe('escapado', () => {
    it('escapa el HTML del contenido antes de aplicar formato', () => {
      expect(markdownToHtml('<script>alert(1)</script>')).toContain('&lt;script&gt;');
      expect(markdownToHtml('<script>alert(1)</script>')).not.toContain('<script>');
    });

    it('escapa los atributos de una etiqueta inyectada', () => {
      const h = markdownToHtml('<img src=x onerror="alert(1)">');
      expect(h).toContain('&lt;img');
      expect(h).not.toContain('<img');
    });

    it('escapa comillas y comillas simples', () => {
      expect(markdownToHtml('"hola"')).toContain('&quot;hola&quot;');
      expect(markdownToHtml("'hola'")).toContain('&#39;hola&#39;');
    });

    it('el ampersand se escapa una sola vez, sin romper las entidades existentes', () => {
      expect(markdownToHtml('a & b')).toContain('a &amp; b');
      expect(markdownToHtml('&lt;')).toContain('&amp;lt;');
    });

    it('el escapado ocurre antes que el formato: **<b>x</b>** sale en negrita y sin etiqueta', () => {
      const h = markdownToHtml('**<b>x</b>**');
      expect(h).toContain('<strong>');
      expect(h).toContain('&lt;b&gt;');
      expect(h).not.toContain('<b>');
    });
  });

  describe('formato', () => {
    it('convierte los titulos', () => {
      expect(markdownToHtml('# Uno')).toBe('<h1>Uno</h1>');
      expect(markdownToHtml('## Dos')).toBe('<h2>Dos</h2>');
      expect(markdownToHtml('### Tres')).toBe('<h3>Tres</h3>');
    });

    it('aplica negritas, cursivas y codigo', () => {
      expect(markdownToHtml('**fuerte**')).toContain('<strong>fuerte</strong>');
      expect(markdownToHtml('*suave*')).toContain('<em>suave</em>');
      expect(markdownToHtml('`x = 1`')).toContain('<code>x = 1</code>');
    });

    it('agrupa las listas con guiones', () => {
      const h = markdownToHtml('- uno\n- dos');
      expect(h).toBe('<ul><li>uno</li><li>dos</li></ul>');
    });

    it('agrupa las listas numeradas', () => {
      const h = markdownToHtml('1. uno\n2. dos');
      expect(h).toBe('<ol><li>uno</li><li>dos</li></ol>');
    });

    it('cierra una lista antes de abrir la otra', () => {
      const h = markdownToHtml('- uno\n1. dos');
      expect(h).toContain('<ul><li>uno</li></ul>');
      expect(h).toContain('<ol><li>dos</li></ol>');
    });

    it('reconoce la cita en bloque que usa el borrador', () => {
      const h = markdownToHtml('> **Borrador.** Texto');
      expect(h).toContain('<blockquote>');
      expect(h).toContain('<strong>Borrador.</strong>');
    });

    it('cierra la lista abierta al terminar el documento', () => {
      const h = markdownToHtml('- uno\n- dos');
      expect(h.endsWith('</ul>')).toBe(true);
    });

    it('los saltos de linea sueltos no crean parrafos vacios', () => {
      const h = markdownToHtml('# Titulo\n\n\nTexto');
      expect(h).toBe('<h1>Titulo</h1>\n<p>Texto</p>');
    });

    it('las lineas seguidas forman un solo parrafo; la linea en blanco los separa', () => {
      expect(markdownToHtml('uno\ndos\n\ntres')).toBe('<p>uno dos</p>\n<p>tres</p>');
    });

    it('una cita de varias lineas es un solo bloque', () => {
      const h = markdownToHtml('> **Borrador.** primera\n> segunda');
      expect(h).toBe('<blockquote><p><strong>Borrador.</strong> primera segunda</p></blockquote>');
    });

    it('normaliza los saltos de linea de Windows', () => {
      expect(markdownToHtml('# Titulo\r\n\r\nTexto')).toBe('<h1>Titulo</h1>\n<p>Texto</p>');
    });
  });

  describe('entradas vacias', () => {
    it('devuelve cadena vacia sin contenido', () => {
      expect(markdownToHtml('')).toBe('');
      expect(markdownToHtml(null)).toBe('');
      expect(markdownToHtml(undefined)).toBe('');
    });
  });

  describe('previewMarkdown', () => {
    it('quita el formato para poder leer el texto de un vistazo', () => {
      expect(previewMarkdown('## Titulo')).toBe('Titulo');
      expect(previewMarkdown('- uno\n- dos')).toBe('· uno\n· dos');
      expect(previewMarkdown('**fuerte**')).toBe('fuerte');
    });

    it('recorta cuando es demasiado largo', () => {
      const largo = 'a'.repeat(500);
      expect(previewMarkdown(largo).endsWith('...')).toBe(true);
      expect(previewMarkdown(largo).length).toBeLessThanOrEqual(403);
    });

    it('deja intacto un texto corto', () => {
      expect(previewMarkdown('corto')).toBe('corto');
      expect(previewMarkdown('')).toBe('');
      expect(previewMarkdown(null)).toBe('');
    });
  });
});