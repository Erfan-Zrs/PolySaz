import { textDirection, textFontByFamily, textFontById, TEXT_FONTS } from './text-fonts';

describe('text fonts', () => {
  it('detects the base direction from the first strong character', () => {
    expect(textDirection('سلام')).toBe('rtl');
    expect(textDirection('Hello')).toBe('ltr');
    expect(textDirection('2024 عشق')).toBe('rtl');
    expect(textDirection('«Love» عشق')).toBe('ltr');
    expect(textDirection('123')).toBe('ltr');
  });

  it('maps ids and families both ways, falling back to the default font', () => {
    for (const font of TEXT_FONTS) {
      expect(textFontById(font.id)).toBe(font);
      expect(textFontByFamily(font.family)).toBe(font);
    }
    expect(textFontByFamily('Comic Sans MS')).toBe(TEXT_FONTS[0]);
  });
});
