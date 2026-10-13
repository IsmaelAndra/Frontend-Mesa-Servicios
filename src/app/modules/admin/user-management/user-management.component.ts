import { Component, OnInit } from "@angular/core";
import Swal from "sweetalert2";
import { ActivatedRoute } from "@angular/router";
import { AdminService } from "../../../core/services/admin.service";
import { Catalog, RegisterRequest, User } from "../../../models/user.model";
import { ToastService } from "../../../core/services/toast.service";
import { environment } from "../../../../environments/environment";
import { metaSesion } from "../../../core/utils/session-presence.util";
import { Paginacion } from "../../../core/utils/pagination.util";
import { MasterOption } from "../../shared/components/master-select/master-select.component";

@Component({
  selector: "app-user-management",
  templateUrl: "./user-management.component.html",
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  areas: { id: string; name: string; icon?: string; color?: string }[] = [];
  /** Sedes activas, del mismo catálogo público que usa el resto de selectores. */
  sucursales: { id: string; code: string; name: string; icon?: string; color?: string }[] = [];
  roles = ["ADMIN", "AGENT", "AREA_MANAGER", "USER"];
  search = "";
  role = "";
  status = "";

  /**
   * El endpoint devuelve el padrón completo; en una cooperativa son cientos de
   * usuarios, así que las cards se paginan. Al cambiar un filtro se vuelve a la
   * primera página: si no, se podía quedar en la 7 con solo 2 resultados.
   */
  readonly pag = new Paginacion<User>(() => this.users, 12);

  roleLabels: Record<string, string> = {
    SUPER_ADMIN: "Super Administrador",
    ADMIN: "Administrador",
    AGENT: "Agente",
    USER: "Usuario",
    AREA_MANAGER: "Jefe de área",
  };

  roleDescriptions: Record<string, string> = {
    SUPER_ADMIN: "Acceso total: administración y configuración avanzada",
    ADMIN: "Gestiona usuarios, áreas, configuraciones y reportes",
    AGENT: "Atiende y resuelve los tickets asignados",
    USER: "Crea y da seguimiento a sus propios tickets",
    AREA_MANAGER: "Como un usuario, y además ve y gestiona los activos de su área",
  };

  getRoleLabel(role: string): string {
    return this.roleLabels[role] || role;
  }

  /** Icono del badge de rol. */
  rolIcon(role: string): string {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'fa-solid fa-crown';
      case 'ADMIN':
        return 'fa-solid fa-user-shield';
      case 'AGENT':
        return 'fa-solid fa-headset';
      case 'USER':
        return 'fa-regular fa-user';
      case 'AREA_MANAGER':
        return 'fa-solid fa-user-tie';
      default:
        return 'fa-regular fa-user';
    }
  }

  /** Color del badge de rol, para que el chip lo pinte igual que los demas. */
  rolColor(role: string): string {
    switch (role) {
      case 'SUPER_ADMIN':
        return '#7C3AED';
      case 'ADMIN':
        return '#062e86';
      case 'AGENT':
        return '#0E7490';
      case 'USER':
        return '#64748B';
      case 'AREA_MANAGER':
        return '#B45309';
      default:
        return '#64748B';
    }
  }

  /** Punto de presencia: verde conectado, ámbar reciente, gris desconectado. */
  /**
   * Nombre que se muestra en la tarjeta.
   *
   * Antes salia `identificationUser`, que en la practica es el correo completo
   * (usuario@coacmagisterio.fin.ec): ocupaba dos lineas y no decía quien era.
   * Ahora sale el nombre que llega de Outlook y, si no hay, se arma con el
   * nombre y apellido; y como ultimo recurso la parte del correo antes de la
   * arroba, con la inicial en mayuscula.
   */
  nombreDe(u: User): string {
    const nombre = (u.displayName || '').trim();
    if (nombre) {
      return nombre;
    }
    const completo = [u.firstName, u.lastName]
      .map((p) => (p || '').trim())
      .filter(Boolean)
      .join(' ');
    if (completo) {
      return completo;
    }
    const correo = (u.corporateEmailUser || '').trim();
    const local = correo.includes('@') ? correo.split('@')[0] : correo;
    if (!local) {
      return 'Sin nombre';
    }
    // "juan.perez" -> "Juan.perez"; con guion o punto se parte cada palabra.
    return local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(' ');
  }

  /** Inicial para el avatar, taken del mismo nombre que muestra la tarjeta. */
  inicialDe(u: User): string {
    return this.nombreDe(u).charAt(0).toUpperCase();
  }

  sesionDot(u: User): string {
    return metaSesion(u.sessionState).dot;
  }

  /**
   * Fondo del borde del punto. En oscuro el borde tiene que ser el de la
   * superficie oscura, o el punto se pierde contra el aro del avatar.
   */
  get superficieOscura(): boolean {
    return (
      typeof document !== 'undefined' &&
      document.documentElement.getAttribute('data-theme') === 'dark'
    );
  }

  sesionLabel(u: User): string {
    return metaSesion(u.sessionState).label;
  }

  constructor(
    private adminService: AdminService,
    private toastService: ToastService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    // La búsqueda global llega con el término aplicado (?search=...).
    const searchParam = this.route.snapshot.queryParams?.['search'];
    if (searchParam) this.search = searchParam;
    this.loadUsers();
    this.adminService
      .catalog()
      .subscribe({ next: (c: Catalog) => { this.areas = c.areas; this.sucursales = c.sucursales || []; } });
  }

  loadUsers(): void {
    this.adminService.users(this.role, this.status, this.search).subscribe({
      next: (u) => {
        this.users = u;
        this.pag.reiniciar();
      },
      error: () =>
        this.toastService.error("No se pudieron cargar los usuarios"),
    });
  }

  setStatus(u: User): void {
    const newStatus = u.statusUser === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    this.adminService.setUserStatus(u.idUser, newStatus).subscribe({
      next: () => this.loadUsers(),
      error: (e) =>
        this.toastService.error(
          e?.error?.message || "No se pudo cambiar el estado",
        ),
    });
  }

  /** Editar abre el modal de edición; sin usuario, el asistente de alta. */
  createOrEditUser(user?: User): void {
    if (user) {
      this.abrirEdicion(user);
    } else {
      this.openCreateStepper();
    }
  }

  deleteUser(u: User): void {
    Swal.fire({
      title: "¿Eliminar usuario?",
      text: u.corporateEmailUser,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
    }).then((r) => {
      if (r.isConfirmed) {
        this.adminService.deleteUser(u.idUser).subscribe({
          next: () => this.loadUsers(),
          error: (e) =>
            this.toastService.error(e?.error?.message || "No se pudo eliminar"),
        });
      }
    });
  }

  // ============ Modal de edición ============
  /** Usuario que se está editando (null = modal cerrado). */
  editando: User | null = null;
  guardandoEdicion = false;
  verPassword = false;
  edicion: {
    corporateEmail: string;
    password: string;
    roleName: string;
    areaId: string | null;
    sucursalId: string | null;
  } = { corporateEmail: "", password: "", roleName: "", areaId: null, sucursalId: null };

  /** Opciones de área y sede para los selects con icono (app-master-select). */
  get areaOpciones(): MasterOption[] {
    // Icono y color del maestro (Admin → Áreas), como el estado en el detalle del ticket.
    return this.areas.map((a) => ({
      value: a.id,
      label: a.name,
      icon: a.icon || "fa-solid fa-building",
      color: a.color || undefined,
    }));
  }

  get sedeOpciones(): MasterOption[] {
    return this.sucursales.map((s) => ({
      value: s.id,
      label: s.name,
      detail: s.code,
      icon: s.icon || "fa-solid fa-city",
      color: s.color || undefined,
    }));
  }

  abrirEdicion(u: User): void {
    this.editando = u;
    this.verPassword = false;
    this.edicion = {
      corporateEmail: u.corporateEmailUser,
      password: "",
      roleName: u.role,
      areaId: this.areas.find((a) => a.name === u.area)?.id ?? null,
      sucursalId: u.sucursalId ?? this.sucursales.find((s) => s.name === u.sucursal)?.id ?? null,
    };
  }

  cerrarEdicion(): void {
    if (this.guardandoEdicion) return;
    this.editando = null;
  }

  /** Correo con forma de correo y, si se escribe, contraseña de al menos 8 caracteres. */
  get edicionValida(): boolean {
    const e = this.edicion;
    return (
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.corporateEmail.trim()) &&
      !!e.roleName &&
      !!e.areaId &&
      (!e.password || e.password.length >= 8)
    );
  }

  guardarEdicion(): void {
    if (!this.editando || !this.edicionValida || this.guardandoEdicion) return;
    const e = this.edicion;
    const payload: RegisterRequest = {
      corporateEmail: e.corporateEmail.trim(),
      roleName: e.roleName,
      areaId: e.areaId!,
      sucursalId: e.sucursalId || null,
    };
    if (e.password) {
      payload.password = e.password;
    }
    this.guardandoEdicion = true;
    this.adminService.updateUser(this.editando.idUser, payload).subscribe({
      next: () => {
        this.guardandoEdicion = false;
        this.editando = null;
        this.loadUsers();
        this.toastService.success("Usuario actualizado");
      },
      error: (err) => {
        this.guardandoEdicion = false;
        this.toastService.error(err?.error?.message || "No se pudo guardar");
      },
    });
  }

  // ============ Estado del stepper ============
  stepperOpen = false;
  step = 1;
  loading = false;

