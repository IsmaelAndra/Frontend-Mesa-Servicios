import { Component } from "@angular/core";

/**
 * Página de Reportes. Desde la V34 todos los reportes, también los del
 * sistema, se arman con el modal de "Mis reportes"; ya no hay reportes
 * escritos en SQL, así que esta página solo enmarca esa tarjeta.
 */
@Component({
  selector: "app-reports",
  templateUrl: "./reports.component.html",
})
export class ReportsComponent {}
