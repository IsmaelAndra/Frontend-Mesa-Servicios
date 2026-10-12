/*
 * Aplica el tema guardado antes de pintar la página, para que no parpadee en
 * claro al abrir en modo oscuro. Va en un archivo aparte y no en línea dentro de
 * index.html porque la CSP del servidor no admite scripts en línea.
 */
(function() {
  try {
    var t = localStorage.getItem('theme');
    var dark = t === 'dark'
      || ((t === 'system' || !t) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
