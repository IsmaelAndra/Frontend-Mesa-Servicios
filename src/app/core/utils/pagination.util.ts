/**
 * Paginacion en cliente.
 *
 * Los endpoints de administracion (/admin/sla-rules, /admin/templates,
 * /admin/teams, /admin/areas, ...) devuelven la lista completa, asi que el corte
 * se hace en el navegador. Esta clase evita repetir en cada componente el mismo
 * `page`, `pageSize`, un getter con `slice` y dos manejadores de eventos.
 *
 * Uso en el componente:
 *   readonly pag = new Paginacion(() => this.teams);
 * en la plantilla:
 *   *ngFor="let t of pag.vista"
 *   <app-paginator [total]="teams.length" [page]="pag.page" [pageSize]="pag.pageSize"
 *     (pageChange)="pag.cambiarPagina($event)" (pageSizeChange)="pag.cambiarTamano($event)" />
 */
export interface PageState {
  page: number;
  pageSize: number;
}

export function crearPageState(inicial = 10): PageState {
  return { page: 0, pageSize: inicial };
}

/**
 * Devuelve solo la porcion que corresponde a la pagina actual. Si el filtro
 * activo dejo menos elementos que la pagina actual, se recorta a la ultima
 * pagina con contenido en lugar de mostrar una tabla vacia.
 */
export function cortar<T>(items: T[], estado: PageState): T[] {
  if (!items || items.length === 0) return [];
  const totalPaginas = Math.max(1, Math.ceil(items.length / estado.pageSize));
  const pagina = Math.min(estado.page, totalPaginas - 1);
  return items.slice(pagina * estado.pageSize, (pagina + 1) * estado.pageSize);
}

export class Paginacion<T> {
  page = 0;
  pageSize: number;

  /** Se pasa como funcion para que `vista` recoja recargas posteriores. */
  constructor(private readonly fuente: () => T[], inicial = 10) {
    this.pageSize = inicial;
  }

  /** Elementos de la pagina actual. */
  get vista(): T[] {
    return cortar(this.fuente(), this);
  }

  /** Total de elementos, para el `total` del app-paginator. */
  get total(): number {
    return this.fuente()?.length ?? 0;
  }

  cambiarPagina(page: number): void {
    this.page = page;
  }

  cambiarTamano(pageSize: number): void {
    this.pageSize = pageSize;
    this.page = 0;
  }

  /** Vuelve a la primera pagina; se llama tras cargar un filtro nuevo. */
  reiniciar(): void {
    this.page = 0;
  }
}
