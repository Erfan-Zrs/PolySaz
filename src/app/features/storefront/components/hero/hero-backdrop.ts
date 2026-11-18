export type HeroBackdrop = 'studio' | 'galaxy' | 'photo';

const HERO_LOOK: 'studio' | 'space' = 'studio';

export const BACKDROP_STORAGE_KEY = 'polysaz.heroBackdrop';

export function chooseBackdrop(window: Window | null): HeroBackdrop {
  if (HERO_LOOK === 'studio') return 'studio';
  if (!window) return 'photo';
  const nav = window.navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (nav.connection?.saveData) return 'photo';

  const saved = readSaved(window);
  if (saved) return saved;

  const capable =
    (nav.hardwareConcurrency ?? 8) >= 4 &&
    (nav.deviceMemory ?? 8) >= 4 &&
    hardwareWebgl(window.document);
  const backdrop = capable ? 'galaxy' : 'photo';
  if (!capable) rememberBackdrop(window, backdrop);
  return backdrop;
}

export function rememberBackdrop(window: Window | null, backdrop: HeroBackdrop): void {
  try {
    window?.localStorage.setItem(BACKDROP_STORAGE_KEY, backdrop);
  } catch {
  }
}

function readSaved(window: Window): HeroBackdrop | null {
  try {
    const saved = window.localStorage.getItem(BACKDROP_STORAGE_KEY);
    return saved === 'galaxy' || saved === 'photo' ? saved : null;
  } catch {
    return null;
  }
}

function hardwareWebgl(document: Document): boolean {
  const gl = document.createElement('canvas').getContext('webgl');
  if (!gl) return false;
  let name = String(gl.getParameter(gl.RENDERER));
  if (/webkit webgl/i.test(name)) {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (info) name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  }
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}
