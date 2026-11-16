import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ASSETS_ROUTES } from './assets.routes';
import { AssetListComponent } from './asset-list/asset-list.component';
import { AssetFormComponent } from './asset-form/asset-form.component';
import { AssetDetailComponent } from './asset-detail/asset-detail.component';
import { ActaModalComponent } from './acta-modal/acta-modal.component';
import { EscanerComponent } from './escaner/escaner.component';
import { MisEquiposComponent } from './mis-equipos/mis-equipos.component';
import { ActasComponent } from './actas/actas.component';
import { ConfiguracionActivosComponent } from './configuracion/configuracion-activos.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [
    AssetListComponent, AssetFormComponent, AssetDetailComponent,
    // Fase 4: actas, escáner, mis equipos y configuración.
    ActaModalComponent, EscanerComponent, MisEquiposComponent, ActasComponent, ConfiguracionActivosComponent,
  ],
  imports: [SharedModule, RouterModule.forChild(ASSETS_ROUTES)],
  exports: [AssetListComponent, AssetFormComponent, AssetDetailComponent]
})
export class AssetsModule {}