newUser: {
      corporateEmail: string;
      roleName: string;
      areaId: string | null;
      /** Sede de la persona; opcional. */
      sucursalId: string | null;
    } = {
      corporateEmail: "",
      roleName: "",
      areaId: null,
      sucursalId: null,
    };

  /** Abre el stepper para crear un nuevo usuario */
  openCreateStepper(): void {
    this.stepperOpen = true;
    this.step = 1;
this.newUser = {
        corporateEmail: "",
        roleName: "",
        areaId: null,
        sucursalId: null,
      };
    }

  /** Cierra el stepper */
  closeStepper(): void {
    this.stepperOpen = false;
    this.step = 1;
  }

  /** Avanza al siguiente paso */
nextStep(): void {
      if (this.step < 4 && this.canGoNext()) {
        this.step++;
      }
    }

  /** Retrocede al paso anterior */
  prevStep(): void {
    if (this.step > 1) {
      this.step--;
    }
  }

  /** Valida si se puede avanzar del paso actual */
  canGoNext(): boolean {
    if (this.step === 1) {
      return !!this.newUser.corporateEmail;
    }
    if (this.step === 2) {
      return !!this.newUser.roleName;
    }
    return true;
  }

  /** Valida si se puede enviar el formulario */
  canSubmit(): boolean {
    return (
      !!this.newUser.corporateEmail &&
      !!this.newUser.roleName &&
      this.newUser.areaId !== null
    );
  }

  /** Envía el formulario al backend */
  submitStepper(): void {
    if (!this.canSubmit()) return;

    this.loading = true;

const payload: RegisterRequest = {
          corporateEmail: this.newUser.corporateEmail,
          roleName: this.newUser.roleName,
          areaId: this.newUser.areaId!,
          sucursalId: this.newUser.sucursalId,
        };

    this.adminService.createUser(payload).subscribe({
      next: () => {
        this.loading = false;
        this.closeStepper();
        this.loadUsers();
        this.toastService.success("Usuario creado correctamente");
      },
      error: (e) => {
        this.loading = false;
        this.toastService.error(
          e?.error?.message || "No se pudo crear el usuario",
        );
      },
    });
  }

  /** URL absoluta de la foto del usuario si está disponible, si no null. */
  photoOf(u: User): string | null {
    const url = u.photoUrl;
    if (!url) {
      return null;
    }
    return /^https?:\/\//i.test(url) ? url : `${environment.apiUrl}${url}`;
  }

  /** Ante error de carga de imagen, limpia la foto para mostrar la inicial. */
  photoOfError(u: User): void {
    u.photoUrl = "";
  }

  trackById(_: number, u: User): string {
    return u.idUser;
  }

  /**
   * Color del borde superior de la tarjeta y del punto de presencia.
   *
   * Ojo: en daisyUI v4 `--su`, `--wa` y `--er` no son colores, son los canales
   * de cada color ("0.55 0.15 150"). Hay que envolverlos en oklch(); si se
   * devuelve `var(--su)` a secas el navegador lo descarta por invalido y el
   * borde se queda con el color por defecto (negro).
   */
  sesionColor(u: User): string {
    const dot = this.sesionDot(u);
    if (dot.includes("success")) return "oklch(var(--su))";
    if (dot.includes("warning")) return "oklch(var(--wa))";
    if (dot.includes("error")) return "oklch(var(--er))";
    if (dot.includes("info")) return "oklch(var(--in))";
    if (dot.includes("primary")) return "oklch(var(--p))";
    if (dot.includes("secondary")) return "oklch(var(--s))";
    if (dot.includes("accent")) return "oklch(var(--a))";
    return "oklch(var(--bc) / 0.4)";
  }

  /**
   * Color del aro que rodea la foto. Con la sesión abierta va en el color del
   * estado; si la cuenta está deshabilitada el aro se apaga a gris, porque una
   * cuenta dada de baja no debería verse "en linea" aunque su sesión siga viva.
   */
  sesionAnillo(u: User): string {
    if (u.statusUser !== 'ACTIVE') return "oklch(var(--bc) / 0.15)";
    return this.sesionColor(u);
  }
}
