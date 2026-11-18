import Swal from 'sweetalert2';

/**
 * Pide el código de 6 dígitos de la app de autenticación con 6 casillas, igual
 * que la pantalla de doble factor del login (avanza solo, retrocede con la
 * tecla de borrar y acepta pegar el código entero). Devuelve el código o null.
 *
 * Si se indica `palabra` (p. ej. RESTABLECER), después del código pide escribir
 * esa palabra: para acciones que borran datos.
 */
export async function pedirCodigoMfa(opciones: {
  titulo?: string;
  texto?: string;
  /** HTML ya seguro (sin datos del usuario sin escapar). */
  html?: string;
  palabra?: string;
  accion?: string;
}): Promise<string | null> {
  const casillas = Array.from({ length: 6 }, (_, i) =>
    `<input class="casilla-codigo-swal" data-i="${i}" type="text" inputmode="numeric" `
    + `autocomplete="${i === 0 ? 'one-time-code' : 'off'}" maxlength="1" aria-label="Dígito ${i + 1} de 6" />`).join('');
  const cuerpo = (opciones.html ?? escapar(opciones.texto ?? 'Escriba el código de 6 dígitos de su app de autenticación.'))
    + `<div class="casillas-codigo-swal" role="group" aria-label="Código de verificación">${casillas}</div>`;

  const r = await Swal.fire({
    title: opciones.titulo ?? 'Código de verificación',
    html: cuerpo,
    icon: undefined,
    showCancelButton: true,
    reverseButtons: true,
    confirmButtonText: opciones.palabra ? 'Continuar' : (opciones.accion ?? 'Confirmar'),
    cancelButtonText: 'Cancelar',
    cancelButtonColor: '#6b7280',
    focusConfirm: false,
    didOpen: (popup) => conectarCasillas(popup),
    preConfirm: () => {
      const codigo = leerCasillas(Swal.getPopup());
      if (!/^\d{6}$/.test(codigo)) {
        Swal.showValidationMessage('Escriba los 6 dígitos');
        return false;
      }
      return codigo;
    },
  });
  if (!r.isConfirmed) return null;
  const codigo = String(r.value);

  if (opciones.palabra) {
    const palabra = opciones.palabra;
    const c = await Swal.fire({
      title: `Escriba ${palabra}`,
      text: 'Esta acción borra la base de datos actual y no se puede deshacer.',
      icon: 'warning',
      input: 'text',
      inputAttributes: { autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false' },
      inputValidator: (v) => ((v || '').trim().toUpperCase() === palabra ? null : `Escriba ${palabra}`),
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: opciones.accion ?? 'Borrar y continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      focusCancel: true,
    });
    if (!c.isConfirmed) return null;
  }
  return codigo;
}

function leerCasillas(popup: HTMLElement | null): string {
  return Array.from(popup?.querySelectorAll<HTMLInputElement>('.casilla-codigo-swal') ?? [])
    .map((i) => i.value).join('');
}

function conectarCasillas(popup: HTMLElement): void {
  const inputs = Array.from(popup.querySelectorAll<HTMLInputElement>('.casilla-codigo-swal'));
  const rellenar = (desde: number, digitos: string) => {
    digitos.split('').forEach((d, k) => {
      if (inputs[desde + k]) inputs[desde + k].value = d;
    });
    const siguiente = Math.min(desde + digitos.length, inputs.length - 1);
    inputs[siguiente].focus();
    if (leerCasillas(popup).length === 6) Swal.clickConfirm();
  };
  inputs.forEach((input, i) => {
    input.addEventListener('input', () => {
      const solo = input.value.replace(/\D/g, '');
      input.value = '';
      if (solo) rellenar(i, solo.slice(0, 6 - i));
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && i > 0) {
        inputs[i - 1].value = '';
        inputs[i - 1].focus();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' && i > 0) {
        inputs[i - 1].focus();
      } else if (e.key === 'ArrowRight' && i < inputs.length - 1) {
        inputs[i + 1].focus();
      } else if (e.key === 'Enter') {
        Swal.clickConfirm();
      }
    });
    input.addEventListener('paste', (e) => {
      const texto = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 6);
      if (texto) {
        e.preventDefault();
        inputs.forEach((x) => (x.value = ''));
        rellenar(0, texto);
      }
    });
  });
  setTimeout(() => inputs[0]?.focus(), 50);
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
