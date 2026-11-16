/**
 * Misma regla que el backend (UserService.telefonoValido): dígitos con +,
 * espacios, guiones o paréntesis y entre 7 y 15 dígitos. Vacío es válido.
 */
export function telefonoInvalido(t: string | null | undefined, anterior?: string | null): boolean {
  const v = (t || '').trim();
  if (!v) return false;
  // Si no cambió, no se valida: un teléfono viejo mal escrito no impide editar lo demás.
  if (anterior != null && v === anterior.trim()) return false;
  const digitos = v.replace(/\D/g, '').length;
  return !/^[0-9+()\-\s]+$/.test(v) || digitos < 7 || digitos > 15;
}

export const MENSAJE_TELEFONO = 'Teléfono no válido: use solo números (7 a 15 dígitos)';
