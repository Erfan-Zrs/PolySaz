import { formatDate, formatNumber, formatPriceAmount } from './format';

const LATIN_DIGIT = /[0-9]/;

describe('number formatting per language', () => {
  it('uses Persian digits in fa', () => {
    const s = formatNumber(12345, 'fa');
    expect(s).toBe('۱۲٬۳۴۵');
    expect(LATIN_DIGIT.test(s)).toBe(false);
  });

  it('uses Latin digits in en', () => {
    expect(formatNumber(12345, 'en')).toBe('12,345');
    expect(formatNumber(84.4, 'en', { maximumFractionDigits: 1 })).toBe('84.4');
  });

  it('formats decimals with the Persian decimal separator', () => {
    expect(formatNumber(84.4, 'fa', { maximumFractionDigits: 1 })).toBe('۸۴٫۴');
  });

  it('formats toman prices without decimals', () => {
    expect(formatPriceAmount(250000.6, 'en')).toBe('250,001');
    expect(formatPriceAmount(250000, 'fa')).toBe('۲۵۰٬۰۰۰');
  });

  it('falls back to the default language for unknown codes', () => {
    expect(formatNumber(7, 'xx')).toBe('۷');
  });
});

describe('date formatting per language', () => {
  const nowruz1405 = new Date(Date.UTC(2026, 2, 21, 12));

  it('uses the Jalali calendar in fa', () => {
    const s = formatDate(nowruz1405, 'fa', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      timeZone: 'UTC',
    });
    expect(s).toContain('۱۴۰۵');
    expect(LATIN_DIGIT.test(s)).toBe(false);
  });

  it('uses the Gregorian calendar in en', () => {
    const s = formatDate(nowruz1405, 'en', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      timeZone: 'UTC',
    });
    expect(s).toBe('3/21/2026');
  });
});
