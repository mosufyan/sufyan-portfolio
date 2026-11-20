import { describe, expect, it } from 'vitest';
import {
  detectCountryFromPlusPrefix,
  isPlausibleNationalNumber,
  validateAndNormalizePhone,
} from './phoneValidation';

describe('validateAndNormalizePhone', () => {
  it('allows empty optional input', () => {
    expect(validateAndNormalizePhone('', 'US')).toEqual({
      valid: true,
      normalizedE164: '',
      internationalDisplay: '',
      countryCode: '',
      callingCode: '',
    });
  });

  it('validates and normalizes genuine US, India, UK, and UAE numbers', () => {
    const us = validateAndNormalizePhone('(408) 622-9481', 'US');
    expect(us.valid).toBe(true);
    expect(us.normalizedE164).toBe('+14086229481');
    expect(us.countryCode).toBe('US');

    const ind = validateAndNormalizePhone('+91 98201 45678', 'US');
    expect(ind.valid).toBe(true);
    expect(ind.normalizedE164).toBe('+919820145678');
    expect(ind.countryCode).toBe('IN');

    const uk = validateAndNormalizePhone('+44 7712 349820', 'GB');
    expect(uk.valid).toBe(true);
    expect(uk.normalizedE164).toBe('+447712349820');
    expect(uk.countryCode).toBe('GB');

    const ae = validateAndNormalizePhone('50 384 9210', 'AE');
    expect(ae.valid).toBe(true);
    expect(ae.normalizedE164).toBe('+971503849210');
    expect(ae.countryCode).toBe('AE');
  });

  it('blocks dummy, sequential, repeating, low-entropy, and drama numbers', () => {
    expect(validateAndNormalizePhone('0000000000', 'US').valid).toBe(false);
    expect(validateAndNormalizePhone('111-111-1111', 'US').valid).toBe(false);
    expect(validateAndNormalizePhone('1234567890', 'US').valid).toBe(false);
    expect(validateAndNormalizePhone('+1 (408) 555-0142', 'US').valid).toBe(false);
    expect(validateAndNormalizePhone('+1 (408) 555-1212', 'US').valid).toBe(false);
    expect(validateAndNormalizePhone('+1 (408) 867-5309', 'US').valid).toBe(false);
    expect(validateAndNormalizePhone('+1 (408) 600-0000', 'US').valid).toBe(false);
    expect(validateAndNormalizePhone('+1 (408) 404-0404', 'US').valid).toBe(false);
    expect(validateAndNormalizePhone('+91 98765 43210', 'IN').valid).toBe(false);
    expect(validateAndNormalizePhone('+91 99887 76655', 'IN').valid).toBe(false);
    expect(validateAndNormalizePhone('+91 90000 00000', 'IN').valid).toBe(false);
    expect(validateAndNormalizePhone('+44 7700 900123', 'GB').valid).toBe(false);
    expect(validateAndNormalizePhone('+61 491 570 156', 'AU').valid).toBe(false);
  });

  it('rejects wrong length or invalid country prefix', () => {
    expect(validateAndNormalizePhone('+91 98201', 'IN').valid).toBe(false);
    expect(validateAndNormalizePhone('+91 1234567890', 'IN').valid).toBe(false);
    expect(validateAndNormalizePhone('9820145678', 'INTL').valid).toBe(false);
  });

  it('detects country from + dialing prefix', () => {
    expect(detectCountryFromPlusPrefix('+91 98201 45678')).toBe('IN');
    expect(detectCountryFromPlusPrefix('+44 7712 349820')).toBe('GB');
    expect(detectCountryFromPlusPrefix('+971 50 384 9210')).toBe('AE');
  });

  it('checks national plausibility directly', () => {
    expect(isPlausibleNationalNumber('4086229481', 'US')).toBe(true);
    expect(isPlausibleNationalNumber('1231231234', 'US')).toBe(false);
    expect(isPlausibleNationalNumber('7007007007', 'IN')).toBe(false);
  });
});
