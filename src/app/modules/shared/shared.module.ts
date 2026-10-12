import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { StatusBadgeComponent } from './components/status-badge/status-badge.component';
import { MasterSelectComponent } from './components/master-select/master-select.component';
import { BreadcrumbComponent } from './components/breadcrumb/breadcrumb.component';
import { ToastContainerComponent } from './components/toast-container/toast-container.component';
import { AiFloatButtonComponent } from './components/ai-float-button/ai-float-button.component';
import { PaginatorComponent } from './components/paginator/paginator.component';
import { PresenceDotComponent } from './components/presence-dot/presence-dot.component';
import { GlobalSearchComponent } from './components/global-search/global-search.component';
import { PrimeNGModule } from './primeng.module';

import { SkeletonComponent } from './components/skeleton/skeleton.component';

@NgModule({
  declarations: [NavbarComponent, SidebarComponent, StatusBadgeComponent, MasterSelectComponent, BreadcrumbComponent, ToastContainerComponent, AiFloatButtonComponent, PaginatorComponent, PresenceDotComponent, GlobalSearchComponent],
  imports: [CommonModule, RouterModule, PrimeNGModule, SkeletonComponent],
  exports: [NavbarComponent, SidebarComponent, StatusBadgeComponent, MasterSelectComponent, BreadcrumbComponent, ToastContainerComponent, AiFloatButtonComponent, PaginatorComponent, PresenceDotComponent, GlobalSearchComponent, SkeletonComponent, CommonModule, RouterModule, PrimeNGModule]
})
export class SharedModule {}

