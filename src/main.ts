import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

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
