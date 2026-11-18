import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService } from '../../../core/i18n/language.service';
import { computePrintZone } from '../../../core/utils/print-zone';
import { DesignerStateService } from '../../designer/services/designer-state.service';
import { renderShowcaseFile, ShowcaseDesign } from '../showcase/showcase-designs';

@Injectable({ providedIn: 'root' })
export class CustomizeService {
  private readonly state = inject(DesignerStateService);
  private readonly language = inject(LanguageService);
  private readonly router = inject(Router);

  async customize(design: ShowcaseDesign): Promise<void> {
    const spec = this.state.spec();
    if (!spec) return;
    const image = await renderShowcaseFile(design, computePrintZone(spec, this.state.wrapSides()));
    this.state.setCaseColor(design.caseColor);
    this.state.pendingLayers.set({ image });
    await this.router.navigate(['/', this.language.lang(), 'design']);
  }
}
