/**
 * Renderizador de Markdown minimo.
 *
 * Cubre solo lo que hace falta para los textos que redacta la institucion:
 * titulos, negritas, cursivas, codigo en linea y listas ordenadas y no
 * ordenadas. No se mete una libreria completa porque no hay ninguna en el
 * proyecto y porque este contenido es de confianza (lo escribe el super
 * administrador), no entrada de usuario final.
 *
 * Aun asi se escapa el HTML antes de interpretarlo. El texto llega del backend
 * y se pinta con [innerHTML], y aunque hoy solo lo edita el super administrador,
 * el dia que se conecte un editor externo o una importacion de contenido esto
 * seria un XSS servido desde el propio dominio. Escapar aqui y no en el
 * componente deja la garantia en un solo sitio, y por eso la funcion es pura y
 * se puede probar sin Angular.
 */

/** Escapa los cinco caracteres que tienen significado en HTML. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Negritas, cursivas y codigo dentro de una linea de texto ya escapada. */
function enLinea(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * Convierte Markdown a HTML.
 *
 * Las lineas de bloque (> cita) y los titulos (# a ######) se reconocen antes que
 * los parrafos, porque si no, un "> Borrador" se pintaria como texto suelto.
 */
export function markdownToHtml(md: string | null | undefined): string {
  if (!md) return '';
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let lista = '';
  let tipoLista: 'ul' | 'ol' | '' = '';
  // Líneas seguidas sin línea en blanco forman UN párrafo (o una cita), como en
  // cualquier Markdown: el texto se redacta con saltos para que quepa en el
  // editor, y antes cada salto se pintaba como un párrafo aparte.
  let parrafo: string[] = [];
  let cita: string[] = [];

  const cerrarParrafo = () => {
    if (parrafo.length) {
      out.push(`<p>${enLinea(escapar(parrafo.join(' ')))}</p>`);
      parrafo = [];
    }
  };

  const cerrarCita = () => {
    if (cita.length) {
      out.push(`<blockquote><p>${enLinea(escapar(cita.join(' ')))}</p></blockquote>`);
      cita = [];
    }
  };

  const cerrarLista = () => {
    cerrarParrafo();
    cerrarCita();
    if (lista) {
      out.push(`<${tipoLista}>${lista}</${tipoLista}>`);
      lista = '';
      tipoLista = '';
    }
  };

  for (const raw of lines) {
    const linea = raw.trim();

    if (!linea) {
      cerrarLista();
      continue;
    }

    const titulo = linea.match(/^(#{1,6})\s+(.+)$/);
    if (titulo) {
      cerrarLista();
      const nivel = titulo[1].length;
      out.push(`<h${nivel}>${enLinea(escapar(titulo[2]))}</h${nivel}>`);
      continue;
    }

    // Cita en bloque: se admite solo ">", que es lo que usa la plantilla de la
    // politica para el aviso de borrador.
    const lineaCita = linea.match(/^>\s?(.*)$/);
    if (lineaCita) {
      cerrarParrafo();
      if (lista) cerrarLista();
      if (lineaCita[1].trim()) cita.push(lineaCita[1].trim());
      continue;
    }

    const noOrdenada = linea.match(/^[-*]\s+(.+)$/);
    const ordenada = linea.match(/^\d+[.)]\s+(.+)$/);
    if (noOrdenada || ordenada) {
      cerrarParrafo();
      cerrarCita();
      const nuevo = noOrdenada ? 'ul' : 'ol';
      if (tipoLista && tipoLista !== nuevo) cerrarLista();
      tipoLista = nuevo;
      lista += `<li>${enLinea(escapar((noOrdenada || ordenada)![1]))}</li>`;
      continue;
    }

    cerrarCita();
    if (lista) cerrarLista();
    parrafo.push(linea);
  }

  cerrarLista();
  return out.join('\n');
}

/** Primeras lineas del documento, para la vista previa en el panel. */
export function previewMarkdown(md: string | null | undefined, maxChars = 400): string {
  if (!md) return '';
  const limpio = md
    // Quita el markdown de formato para que la vista previa se lea como texto.
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*]\s+/gm, '· ')
    .trim();
  return limpio.length > maxChars ? `${limpio.slice(0, maxChars)}...` : limpio;
}