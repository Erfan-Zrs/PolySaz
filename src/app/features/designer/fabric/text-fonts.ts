import { cache } from 'fabric';

export { textDirection } from '../../../core/utils/text-direction';

export type TextFontId = 'vazirmatn' | 'naskh' | 'lalezar';

export interface TextFont {
  readonly id: TextFontId;
  readonly family: string;
}

export const TEXT_FONTS: readonly TextFont[] = [
  { id: 'vazirmatn', family: 'Vazirmatn' },
  { id: 'naskh', family: 'Noto Naskh Arabic' },
  { id: 'lalezar', family: 'Lalezar' },
];

export const DEFAULT_TEXT_FONT = TEXT_FONTS[0];
export const TEXT_WEIGHT_NORMAL = 400;
export const TEXT_WEIGHT_BOLD = 700;

export function textFontByFamily(family: string): TextFont {
  return TEXT_FONTS.find((f) => f.family === family) ?? DEFAULT_TEXT_FONT;
}

export function textFontById(id: TextFontId): TextFont {
  return TEXT_FONTS.find((f) => f.id === id) ?? DEFAULT_TEXT_FONT;
}

export async function ensureTextFont(
  family: string,
  weight: number | string,
  style: string,
  text: string,
): Promise<boolean> {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return false;
  const font = `${style} ${weight} 16px "${family}"`;
  const sample = text || ' ';
  if (fonts.check(font, sample)) return false;
  try {
    await fonts.load(font, sample);
  } catch {
    return false;
  }
  cache.clearFontCache(family);
  return true;
}
