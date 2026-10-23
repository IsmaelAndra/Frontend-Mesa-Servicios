import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

// En producción el manifiesto lo genera el servidor, con el icono de la
// temporada vigente: así la app instalada cambia de icono (el navegador
// pregunta antes si se quiere actualizar). En desarrollo la API vive en otro
// puerto y se queda el manifiesto fijo de assets/.
if (environment.production) {
  const manifiesto = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (manifiesto) manifiesto.href = '/api/pages/public/manifest.webmanifest';
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));

// Service worker: permite instalar la mesa como aplicación (sin la insignia de
// Chrome en el icono) y muestra una página propia si la VPN está desconectada.
// Solo en contexto seguro (HTTPS o localhost); en otro caso el navegador no lo
// admite y la mesa funciona igual, sin instalarse como app.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
