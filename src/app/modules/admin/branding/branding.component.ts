import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService, BrandingConfig } from '../../../core/services/admin.service';

@Component({
  selector: 'app-branding',
  templateUrl: './branding.component.html'
})
export class BrandingComponent implements OnInit {
  config: BrandingConfig = { logoUrl: '', backgroundUrl: '', primaryColor: '#062e86', secondaryColor: '#ec9811' };
  loading = false;
  logoFile: File | null = null;
  logoPreview = '';
  backgroundFile: File | null = null;
  backgroundPreview = '';

  constructor(private adminService: AdminService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.adminService.getBranding().subscribe({
      next: (c) => {
        this.config = c;
        this.logoPreview = c.logoUrl || '';
        this.backgroundPreview = c.backgroundUrl || '';
      },
      error: () => {
        this.config = { logoUrl: '', backgroundUrl: '', primaryColor: '#062e86', secondaryColor: '#ec9811' };
        this.logoPreview = '';
        this.backgroundPreview = '';
      }
    });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.logoFile = input.files?.[0] || null;
    if (this.logoFile) {
      const reader = new FileReader();
      reader.onload = () => this.logoPreview = reader.result as string;
      reader.readAsDataURL(this.logoFile);
    }
  }

  onBackgroundSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.backgroundFile = input.files?.[0] || null;
    if (this.backgroundFile) {
      const reader = new FileReader();
      reader.onload = () => this.backgroundPreview = reader.result as string;
      reader.readAsDataURL(this.backgroundFile);
    }
  }

  uploadLogo(): void {
    if (!this.logoFile) return;
    this.loading = true;
    this.adminService.uploadLogo(this.logoFile).subscribe({
      next: (res) => { this.config.logoUrl = res.url; this.logoPreview = res.url; this.loading = false; Swal.fire('Éxito', 'Logo subido', 'success'); },
      error: (e) => { this.loading = false; Swal.fire('Error', e?.error?.message || 'No se pudo subir el logo', 'error'); }
    });
  }

  uploadBackground(): void {
    if (!this.backgroundFile) return;
    this.loading = true;
    this.adminService.uploadBackground(this.backgroundFile).subscribe({
      next: (res) => { this.config.backgroundUrl = res.url; this.backgroundPreview = res.url; this.loading = false; Swal.fire('Éxito', 'Imagen de fondo subida', 'success'); },
      error: (e) => { this.loading = false; Swal.fire('Error', e?.error?.message || 'No se pudo subir la imagen de fondo', 'error'); }
    });
  }

  saveColors(): void {
    this.loading = true;
    this.adminService.updateBranding(this.config).subscribe({
      next: () => { this.loading = false; Swal.fire('Éxito', 'Colores actualizados', 'success'); this.applyColors(); },
      error: (e) => { this.loading = false; Swal.fire('Error', e?.error?.message, 'error'); }
    });
  }

  applyColors(): void {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', this.config.primaryColor);
    root.style.setProperty('--secondary-color', this.config.secondaryColor);
    // Update DaisyUI theme dynamically
    const style = document.createElement('style');
    style.innerHTML = `
      [data-theme="light"] {
        --p: ${this.hexToRgb(this.config.primaryColor).join(', ')};
        --pc: ${this.hexToRgb(this.contrastColor(this.config.primaryColor)).join(', ')};
        --s: ${this.hexToRgb(this.config.secondaryColor).join(', ')};
        --sc: ${this.hexToRgb(this.contrastColor(this.config.secondaryColor)).join(', ')};
      }
    `;
    document.head.appendChild(style);
  }

  private hexToRgb(hex: string): string[] {
    const h = hex.replace('#', '');
    return [parseInt(h.substring(0,2),16), parseInt(h.substring(2,4),16), parseInt(h.substring(4,6),16)].map(String);
  }

  private contrastColor(hex: string): string {
    const rgb = this.hexToRgb(hex).map(Number);
    const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    return luminance > 186 ? '#000000' : '#ffffff';
  }
}