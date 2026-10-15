import { Component, ElementRef, OnDestroy, QueryList, ViewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminService } from '../../../core/services/admin.service';
import * as QRCode from 'qrcode';

/**
 * Pantalla del segundo factor, unificada para las dos fases.
 *
 * <p>Son dos momentos distintos con el mismo gesto: el usuario tiene que teclear
 * seis dígitos de la app. En la fase de alta, además, tiene que escanear antes un
 * QR. Separarlos en dos pantallas obligaría al usuario a volver atrás si se
 * equivoca al teclear, y el error más probable ahí es justo teclear mal.
 */
@Component({
  selector: 'app-mfa-verify',
  templateUrl: './mfa-verify.component.html'
})
export class MfaVerifyComponent implements OnDestroy {
  /** Estado devuelto por el login: ENROLAR o VERIFICAR. */
  challenge = this.auth.mfaPendiente;

  /** true mientras se está grabando el QR. */
  qrDataUrl = '';
  qrError = '';

  /** Los seis dígitos, uno por input. */
  digitos: string[] = ['', '', '', '', '', ''];

  /** Mode de recuperación: acepta el código de 10 caracteres, no seis dígitos. */
  usandoRecuperacion = false;
  codigoRecuperacion = '';

  loading = false;
  /** Se guarda una sola vez, para poder avisar de que no hay vuelta atrás. */
  codigosRecuperacion: string[] | null = null;

  /** Las seis casillas, para saltar el foco entre ellas. */
  readonly posiciones = [0, 1, 2, 3, 4, 5];

  @ViewChildren('digito') campos!: QueryList<ElementRef<HTMLInputElement>>;

  /** Fondo y logo del login (la marca guardada pinta al instante; la respuesta la actualiza). */
  fondoUrl = '';
  logoUrl = '';

  constructor(
    private auth: AuthService,
    private toast: ToastService,
    private router: Router,
    admin: AdminService
  ) {
    const marca = admin.brandingGuardado();
    this.fondoUrl = marca?.backgroundUrl || '';
    this.logoUrl = marca?.logoLoginUrl || marca?.logoUrl || '';
    admin.getBranding().subscribe({
      next: (b) => {
        this.fondoUrl = b.backgroundUrl || '';
        this.logoUrl = b.logoLoginUrl || b.logoUrl || '';
      },
      error: () => undefined,
    });
    // Sin desafío no hay nada que hacer aquí: se vuelve al acceso. Puede pasar si
    // el usuario recarga la página en medio del proceso.
    if (!this.challenge) {
      this.router.navigate(['/auth/login']);
      return;
    }
    if (this.challenge.status === 'ENROLAR' && this.challenge.qrUri) {
      this.pintarQr(this.challenge.qrUri);
    }
  }

  ngOnDestroy(): void {
    this.codigosRecuperacion = null;
  }

