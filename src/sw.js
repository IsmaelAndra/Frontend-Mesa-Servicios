/*
 * Service worker de la Mesa de Servicios.
 *
 * Existe para que Chrome/Edge instalen la mesa como aplicación (ventana propia,
 * sin la insignia del navegador en el icono) y para mostrar una página clara
 * cuando no hay conexión con el servidor (VPN desconectada).
 *
 * No guarda en caché la aplicación ni la API: los datos de tickets siempre se
 * piden al servidor, y una versión vieja en caché confundiría tras actualizar.
 */
const CACHE = 'mesa-sin-conexion-v1';
const PAGINA_SIN_CONEXION = '/offline.html';

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.add(PAGINA_SIN_CONEXION)));
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  // Solo la navegación (abrir una pantalla). La API y los archivos van directos.
  if (evento.request.mode !== 'navigate') return;
  evento.respondWith(
    fetch(evento.request).catch(() => caches.match(PAGINA_SIN_CONEXION)),
  );
});
