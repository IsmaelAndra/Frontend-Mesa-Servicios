import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AdminService, BrandingConfig, PrivacyPolicy } from '../../../core/services/admin.service';
import { environment } from '../../../../environments/environment';
import { markdownToHtml } from '../../../core/utils/markdown.util';

/**
 * Política de privacidad, pagina publica y sin sesion.
 *
 * Es la pagina que mas se consulta cuando el problema es un 403 o un 500, asi
 * que va fuera del bloque con AuthGuard y comparte tratamiento con la pantalla
 * de error: si el backend no responde, se avisa en lugar de mostrar un hueco.
 *
 * El cuerpo llega en markdown desde el panel y se pasa por el sanitizador de
 * Angular antes de pintarlo. El markdown.util ya escapa el HTML del texto, pero
 * el sanitizer es la segunda barrera y es la que evita que un descuido futuro en
 * el parser se convierta en un XSS.
 */
@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.component.html',
  styleUrls: ['./privacy.component.css'],
})
export class PrivacyComponent implements OnInit {
  politica: PrivacyPolicy | null = null;
  branding: BrandingConfig | null = null;
  cargando = true;
  /** false si el backend no respondio; entonces se avisa en lugar de mostrar un texto vacio. */
  disponible = true;

  html: SafeHtml = '';

  constructor(
    private adminService: AdminService,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.adminService.getPrivacyPolicy().subscribe({
      next: (p) => {
        this.politica = p;
        this.html = this.sanitizer.bypassSecurityTrustHtml(markdownToHtml(p.privacyContent));
        this.cargando = false;
      },
      error: () => {
        this.disponible = false;
        this.cargando = false;
      },
    });
    this.adminService.getBranding().subscribe({
      next: (b) => (this.branding = b),
      error: () => undefined,
    });
  }

  get titulo(): string {
    return this.politica?.privacyTitle || 'Política de privacidad';
  }

  get version(): string {
    return this.politica?.privacyVersion || '';
  }

  get vigente(): string {
    return this.politica?.privacyEffective || '';
  }

  get contacto(): string {
    return this.politica?.privacyContact || '';
  }

  /** El borrador sembrado avisa al visitante de que el texto no es el oficial. */
  get esBorrador(): boolean {
    return this.politica?.edited === false;
  }

  get logo(): string {
    const url = this.branding?.logoUrl || this.branding?.systemIconUrl || '';
    return this.absoluta(url);
  }

  private absoluta(url: string): string {
    if (!url) return '';
    return /^https?:\/\//i.test(url) ? url : `${environment.apiUrl}${url}`;
  }

  volver(): void {
    this.router.navigate(['/dashboard']);
  }
}