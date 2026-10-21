import { TemaTemporadaService } from './core/services/tema-temporada.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AdminService } from './core/services/admin.service';
import { AuthService } from './core/services/auth.service';
import { ToastService } from './core/services/toast.service';
import { applyBrandingTheme, setChatBackground } from './core/utils/branding-theme.util';
import {
  LoadingScreenView,
  resolveLoadingScreen,
} from './core/utils/loading-screen.util';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Mesa de Servicios COAC';
  isAuthPage = false;
  /** true hasta que el router resuelve la primera ruta: muestra el splash. */
  booting = true;
  /**
   * Vista del splash ya resuelta. Arranca con los valores por defecto porque
   * este componente se dibuja antes de que llegue la configuracion de marca;
   * en cuanto responde GET /admin/branding se reemplaza por la real.
   */
  loadingScreen: LoadingScreenView = resolveLoadingScreen(null, this.title);
  private routerSub?: Subscription;
  private brandingSub?: Subscription;
  /** Momento en que se pidio la primera ruta, para respetar la duracion minima. */
  private readonly arranque = Date.now();
  private hideTimer?: ReturnType<typeof setTimeout>;
  private safetyTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private router: Router,
    private adminService: AdminService,
    private authService: AuthService,
    private temaTemporada: TemaTemporadaService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.isAuthPage = this.router.url.startsWith('/auth');
    this.loadBrandingIcons();
    // Tema de temporada (Halloween, Navidad...): público, vale también en el login.
    this.temaTemporada.cargar().subscribe();
    this.routerSub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(event => {
      const url = (event as NavigationEnd).url;
      this.isAuthPage = url.startsWith('/auth');
      this.ocultarSplash();
      if (url.startsWith('/admin/branding')) {
        this.loadBrandingIcons();
      }
    });
    // Red de seguridad: si el router no emite (por ejemplo en una ruta mal
    // formada) el splash no se queda pegado.
    this.armarSeguridad();

    // El reloj de la sesión vive en la raíz: así el contador del navbar no se
    // reinicia al navegar entre pantallas.
    this.authService.startSessionClock();
    this.cierreSub = this.authService.sesionCerrada$.subscribe((motivo) => {
      if (this.router.url.startsWith('/auth')) return;
      this.toast.warn(
        motivo === 'inactividad'
          ? `Tu sesión se cerró tras ${this.authService.idleMinutos()} minutos sin actividad. Vuelve a iniciar sesión.`
          : 'Tu sesión expiró. Vuelve a iniciar sesión para continuar.',
        'Sesión cerrada',
        { duration: 10_000 },
      );
      this.router.navigate(['/auth/login'], { queryParams: { volver: this.router.url } });
    });
  }

  private cierreSub?: Subscription;

  ngOnDestroy(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    if (this.safetyTimer) clearTimeout(this.safetyTimer);
    this.routerSub?.unsubscribe();
    this.brandingSub?.unsubscribe();
    this.cierreSub?.unsubscribe();
  }

  /**
   * Cierra el splash respetando la duracion minima configurada: en arranques
   * rapidos el splash aparecia y desaparecia en un parpadeo, que se lee como
   * un fallo de la pagina.
   */
  private ocultarSplash(): void {
    if (!this.booting) {
      return;
    }
    const restante = this.loadingScreen.minDurationMs - (Date.now() - this.arranque);
    if (restante > 0) {
      if (this.hideTimer) clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => {
        this.hideTimer = undefined;
        this.booting = false;
      }, restante);
      return;
    }
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = undefined;
    }
    this.booting = false;
  }

  /** Cierre forzado, sin esperar la duracion minima. */
  private forzarOcultar(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
    this.booting = false;
  }

  private armarSeguridad(): void {
    if (this.safetyTimer) clearTimeout(this.safetyTimer);
    this.safetyTimer = setTimeout(
      () => this.forzarOcultar(),
      this.loadingScreen.minDurationMs + 2500,
    );
  }

  private loadBrandingIcons(): void {
    this.brandingSub?.unsubscribe();
    this.brandingSub = this.adminService.getBranding().subscribe({
      next: (b) => {
        this.loadingScreen = resolveLoadingScreen(b, this.title);
        applyBrandingTheme({ primaryColor: b.primaryColor, secondaryColor: b.secondaryColor });
        setChatBackground(b.chatBackgroundLightUrl || b.chatBackgroundUrl, b.chatBackgroundDarkUrl);
        // El login no pedía el fondo y el logo hasta que acababa la pantalla de
        // carga: en producción el fondo aparecía a los 4 s. Se empiezan a bajar
        // ahora, en paralelo, y cuando el login los pide ya están en caché.
        if (this.router.url.startsWith('/auth') || location.pathname.startsWith('/auth')) {
          precargarImagenes([b.backgroundUrl, b.logoLoginUrl || b.logoUrl]);
        }
        // La marca puede traer una duracion minima mayor que la inicial.
        if (this.booting) {
          this.armarSeguridad();
        }
      }
    });
  }
}

/** Descarga imágenes en segundo plano para que estén en caché cuando se pinten. */
function precargarImagenes(urls: (string | null | undefined)[]): void {
  for (const url of urls) {
    if (!url) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  }
}
