/**
 * Mantiene dentro de la pantalla los menús desplegables de daisyUI
 * (`.dropdown` > `.dropdown-content`). En el teléfono, un menú anclado a la
 * derecha de un botón que no está en el borde (tiempo de sesión, notificaciones,
 * "Exportar") se abría con media parte fuera, por la izquierda.
 *
 * Al abrirse (foco o clic dentro de un `.dropdown`), se mide el menú y, si se
 * sale, se desplaza lo justo con `translate`. Una sola escucha para toda la app
 * (se instala en AppComponent). Las listas de `app-master-select` no lo
 * necesitan: ya se colocan solas en el <body>.
 */
const MARGEN = 8;

export function instalarAjusteDeDesplegables(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const alAbrir = (e: Event) => {
    const objetivo = e.target as Element | null;
    const dropdown = objetivo?.closest?.('.dropdown');
    if (!dropdown) return;
    // Enseguida (que no se vea fuera) y otra vez al terminar la animación de
    // daisyUI: mientras escala, el menú mide menos y el primer cálculo se queda corto.
    requestAnimationFrame(() => requestAnimationFrame(() => ajustar(dropdown)));
    setTimeout(() => ajustar(dropdown), 260);
  };
  document.addEventListener('focusin', alAbrir, true);
  document.addEventListener('click', alAbrir, true);
  return () => {
    document.removeEventListener('focusin', alAbrir, true);
    document.removeEventListener('click', alAbrir, true);
  };
}

export function ajustar(dropdown: Element): void {
  const menu = dropdown.querySelector<HTMLElement>(':scope > .dropdown-content');
  if (!menu) return;
  menu.style.translate = '';
  // Medida real, sin la escala de la animación de apertura.
  const escala = new DOMMatrixReadOnly(getComputedStyle(menu).transform === 'none' ? undefined : getComputedStyle(menu).transform).a || 1;
  const medida = menu.getBoundingClientRect();
  const extra = (medida.width / escala - medida.width) / 2;
  const r = { left: medida.left - extra, right: medida.right + extra, width: medida.width };
  if (!r.width) return;
  const ancho = document.documentElement.clientWidth;
  let dx = 0;
  if (r.right > ancho - MARGEN) dx = ancho - MARGEN - r.right;
  if (r.left + dx < MARGEN) dx = MARGEN - r.left;
  if (dx !== 0) menu.style.translate = `${Math.round(dx)}px 0`;
}
