import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { GlobalSearchService } from '../../../../core/services/global-search.service';
import {
  GlobalSearchResponse,
  SearchUserItem,
} from '../../../../models/search.model';
import { environment } from '../../../../../environments/environment';

type GrupoClave =
  | 'tickets'
  | 'agents'
  | 'users'
  | 'teams'
  | 'areas'
  | 'workflows'
  | 'assets';

interface GrupoDef {
  clave: GrupoClave;
  etiqueta: string;
  icono: string;
  color: string;
}

/** Una fila navegable del resultado, ya con su destino resuelto. */
interface Fila {
  grupo: GrupoClave;
  /** Posición global dentro del resultado, para el teclado. */
  pos: number;
  titulo: string;
  detalle: string;
  foto?: string;
  navegar: () => void;
}

/**
 * Buscador global (Ctrol/Comando + K o la lupa del navbar).
 *
 * <p>Vive montado en la raíz, junto al contenedor de toasts, para sobrevivir al
 * cambio de ruta. La búsqueda espera 300 ms tras la última tecla y exige al
 * menos dos caracteres: menos que eso es un barrido del índice sin utilidad.
 * El backend decide qué grupos sirve a cada rol; aquí solo se pintan los que
 * lleguen con resultados y se navega al destino concreto de cada tipo.
 */
@Component({
  selector: 'app-global-search',
  templateUrl: './global-search.component.html',
})
export class GlobalSearchComponent implements OnInit, OnDestroy {
  private static readonly MIN_CARACTERES = 2;

  abierto = false;
  termino = '';
  cargando = false;
  vacio = false;
  respuesta: GlobalSearchResponse | null = null;
  indiceSeleccionado = -1;

  @ViewChild('searchInput') private inputRef?: ElementRef<HTMLInputElement>;

  private filas: Fila[] = [];
  private terminoSubject = new Subject<string>();
  private searchSub?: Subscription;
  private actualSub?: Subscription;
  private openSub?: Subscription;

  readonly grupos: GrupoDef[] = [
    { clave: 'tickets', etiqueta: 'Tickets', icono: 'fa-solid fa-ticket', color: 'text-info' },
    { clave: 'agents', etiqueta: 'Agentes', icono: 'fa-solid fa-headset', color: 'text-primary' },
    { clave: 'users', etiqueta: 'Usuarios', icono: 'fa-regular fa-user', color: 'text-secondary' },
    { clave: 'teams', etiqueta: 'Equipos', icono: 'fa-solid fa-users', color: 'text-success' },
    { clave: 'areas', etiqueta: 'Áreas', icono: 'fa-solid fa-building-columns', color: 'text-warning' },
    { clave: 'assets', etiqueta: 'Activos de TI', icono: 'fa-solid fa-laptop', color: 'text-accent' },
    { clave: 'workflows', etiqueta: 'Workflows', icono: 'fa-solid fa-diagram-project', color: 'text-error' },
  ];

  constructor(
    private router: Router,
    private globalSearch: GlobalSearchService,
  ) {}

  ngOnInit(): void {
    // La búsqueda en sí: espera a que se deje de escribir y no repite llamadas
    // por el mismo término. Llega aquí el término en crudo; buscar() lo recorta.
    this.searchSub = this.terminoSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((t) => this.buscar(t));

    this.openSub = this.globalSearch.open$.subscribe(() => this.abrir());

    // Atajo global: funciona en cualquier pantalla salvo las de autenticación,
    // donde montar una búsqueda sobre los catálogos no tiene sentido.
    document.addEventListener('keydown', this.onKeydownGlobal);
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.actualSub?.unsubscribe();
    this.openSub?.unsubscribe();
    document.removeEventListener('keydown', this.onKeydownGlobal);
  }

