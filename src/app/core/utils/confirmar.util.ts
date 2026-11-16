import Swal from 'sweetalert2';

/**
 * Confirmación única de la app: título, texto, "Cancelar" a la izquierda y la
 * acción a la derecha (en rojo si destruye algo), con el foco en Cancelar.
 * Antes convivían cuatro estilos ("Sí", "Sí, eliminar", botones invertidos...).
 */
export function confirmar(opciones: {
  titulo: string;
  texto?: string;
  html?: string;
  accion?: string;
  peligro?: boolean;
}): Promise<boolean> {
  const peligro = opciones.peligro !== false;
  return Swal.fire({
    title: opciones.titulo,
    text: opciones.html ? undefined : opciones.texto,
    html: opciones.html,
    icon: peligro ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: opciones.accion || (peligro ? 'Eliminar' : 'Aceptar'),
    cancelButtonText: 'Cancelar',
    confirmButtonColor: peligro ? '#dc2626' : '#062e86',
    cancelButtonColor: '#6b7280',
    reverseButtons: true,
    focusCancel: peligro,
  }).then((r) => r.isConfirmed);
}
