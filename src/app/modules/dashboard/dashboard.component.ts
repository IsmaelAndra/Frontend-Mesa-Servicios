import { Component, OnInit } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import Swal from 'sweetalert2';
import { DashboardService, EvaluationService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardStats, MonthlyEvaluation } from '../../models/dashboard.model';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  stats!: DashboardStats;
  loading = true;

  from = '';
  to = '';
  isAgent = false;
  evaluations: MonthlyEvaluation[] = [];
  loadingEvaluation = false;

  statusPie: ChartData = { labels: [], datasets: [] };
  areaBar: ChartData = { labels: [], datasets: [] };
  categoryBar: ChartData = { labels: [], datasets: [] };
  trendLine: ChartData = { labels: [], datasets: [] };

  pieOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 12,
          boxWidth: 12,
          boxHeight: 12,
          font: { size: 11 },
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 10,
        cornerRadius: 6
      }
    }
  };

  barOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 10,
        cornerRadius: 6
      }
    },
    scales: {
      x: {
        ticks: {
          font: { size: 10 },
          maxRotation: 45,
          minRotation: 0,
          autoSkip: true,
          autoSkipPadding: 10
        },
        grid: { display: false }
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0, font: { size: 10 } },
        grid: { color: 'rgba(0,0,0,0.05)' }
      }
    }
  };

  lineOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 10,
        cornerRadius: 6
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 } }
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0, font: { size: 10 } },
        grid: { color: 'rgba(0,0,0,0.05)' }
      }
    },
    elements: {
      point: {
        radius: 3,
        hoverRadius: 6
      }
    }
  };

  constructor(
    private dashboardService: DashboardService,
    private evaluationService: EvaluationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.isAgent = this.authService.getRole() === 'AGENT';
    this.load();
    if (this.isAgent) {
      this.loadEvaluation();
    }
  }

  applyFilters(): void {
    this.load();
  }

  clearFilters(): void {
    this.from = '';
    this.to = '';
    this.load();
  }

  load(): void {
    this.loading = true;
    this.dashboardService.stats(undefined, undefined, undefined, this.from || undefined, this.to || undefined).subscribe({
      next: (s) => {
        this.stats = s;
        this.buildCharts(s);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        Swal.fire('Error', err?.error?.message || 'No se pudieron cargar las estadísticas', 'error');
      }
    });
  }

  private loadEvaluation(): void {
    this.loadingEvaluation = true;
    this.evaluationService.mine().subscribe({
      next: (e) => {
        this.evaluations = e;
        this.loadingEvaluation = false;
      },
      error: () => {
        this.loadingEvaluation = false;
      }
    });
  }

  get latestEvaluation(): MonthlyEvaluation | null {
    return this.evaluations.length ? this.evaluations[0] : null;
  }

  private buildCharts(s: DashboardStats): void {
    this.statusPie = {
      labels: Object.keys(s.ticketsByStatus),
      datasets: [{
        data: Object.values(s.ticketsByStatus),
        backgroundColor: ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#6B7280', '#EF4444', '#EC4899'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };

    this.areaBar = {
      labels: Object.keys(s.ticketsByArea),
      datasets: [{
        data: Object.values(s.ticketsByArea),
        backgroundColor: '#3B82F6',
        borderRadius: 6,
        maxBarThickness: 40
      }]
    };

    this.categoryBar = {
      labels: Object.keys(s.ticketsByCategory),
      datasets: [{
        data: Object.values(s.ticketsByCategory),
        backgroundColor: '#10B981',
        borderRadius: 6,
        maxBarThickness: 40
      }]
    };

    this.trendLine = {
      labels: s.ticketsLast12Weeks.map((_, i) => `S-${i + 1}`),
      datasets: [{
        label: 'Tickets creados',
        data: s.ticketsLast12Weeks,
        borderColor: '#1e3a8a',
        backgroundColor: 'rgba(59,130,246,0.2)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#1e3a8a',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2
      }]
    };
  }
}