  /** Ctrl/Cmd + K abre o cierra el buscador; fuera de rutas de autenticación. */
  private onKeydownGlobal = (event: KeyboardEvent): void => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (this.router.url.startsWith('/auth')) {
        return;
      }
      if (this.abierto) {
        this.cerrar();
      } else {
        this.abrir();
      }
    }
  };

  abrir(): void {
    if (this.abierto) {
      return;
    }
    this.abierto = true;
    this.vacio = false;
    if (!this.termino.trim()) {
      this.respuesta = null;
      this.reconstruirFilas();
    }
    setTimeout(() => this.inputRef?.nativeElement.focus(), 0);
  }

  cerrar(): void {
    this.abierto = false;
  }

  onTermino(event: Event): void {
    this.termino = (event.target as HTMLInputElement).value;
    this.terminoSubject.next(this.termino);
  }

  /** Limpia el término desde el botón del modal. */
  limpiar(): void {
    this.termino = '';
    this.respuesta = null;
    this.cargando = false;
    this.reconstruirFilas();
    this.inputRef?.nativeElement.focus();
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cerrar();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.mover(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.mover(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const fila =
        this.indiceSeleccionado >= 0
          ? this.filas[this.indiceSeleccionado]
          : this.filas[0];
      if (fila) {
        this.elegir(fila);
      }
    }
  }

  /** Desplaza la selección de teclado hacia delante o hacia atrás. */
  private mover(delta: number): void {
    if (this.filas.length === 0) {
      return;
    }
    const siguiente =
      (this.indiceSeleccionado + delta + this.filas.length) % this.filas.length;
    this.indiceSeleccionado = siguiente;
    document
      .querySelector(`[data-search-row="${siguiente}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }

  elegir(fila: Fila): void {
    this.cerrar();
    fila.navegar();
  }

  /** Enlace para que el teclado y el ratón compartan la misma lógica. */
  alHacerClic(fila: Fila, event: Event): void {
    (event.currentTarget as HTMLElement).blur();
    this.elegir(fila);
  }

  /** Filas de un grupo, con su posición global intacta para el teclado. */
  filasDelGrupo(clave: GrupoClave): Fila[] {
    return this.filas.filter((f) => f.grupo === clave);
  }

  /** Icono del grupo para las filas sin avatar (no es una persona). */
  iconoDe(clave: GrupoClave): string {
    return this.grupos.find((g) => g.clave === clave)?.icono || '';
  }

  /** "Ver todos" lleva al listado general del grupo con el término aplicado. */
  verTodos(clave: GrupoClave): void {
    this.cerrar();
    const q = this.termino.trim();
    switch (clave) {
      case 'tickets':
        this.router.navigate(['/tickets'], { queryParams: { keyword: q } });
        break;
      case 'users':
      case 'agents':
        this.router.navigate(['/admin/users'], { queryParams: { search: q } });
        break;
      case 'teams':
        this.router.navigate(['/admin/teams']);
        break;
      case 'areas':
        this.router.navigate(['/admin/areas']);
        break;
      case 'assets':
        this.router.navigate(['/activos']);
        break;
      case 'workflows':
        this.router.navigate(['/workflows']);
        break;
    }
  }

  private buscar(termino: string): void {
    const q = (termino || '').trim();
    if (q.length < GlobalSearchComponent.MIN_CARACTERES) {
      this.cargando = false;
      this.respuesta = null;
      this.reconstruirFilas();
      return;
    }
    this.cargando = true;
    this.actualSub?.unsubscribe();
    this.actualSub = this.globalSearch.buscar(q).subscribe({
      next: (r) => {
        this.cargando = false;
        this.respuesta = r;
        this.vacio =
          r.tickets.length === 0 &&
          r.agents.length === 0 &&
          r.users.length === 0 &&
          r.teams.length === 0 &&
          r.areas.length === 0 &&
          r.workflows.length === 0 &&
          r.assets.length === 0;
        this.reconstruirFilas();
      },
      error: () => {
        this.cargando = false;
        this.respuesta = null;
        this.reconstruirFilas();
      },
    });
  }

  /**
   * Aplana los grupos a filas navegables y les asigna su posición global. El
   * orden coincide con el de renderizado (los grupos se muestran en el mismo
   * orden), así el índice de teclado apunta siempre a la fila pintada.
   */
  private reconstruirFilas(): void {
    const filas: Fila[] = [];
    const r = this.respuesta;
    if (r) {
      for (const t of r.tickets || []) {
        filas.push({
          grupo: 'tickets',
          pos: 0,
          titulo: t.titleTicket || `Ticket #${t.numberTicket ?? ""}`,
          detalle: `#${t.numberTicket ?? ""} · ${t.status || ''}`,
          navegar: () => this.router.navigate(['/tickets', t.idTicket]),
        });
      }
      for (const a of r.agents || []) {
        filas.push(this.filaDePersona(a, 'agents'));
      }
      for (const u of r.users || []) {
        filas.push(this.filaDePersona(u, 'users'));
      }
      for (const t of r.teams || []) {
        filas.push({
          grupo: 'teams',
          pos: 0,
          titulo: t.nameTeam,
          detalle: t.descriptionTeam || '',
          navegar: () => this.router.navigate(['/admin/teams']),
        });
      }
      for (const a of r.areas || []) {
        filas.push({
          grupo: 'areas',
          pos: 0,
          titulo: a.nameArea,
          detalle: a.descriptionArea || '',
          navegar: () => this.router.navigate(['/admin/areas']),
        });
      }
      for (const a of r.assets || []) {
        filas.push({
          grupo: 'assets',
          pos: 0,
          titulo: `${a.codeAsset} · ${a.nameAsset}`,
          detalle: a.assignedUserName
            ? `${a.typeAsset} · ${a.statusAsset} · ${a.assignedUserName}`
            : `${a.typeAsset} · ${a.statusAsset}`,
          navegar: () => this.router.navigate(['/activos', a.idAsset]),
        });
      }
      for (const w of r.workflows || []) {
        filas.push({
          grupo: 'workflows',
          pos: 0,
          titulo: w.nameWorkflow,
          detalle: `Workflow · ${w.statusWorkflow || ''}`,
          navegar: () => this.router.navigate(['/workflows']),
        });
      }
    }
    this.filas = filas.map((f, i) => ({ ...f, pos: i }));
    this.indiceSeleccionado = -1;
  }

  private filaDePersona(p: SearchUserItem, grupo: 'users' | 'agents'): Fila {
    const detalle = p.area
      ? `${p.corporateEmailUser} · ${p.area}`
      : p.corporateEmailUser;
    return {
      grupo,
      pos: 0,
      titulo: p.displayName || p.corporateEmailUser,
      detalle,
      foto: this.fotoUrl(p),
      navegar: () =>
        this.router.navigate(['/admin/users'], {
          queryParams: { search: p.corporateEmailUser },
        }),
    };
  }

  private fotoUrl(p: SearchUserItem): string {
    if (!p.photoUrl) {
      return '';
    }
    return /^https?:\/\//i.test(p.photoUrl)
      ? p.photoUrl
      : `${environment.apiUrl}${p.photoUrl}`;
  }
}