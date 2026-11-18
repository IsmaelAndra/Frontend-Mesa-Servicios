import { pedirCodigoMfa } from '../../../core/utils/codigo-mfa.util';
import { confirmar } from '../../../core/utils/confirmar.util';
import { Component, OnDestroy, OnInit } from "@angular/core";
import Swal from "sweetalert2";
import { ActivatedRoute } from "@angular/router";
import { AdminService } from "../../../core/services/admin.service";
import { Catalog, RegisterRequest, User } from "../../../models/user.model";
import { ToastService } from "../../../core/services/toast.service";
import { metaSesion } from "../../../core/utils/session-presence.util";
import { Paginacion } from "../../../core/utils/pagination.util";
import { MasterOption } from "../../shared/components/master-select/master-select.component";
import { urlDelApi } from '../../../core/utils/url-api.util';
import { AuthService } from "../../../core/services/auth.service";

@Component({
  selector: "app-user-management",
  templateUrl: "./user-management.component.html",
})
export class UserManagementComponent implements OnInit, OnDestroy {
  /**
   * El estado de sesión (en línea / reciente / desconectado) se calculaba solo
   * al cargar la página. Cada 30 s se vuelve a pedir, sin parpadeo: solo se
   * actualiza sessionState de las tarjetas que ya están.
   */
  private presenciaTimer?: ReturnType<typeof setInterval>;
  users: User[] = [];
  areas: { id: string; name: string; icon?: string; color?: string }[] = [];
  /** Sucursales activas, del mismo catálogo público que usa el resto de selectores. */
  sucursales: { id: string; code: string; name: string; icon?: string; color?: string }[] = [];
  /**
   * Roles que se pueden asignar desde aquí. Un jefe de Tecnología o Desarrollo
   * crea jefes, agentes y usuarios; el súper admin además auditores (súper
   * admin no se asigna desde esta pantalla). El backend aplica la misma regla.
   */
  roles: string[] = ["AREA_MANAGER", "AGENT", "USER"];
  /** El auditor ve la pantalla sin poder crear, editar ni desactivar. */
  soloLectura = false;
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
    AUDITOR: "Auditor",
    AGENT: "Agente",
    USER: "Usuario",
    AREA_MANAGER: "Jefe de área",
  };

  roleDescriptions: Record<string, string> = {
    SUPER_ADMIN: "Acceso total: administración y configuración avanzada",
    AUDITOR: "Consulta tickets, auditoría, activos y reportes, sin modificar nada",
    AGENT: "Atiende los tickets de su área; no reasigna",
    USER: "Crea y da seguimiento a sus propios tickets",
    AREA_MANAGER: "Gestiona los tickets, el equipo y la configuración de su área",
  };

  /** Roles con su icono y color, para el filtro. */
  get opcionesRol(): MasterOption[] {
    if (!this.rolesOpciones.length) {
      this.rolesOpciones = this.roles.map((r) => ({
        value: r, label: this.getRoleLabel(r), icon: this.rolIcon(r), color: this.rolColor(r),
      }));
    }
    return this.rolesOpciones;
  }
  private rolesOpciones: MasterOption[] = [];

  getRoleLabel(role: string): string {
    return this.roleLabels[role] || role;
  }

  /** Icono del badge de rol. */
  rolIcon(role: string): string {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'fa-solid fa-crown';
      case 'AUDITOR':
        return 'fa-solid fa-magnifying-glass-chart';
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
      case 'AUDITOR':
        return '#0F766E';
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
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const rolActual = this.authService.getRole();
    this.soloLectura = rolActual === "AUDITOR";
    if (rolActual === "SUPER_ADMIN") {
      this.roles = ["AREA_MANAGER", "AGENT", "USER", "AUDITOR"];
    }
    this.presenciaTimer = setInterval(() => this.refrescarPresencia(), 30_000);
    // La búsqueda global llega con el término aplicado (?search=...).
    const searchParam = this.route.snapshot.queryParams?.['search'];
    if (searchParam) this.search = searchParam;
    this.loadUsers();
    this.adminService
      .catalog()
      .subscribe({ next: (c: Catalog) => { this.areas = (c.areas || []).filter((a) => a.status !== false); this.sucursales = c.sucursales || []; } });
  }

  ngOnDestroy(): void {
    if (this.presenciaTimer) clearInterval(this.presenciaTimer);
  }

  private refrescarPresencia(): void {
    if (document.hidden) return;
    this.adminService.users(this.role, this.status, this.search).subscribe({
      next: (lista) => {
        const porId = new Map(lista.map((x) => [x.idUser, x.sessionState]));
        this.users.forEach((u) => {
          if (porId.has(u.idUser)) u.sessionState = porId.get(u.idUser);
        });
        this.marcarmeEnLinea();
      },
      error: () => undefined,
    });
  }

  /**
   * Quien mira esta pantalla está, por definición, en línea. El backend lo sabe
   * por la conexión SSE, que puede tardar en abrirse (o caer un momento), y la
   * propia cuenta salía como desconectada.
   */
  private marcarmeEnLinea(): void {
    const yo = this.authService.currentUserSnapshot()?.idUser;
    const mia = yo ? this.users.find((x) => x.idUser === yo) : undefined;
    if (mia) mia.sessionState = 'EN_LINEA';
  }

  loadUsers(): void {
    this.adminService.users(this.role, this.status, this.search).subscribe({
      next: (u) => {
        this.users = u;
        this.marcarmeEnLinea();
        this.pag.reiniciar();
      },
      error: () =>
        this.toastService.error("No se pudieron cargar los usuarios"),
    });
  }

  async setStatus(u: User): Promise<void> {
    if (this.esYo(u)) return;
    const newStatus = u.statusUser === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const desactivar = newStatus === "INACTIVE";
    const ok = await confirmar({
      titulo: desactivar ? "¿Desactivar la cuenta?" : "¿Activar la cuenta?",
      texto: desactivar
        ? `${u.corporateEmailUser} no podrá ingresar y se cerrarán sus sesiones abiertas.`
        : `${u.corporateEmailUser} podrá volver a ingresar.`,
      accion: desactivar ? "Desactivar" : "Activar",
      peligro: desactivar,
    });
    if (!ok) return;
    this.adminService.setUserStatus(u.idUser, newStatus).subscribe({
      next: () => {
        this.toastService.success(desactivar ? "Cuenta desactivada" : "Cuenta activada");
        this.loadUsers();
      },
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
    Swal.fire({ reverseButtons: true, cancelButtonColor: '#6b7280', cancelButtonText: 'Cancelar', confirmButtonText: 'Sí, eliminar', focusCancel: true,
      title: "¿Eliminar usuario?",
      text: u.corporateEmailUser,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
    }).then((r) => {
      if (r.isConfirmed) {
        this.adminService.deleteUser(u.idUser).subscribe({
          next: () => {
            this.toastService.success("Usuario eliminado");
            this.loadUsers();
          },
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
    extension: string;
    /** Cargo; sale en las actas de activos. */
    cargo: string;
    /** Cédula: obligatoria también al editar (como en el alta). */
    identification: string;
  } = { corporateEmail: "", password: "", roleName: "", areaId: null, sucursalId: null, extension: "", cargo: "", identification: "" };

  /** Opciones de área y sucursal para los selects con icono (app-master-select). */
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
      extension: u.extensionUser ?? "",
      cargo: u.cargoUser ?? "",
      identification: /^[0-9]{10}$/.test(u.identificationUser ?? "") ? u.identificationUser! : "",
    };
  }

  /** Por qué no se puede guardar la edición (null = se puede). Lo mismo que exige el alta. */
  get motivoEdicion(): string | null {
    const e = this.edicion;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.corporateEmail.trim())) return "Escriba un correo válido";
    if (!/^[0-9]{10}$/.test(e.identification.trim())) return "La cédula debe tener 10 números";
    if (!e.cargo.trim()) return "Escriba el cargo";
    if (!/^[0-9]{1,10}$/.test(e.extension.trim())) return "La extensión es obligatoria y solo lleva números";
    if (!e.roleName) return "Elija el rol";
    if (!e.areaId) return "Elija el área";
    if (e.password && e.password.length < 8) return "La contraseña debe tener al menos 8 caracteres";
    return null;
  }

  cedulaEdicionInvalida(): boolean {
    const c = this.edicion.identification.trim();
    return !!c && !/^[0-9]{10}$/.test(c);
  }

  /** Quien mira la pantalla: no puede desactivarse ni eliminarse a sí mismo. */
  esYo(u: User): boolean {
    return u.idUser === this.authService.currentUserSnapshot()?.idUser;
  }

  /** La extensión solo admite números (hasta 10). Vacía = sin extensión. */
  extensionInvalida(): boolean {
    return !/^[0-9]{0,10}$/.test(this.edicion.extension.trim());
  }

  cerrarEdicion(): void {
    if (this.guardandoEdicion) return;
    this.editando = null;
  }

  /** Correo con forma de correo y, si se escribe, contraseña de al menos 8 caracteres. */
  get edicionValida(): boolean {
    return this.motivoEdicion === null;
  }

  guardarEdicion(): void {
    if (!this.editando || !this.edicionValida || this.guardandoEdicion) return;
    const e = this.edicion;
    const payload: RegisterRequest = {
      corporateEmail: e.corporateEmail.trim(),
      roleName: e.roleName,
      areaId: e.areaId!,
      sucursalId: e.sucursalId || null,
      // "" quita la extensión; el backend solo acepta números.
      extension: e.extension.trim(),
      cargo: e.cargo.trim(),
      identification: e.identification.trim(),
    };
    if (e.password) {
      payload.password = e.password;
    }
    this.guardandoEdicion = true;
    const idUsuario = this.editando.idUser;
    // Con MFA activo, editar a otra persona pide el código del autenticador.
    this.authService.pideCodigoMfa().subscribe((pide) => {
      if (!pide) {
        this.enviarEdicion(idUsuario, payload, null);
        return;
      }
      pedirCodigoMfa({
        texto: "Escriba el código de 6 dígitos de su aplicación autenticadora para guardar los cambios.",
        accion: "Guardar",
      }).then((codigo) => {
        if (!codigo) {
          this.guardandoEdicion = false;
          return;
        }
        this.enviarEdicion(idUsuario, payload, codigo);
      });
    });
  }

  private enviarEdicion(idUsuario: string, payload: RegisterRequest, codigoMfa: string | null): void {
    this.adminService.updateUser(idUsuario, payload, codigoMfa).subscribe({
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
      /** Sucursal de la persona; opcional. */
      sucursalId: string | null;
      /** Extensión telefónica; opcional. */
      extension: string;
      /** Cargo; sale en las actas de activos. */
      cargo: string;
      /** Cédula (o pasaporte). */
      identificacion: string;
    } = {
      corporateEmail: "",
      extension: "",
      cargo: "",
      identificacion: "",
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
        extension: "",
        cargo: "",
          identificacion: "",
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
      // Todo lo que imprime un acta de activos se pide en el alta (V: nov 2026).
      return this.faltanDatosDelAlta().length === 0;
    }
    if (this.step === 2) {
      return !!this.newUser.roleName;
    }
    return true;
  }

  /** La extensión del alta: solo números (hasta 10), como en el backend. */
  extensionNuevaInvalida(): boolean {
    return !/^[0-9]{0,10}$/.test((this.newUser.extension || "").trim());
  }

  /** Cédula: 10 números. */
  cedulaInvalida(): boolean {
    const c = (this.newUser.identificacion || "").trim();
    return !!c && !/^[0-9]{10}$/.test(c);
  }

  /** Campos obligatorios del alta que siguen vacíos o mal escritos. */
  faltanDatosDelAlta(): string[] {
    const u = this.newUser;
    const f: string[] = [];
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((u.corporateEmail || "").trim())) f.push("correo");
    if (!(u.identificacion || "").trim() || this.cedulaInvalida()) f.push("cédula");
    if (!(u.cargo || "").trim()) f.push("cargo");
    if (!(u.extension || "").trim() || this.extensionNuevaInvalida()) f.push("extensión");
    return f;
  }

  /** Valida si se puede enviar el formulario */
  canSubmit(): boolean {
    return (
      this.faltanDatosDelAlta().length === 0 &&
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
          extension: (this.newUser.extension || "").trim(),
          cargo: (this.newUser.cargo || "").trim() || undefined,
          identification: (this.newUser.identificacion || "").trim(),
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
    return urlDelApi(url);
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
