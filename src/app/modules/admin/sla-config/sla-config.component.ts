import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import * as moment from 'moment';
import { AdminService } from '../../../core/services/admin.service';
import { Catalog } from '../../../models/user.model';
import { MonthlyEvaluation } from '../../../models/dashboard.model';

@Component({
  selector: 'app-sla-config',
  templateUrl: './sla-config.component.html'
})
export class SlaConfigComponent implements OnInit {
  catalog?: Catalog;
  evaluations: MonthlyEvaluation[] = [];
  loadingEvals = false;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.adminService.catalog().subscribe({
      next: (c) => (this.catalog = c),
      error: () => Swal.fire('Error', 'No se pudo cargar la configuración SLA', 'error')
    });
    this.loadEvaluations();
  }

  loadEvaluations(): void {
    const month = moment().startOf('month').format('YYYY-MM-DD');
    this.adminService.evaluationsByMonth(month).subscribe({
      next: (evs) => (this.evaluations = evs),
      error: () => undefined
    });
  }

  generateEvaluations(): void {
    const month = moment().startOf('month').format('YYYY-MM-DD');
    Swal.fire({
      title: 'Generar evaluaciones mensuales',
      text: `Se generará la evaluación de desempeño para ${moment().format('MMMM YYYY')}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Generar'
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.loadingEvals = true;
      this.adminService.generateEvaluations(month).subscribe({
        next: (evs) => {
          this.evaluations = evs;
          this.loadingEvals = false;
          Swal.fire({ icon: 'success', title: `${evs.length} evaluaciones generadas` });
        },
        error: (e) => {
          this.loadingEvals = false;
          Swal.fire('Error', e?.error?.message || 'No se pudieron generar', 'error');
        }
      });
    });
  }
}