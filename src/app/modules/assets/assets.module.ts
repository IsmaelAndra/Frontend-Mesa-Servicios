import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ASSETS_ROUTES } from './assets.routes';
import { AssetListComponent } from './asset-list/asset-list.component';
import { AssetFormComponent } from './asset-form/asset-form.component';
import { AssetDetailComponent } from './asset-detail/asset-detail.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [AssetListComponent, AssetFormComponent, AssetDetailComponent],
  imports: [SharedModule, RouterModule.forChild(ASSETS_ROUTES)],
  exports: [AssetListComponent, AssetFormComponent, AssetDetailComponent]
})
export class AssetsModule {}