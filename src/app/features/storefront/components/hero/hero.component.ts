import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  EnvironmentInjector,
  inject,
  isDevMode,
  NgZone,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ProductSpecService } from '../../../../core/services/product-spec.service';
import { textDirection } from '../../../../core/utils/text-direction';
import { DesignerStateService } from '../../../designer/services/designer-state.service';
import { HERO_DESIGNS, NAME_MAX_LENGTH } from '../../showcase/showcase-designs';
import { CasePosterComponent } from '../case-poster/case-poster.component';
import { chooseBackdrop, rememberBackdrop } from './hero-backdrop';
import type { HeroGalaxy } from './hero-galaxy';
import type { HeroScene } from './hero-scene';

const CYCLE_MS = 6000;
const IDLE_TIMEOUT_MS = 2500;
const HERO_PHONE_ID = 'apple-iphone-17';
const PHOTO_FADE_MS = 700;

@Component({
  selector: 'app-hero',
  imports: [TranslocoDirective, RouterLink, CasePosterComponent],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'hero relative isolate block bg-bg text-text',
    '[attr.data-theme]': "backdrop() === 'studio' ? null : 'dark'",
    '[style.--hero-tint-a]': 'design().tint[0]',
    '[style.--hero-tint-b]': 'design().tint[1]',
    '[class.motion-forced]': 'motionForced',
  },
})
export class HeroComponent {
  protected readonly language = inject(LanguageService);
  private readonly products = inject(ProductSpecService);
  private readonly state = inject(DesignerStateService);
  private readonly router = inject(Router);
  private readonly environment = inject(EnvironmentInjector);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly window = inject(DOCUMENT).defaultView;

  protected readonly designs = HERO_DESIGNS;
  protected readonly nameMax = NAME_MAX_LENGTH;
  protected readonly name = signal('');
  protected readonly spec = computed(() => this.products.byId().get(HERO_PHONE_ID));
  protected readonly nameDir = computed(() => {
    const name = this.name().trim();
    return name ? textDirection(name) : null;
  });
  protected readonly index = signal(0);
  protected readonly design = computed(() => this.designs[this.index()]);

  protected readonly motionForced =
    isDevMode() && new URLSearchParams(this.window?.location.search).get('motion') === 'on';
  protected readonly reducedMotion =
    !this.motionForced &&
    (this.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  protected readonly playing = signal(!this.reducedMotion);
  private readonly formFocused = signal(false);
  private readonly visible = signal(false);

  private readonly scene3d = signal<HeroScene | null>(null);
  protected readonly sceneReady = computed(() => this.scene3d()?.ready() ?? false);
  protected readonly backdrop = signal(chooseBackdrop(this.window));
  protected readonly photoLoaded = signal(false);
  private readonly galaxy = signal<HeroGalaxy | null>(null);
  protected readonly galaxyReady = computed(() => this.galaxy()?.ready() ?? false);
  protected readonly showDragHint = signal(true);

  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly sceneHost = viewChild.required<ElementRef<HTMLElement>>('sceneHost');
  private readonly galaxyHost = viewChild.required<ElementRef<HTMLElement>>('galaxyHost');
  private loadRequested = false;
  private galaxyRequested = false;

  constructor() {
    afterNextRender(() => {
      const observer = new IntersectionObserver(
        ([entry]) => this.visible.set(entry.isIntersecting),
        { threshold: 0.15 },
      );
      observer.observe(this.stage().nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    effect(() => {
      if (!this.visible() || this.loadRequested || saveData(this.window)) return;
      this.loadRequested = true;
      untracked(() => this.whenIdle(() => void this.load3d()));
    });

    effect((onCleanup) => {
      if (!this.playing() || !this.visible() || this.formFocused()) return;
      if (this.scene3d()?.grabbed()) return;
      this.index();
      const timer = setTimeout(() => this.step(1), CYCLE_MS);
      onCleanup(() => clearTimeout(timer));
    });

    effect(() => {
      const scene = this.scene3d();
      const spec = this.spec();
      if (scene && spec) untracked(() => scene.setSpec(spec));
    });
    effect(() => {
      const scene = this.scene3d();
      const design = this.design();
      if (scene) untracked(() => scene.setDesign(design, true));
    });
    effect(() => {
      const scene = this.scene3d();
      const name = this.name().trim();
      if (scene) untracked(() => scene.setName(name));
    });
    effect(() => {
      const scene = this.scene3d();
      const visible = this.visible();
      if (scene) untracked(() => scene.setActive(visible));
    });

    effect(() => {
      if (this.backdrop() !== 'galaxy' || !this.visible() || this.galaxyRequested) return;
      this.galaxyRequested = true;
      void this.loadGalaxy();
    });
    effect(() => {
      const galaxy = this.galaxy();
      const visible = this.visible();
      if (galaxy) untracked(() => galaxy.setActive(visible));
    });
    effect(() => {
      const fast = this.galaxy()?.fast();
      if (fast === true) rememberBackdrop(this.window, 'galaxy');
      if (fast === false) this.fallBackToPhoto();
    });
    effect((onCleanup) => {
      const galaxy = this.galaxy();
      if (!galaxy || !this.photoLoaded()) return;
      const timer = setTimeout(() => {
        galaxy.destroy();
        this.galaxy.set(null);
      }, PHOTO_FADE_MS);
      onCleanup(() => clearTimeout(timer));
    });

    this.destroyRef.onDestroy(() => {
      this.scene3d()?.destroy();
      this.galaxy()?.destroy();
    });
  }

  protected onNameInput(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value.slice(0, NAME_MAX_LENGTH));
  }

  protected onFormFocus(focused: boolean): void {
    this.formFocused.set(focused);
  }

  protected pick(index: number): void {
    this.index.set(index);
  }

  protected step(delta: number): void {
    const count = this.designs.length;
    this.index.update((i) => (i + delta + count) % count);
  }

  protected togglePlaying(): void {
    this.playing.update((playing) => !playing);
  }

  protected onStagePointerDown(): void {
    if (this.sceneReady()) this.showDragHint.set(false);
  }

  protected onDesign(event: Event): void {
    event.preventDefault();
    const text = this.name().trim();
    this.state.pendingLayers.set(text ? { text } : null);
    void this.router.navigate(['/', this.language.lang(), 'design']);
  }

  private async load3d(): Promise<void> {
    const { HeroScene } = await import('./hero-scene');
    if (this.destroyRef.destroyed) return;
    const scene = HeroScene.create(this.sceneHost().nativeElement, this.environment, {
      reducedMotion: this.reducedMotion,
    });
    if (scene) this.scene3d.set(scene);
  }

  private async loadGalaxy(): Promise<void> {
    const { HeroGalaxy } = await import('./hero-galaxy');
    if (this.destroyRef.destroyed) return;
    const galaxy = HeroGalaxy.create(this.galaxyHost().nativeElement, this.ngZone, {
      reducedMotion: this.reducedMotion,
    });
    if (galaxy) this.galaxy.set(galaxy);
    else this.fallBackToPhoto();
  }

  private fallBackToPhoto(): void {
    rememberBackdrop(this.window, 'photo');
    this.backdrop.set('photo');
  }

  private whenIdle(run: () => void): void {
    const w = this.window;
    if (w?.requestIdleCallback) w.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    else setTimeout(run, 600);
  }
}

function saveData(window: Window | null): boolean {
  const nav = window?.navigator as
    (Navigator & { connection?: { saveData?: boolean } }) | undefined;
  return nav?.connection?.saveData === true;
}
