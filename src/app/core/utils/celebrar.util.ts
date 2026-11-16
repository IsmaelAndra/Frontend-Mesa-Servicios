/**
 * Pequeña celebración (confeti) sobre un elemento: se usa al pasar un ticket a
 * RESUELTO. Son 16 trocitos con position: fixed que salen del centro de la
 * tarjeta y se quitan solos en ~0,9 s. Con "reducir movimiento" no hace nada.
 * Usa la Web Animations API: no necesita reglas en styles.css.
 */
const COLORES = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#062e86'];

export function celebrar(el: HTMLElement | null | undefined): void {
  if (!el || typeof window === 'undefined' || typeof el.animate !== 'function') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + Math.min(r.height / 2, 40);
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('span');
    p.setAttribute('aria-hidden', 'true');
    Object.assign(p.style, {
      position: 'fixed', left: `${x}px`, top: `${y}px`, width: '7px', height: '10px',
      borderRadius: '2px', background: COLORES[i % COLORES.length], pointerEvents: 'none', zIndex: '1200',
    });
    document.body.appendChild(p);
    const angulo = (Math.PI * 2 * i) / 16 + Math.random() * 0.4;
    const d = 50 + Math.random() * 45;
    const dx = Math.cos(angulo) * d;
    const dy = Math.sin(angulo) * d + 5;
    const giro = Math.round(Math.random() * 540 - 270);
    p.animate(
      [
        { transform: 'translate(-50%, -50%)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${giro}deg)`, opacity: 0 },
      ],
      { duration: 900, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' },
    ).onfinish = () => p.remove();
  }
}
