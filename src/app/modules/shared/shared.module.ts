import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { StatusBadgeComponent } from './components/status-badge/status-badge.component';
import { BreadcrumbComponent } from './components/breadcrumb/breadcrumb.component';
import { PrimeNGModule } from './primeng.module';

@NgModule({
  declarations: [NavbarComponent, SidebarComponent, StatusBadgeComponent, BreadcrumbComponent],
  imports: [CommonModule, RouterModule, PrimeNGModule],
  exports: [NavbarComponent, SidebarComponent, StatusBadgeComponent, BreadcrumbComponent, CommonModule, RouterModule, PrimeNGModule]
})
export class SharedModule {}