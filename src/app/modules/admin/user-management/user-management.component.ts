import { Component, OnInit } from "@angular/core";
import Swal from "sweetalert2";
import { ActivatedRoute } from "@angular/router";
import { AdminService } from "../../../core/services/admin.service";
import { Catalog, RegisterRequest, User } from "../../../models/user.model";
import { ToastService } from "../../../core/services/toast.service";
import { environment } from "../../../../environments/environment";
import { metaSesion } from "../../../core/utils/session-presence.util";
import { Paginacion } from "../../../core/utils/pagination.util";

@Component({
  selector: "app-user-management",
  templateUrl: "./user-management.component.html",
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  areas: { id: string; name: string }[] = [];
  /** Sedes activas, del mismo catálogo público que usa el resto de selectores. */
  sucursales: { id: string; code: string; name: string }[] = [];
  roles = ["ADMIN", "AGENT", "USER"];
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
  };

  roleDescriptions: Record<string, string> = {
    SUPER_ADMIN: "Acceso total: administración y configuración avanzada",
    ADMIN: "Gestiona usuarios, áreas, configuraciones y reportes",
    AGENT: "Atiende y resuelve los tickets asignados",
    USER: "Crea y da seguimiento a sus propios tickets",
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

  async createOrEditUser(user?: User): Promise<void> {
    const { value: form } = await Swal.fire({
      title: user ? "Editar usuario" : "Nuevo usuario",
      html: this.userFormHtml(user),
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const g = (i: string): string => {
          const el = Swal.getPopup()?.querySelector(
            `#${i}`,
          ) as HTMLInputElement | null;
          return el ? el.value.trim() : "";
        };
        return { corporateEmail: g("email"), password: g("pass") };
      },
    });

    if (!form) return;

const areaSel = await this.pickArea(user?.area);
      if (areaSel === undefined) return;
      const sucursalSel = await this.pickSucursal(user?.sucursal);

    const roleSel = await this.pickRole(user?.role);
    if (roleSel === undefined) return;

const payload: RegisterRequest = {
          corporateEmail: form.corporateEmail,
          roleName: roleSel,
          areaId: areaSel,
          sucursalId: sucursalSel || null,
        };
    if (form.password) {
      payload.password = form.password;
    }

    const obs = user
      ? this.adminService.updateUser(user.idUser, payload)
      : this.adminService.createUser(payload);

    obs.subscribe({
      next: () => {
        this.loadUsers();
        this.toastService.success("Guardado");
      },
      error: (e) =>
        this.toastService.error(e?.error?.message || "No se pudo guardar"),
    });
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

  private userFormHtml(user?: User): string {
    if (!user) {
      return `
        <div class="text-left space-y-2 text-sm">
          <label>Correo corporativo *</label>
          <input id="email" class="input input-bordered input-sm w-full" />
          <p class="opacity-70 text-xs">La foto, nombres y correo se obtienen automáticamente de Microsoft Graph.</p>
        </div>`;
    }
    return `
      <div class="text-left space-y-2 text-sm">
        <label>Correo corporativo *</label>
        <input id="email" class="input input-bordered input-sm w-full" value="${user.corporateEmailUser}" />
        <label>Contraseña (dejar vacío para no cambiar)</label>
        <input id="pass" type="password" class="input input-bordered input-sm w-full" />
      </div>`;
  }

pickArea(current?: string): Promise<string | undefined> {
      const currentId = this.areas.find((a) => a.name === current)?.id;
      return this.pickIdSelect(
        "Área",
        this.areas.map((a) => ({ value: a.id, label: a.name })),
        currentId,
      );
    }

    /**
     * Sede de la persona. A diferencia del área, es opcional: se puede dejar
     * sin asignar para no bloquear el alta de alguien antes de que el catálogo
     * de sedes esté cargado.
     */
    pickSucursal(current?: string): Promise<string | undefined> {
      const currentId = this.sucursales.find((s) => s.name === current)?.id;
      return this.pickIdSelect(
        "Sede",
        this.sucursales.map((s) => ({ value: s.id, label: `${s.code} - ${s.name}` })),
        currentId,
        true,
      );
    }

  pickRole(current?: string): Promise<string | undefined> {
    const opts = this.roles
      .map(
        (r) => `
        <label style="display:flex;align-items:flex-start;gap:8px;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:6px;cursor:pointer;${r === current ? "background:#eef2ff;border-color:#6366f1;" : ""}">
          <input type="radio" name="roleopt" value="${r}" ${r === current ? "checked" : ""} style="margin-top:3px;" />
          <span style="display:block;">
            <span style="display:block;font-weight:600;font-size:14px;">${this.getRoleLabel(r)}</span>
            <span style="display:block;font-size:12px;opacity:0.7;">${this.roleDescriptions[r] || ""}</span>
          </span>
        </label>`,
      )
      .join("");

    return new Promise((resolve) => {
      Swal.fire({
        title: "Seleccione el rol",
        html: `<div>${opts}</div>`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "Aceptar",
        cancelButtonText: "Cancelar",
        preConfirm: () => {
          const sel = Swal.getPopup()!.querySelector(
            'input[name="roleopt"]:checked',
          ) as HTMLInputElement;
          return sel ? sel.value : "";
        },
      }).then((r) => resolve(r.isConfirmed && r.value ? r.value : undefined));
    });
  }

private async pickIdSelect(
      label: string,
      options: { value: string; label: string }[],
      currentId?: string,
      /** Añade una opción vacía para poder dejar el campo sin asignar. */
      opcional = false,
    ): Promise<string | undefined> {
      const lista = opcional ? [{ value: "", label: `Sin ${label.toLowerCase()}` }, ...options] : options;
      const seleccion = lista.find((o) => o.value === currentId)?.value ?? (opcional ? "" : undefined);
      const opts = lista
        .map(
          (o) =>
            `<option value="${o.value}" ${o.value === seleccion ? "selected" : ""}>${o.label}</option>`,
        )
        .join("");
    const { value } = await Swal.fire({
      title: `Seleccione ${label}`,
      html: `<select id="swal-select" class="select select-bordered select-sm w-full">${opts}</select>`,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const sel = Swal.getPopup()!.querySelector(
          "#swal-select",
        ) as HTMLSelectElement;
        return sel.value === "" ? (opcional ? "" : undefined) : sel.value;
      },
    });
    return value;
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