  /**
   * Dibuja el QR.
   *
   * <p>Se genera como imagen en el propio navegador: la clave nunca sale de aquí
   * más allá de la petición que ya hizo el login, y no hace falta ninguna
   * librería en el servidor para pintar un cuadradito.
   */
  private pintarQr(uri: string): void {
    QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 240,
      color: { dark: '#062e86', light: '#ffffff' }
    })
      .then((url: string) => {
        this.qrDataUrl = url;
      })
      .catch(() => {
        this.qrError = 'No se pudo generar el código. Use la clave manual.';
      });
  }

  get esAlta(): boolean {
    return this.challenge?.status === 'ENROLAR';
  }

  get codigoCompleto(): string {
    return this.digitos.join('');
  }

  get puedeConfirmar(): boolean {
    if (this.loading) return false;
    if (this.usandoRecuperacion) {
      return this.codigoRecuperacion.replace(/[\s-]/g, '').length === 10;
    }
    return this.digitos.every((d) => d !== '');
  }

  /**
   * Un input de un solo carácter no puede aceptar dos, así que el pegado del
   * código entero se reparte entre los seis.
   */
  onPaste(event: ClipboardEvent): void {
    const texto = (event.clipboardData?.getData('text') || '').replace(/\D/g, '');
    if (!texto) return;
    event.preventDefault();
    const nuevos = texto.split('').slice(0, 6);
    this.digitos = ['', '', '', '', '', ''];
    nuevos.forEach((d, i) => (this.digitos[i] = d));
    this.enfocar(nuevos.length < 6 ? nuevos.length : 5);
    this.confirmarSiCompleto();
  }

  /** Con los seis dígitos ya escritos se verifica sin pulsar nada. */
  private confirmarSiCompleto(): void {
    if (!this.usandoRecuperacion && this.puedeConfirmar) {
      setTimeout(() => this.confirmar());
    }
  }

  onInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const valor = input.value.replace(/\D/g, '');
    if (!valor) {
      this.digitos[index] = '';
      return;
    }
    // Varias cifras de golpe (teclado numérico móvil, autocompletado): se
    // reparten a partir de la casilla actual en lugar de quedar una sola.
    const cifras = valor.split('');
    cifras.forEach((c, i) => {
      if (index + i < 6) {
        this.digitos[index + i] = c;
      }
    });
    this.enfocar(Math.min(index + cifras.length, 5));
    this.confirmarSiCompleto();
  }

  onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digitos[index] && index > 0) {
      this.digitos[index - 1] = '';
      this.enfocar(index - 1);
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.enfocar(index - 1);
    } else if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      this.enfocar(index + 1);
    }
    // Enter lo gestiona el <form> (ngSubmit): funciona en cualquier campo,
    // también en el del código de recuperación.
  }

  private enfocar(index: number): void {
    const campo = this.campos?.get(index);
    if (campo) {
      campo.nativeElement.focus();
      campo.nativeElement.select();
    }
  }

  alternarRecuperacion(): void {
    this.usandoRecuperacion = !this.usandoRecuperacion;
    if (this.usandoRecuperacion) {
      this.digitos = ['', '', '', '', '', ''];
    } else {
      this.codigoRecuperacion = '';
    }
  }

  confirmar(): void {
    if (!this.puedeConfirmar) return;
    this.loading = true;
    const llamada = this.usandoRecuperacion
      ? this.auth.confirmarMfa('', this.codigoRecuperacion)
      : this.auth.confirmarMfa(this.codigoCompleto);

    llamada.subscribe({
      next: (res) => {
        this.loading = false;
        // Los códigos de recuperación solo vienen la vez del alta. Si vienen, se
        // paran a mostrarlos antes de dejarle seguir: si el usuario cierra la
        // pestaña aquí, se quedan sin copia y no hay segunda oportunidad.
        if (res.recoveryCodes && res.recoveryCodes.length > 0) {
          this.codigosRecuperacion = res.recoveryCodes;
          return;
        }
        this.entrar();
      },
      error: (err) => {
        this.loading = false;
        this.digitos = ['', '', '', '', '', ''];
        this.enfocar(0);
        this.toast.error(err?.error?.message || 'El código no es correcto');
      }
    });
  }

  /** Continúa tras ver los códigos de recuperación, o tras el alta sin códigos. */
  continuar(): void {
    this.entrar();
  }

  /** Avanza al destino de siempre, respetando el cambio de contraseña pendiente. */
  private entrar(): void {
    if (this.auth.mustChangePassword()) {
      this.router.navigate(['/settings/password']);
      return;
    }
    this.router.navigate(['/dashboard']);
  }

  /**
   * Vuelve al acceso sin confirmar nada.
   *
   * <p>No hace falta revocar el desafío: caduca solo a los cinco minutos y pedir
   * uno nuevo desde el login invalida el anterior. Lo que sí hay que hacer es
   * limpiar el estado local, o al volver a entrar el componente encontraría el
   * desafío viejo y mostraría un QR que ya no corresponde a nada.
   */
  volverAlAcceso(): void {
    this.auth.limpiarDesafioMfa();
    this.router.navigate(['/auth/login']);
  }

  copiarCodigos(): void {
    const texto = (this.codigosRecuperacion || []).join('\n');
    if (!texto || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(texto).then(
      () => this.toast.success('Códigos copiados'),
      () => this.toast.error('No se pudo copiar; anótelos a mano')
    );
  }

  copiarClaveManual(): void {
    const clave = (this.challenge?.claveManual || '').replace(/\s/g, '');
    if (!clave) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(clave).then(
        () => this.toast.success('Clave copiada'),
        () => this.toast.error('No se pudo copiar; tecléela a mano')
      );
    }
  }
}