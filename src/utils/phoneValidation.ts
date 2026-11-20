import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

export interface PhoneCountryOption {
  code: CountryCode | 'INTL';
  label: string;
  dialCode: string;
  example: string;
}

export const PHONE_COUNTRY_OPTIONS: PhoneCountryOption[] = [
  { code: 'US', label: 'US', dialCode: '+1', example: '(408) 839-4720' },
  { code: 'IN', label: 'IN', dialCode: '+91', example: '98201 45678' },
  { code: 'GB', label: 'UK', dialCode: '+44', example: '7712 349820' },
  { code: 'CA', label: 'CA', dialCode: '+1', example: '(416) 829-3410' },
  { code: 'AE', label: 'AE', dialCode: '+971', example: '50 384 9210' },
  { code: 'SG', label: 'SG', dialCode: '+65', example: '9128 4730' },
  { code: 'AU', label: 'AU', dialCode: '+61', example: '412 839 204' },
  { code: 'DE', label: 'DE', dialCode: '+49', example: '1512 8493021' },
  { code: 'FR', label: 'FR', dialCode: '+33', example: '6 48 29 10 34' },
  { code: 'NL', label: 'NL', dialCode: '+31', example: '6 4829 1034' },
  { code: 'JP', label: 'JP', dialCode: '+81', example: '90-4829-1034' },
  { code: 'INTL', label: 'Other', dialCode: '+', example: '+41 44 580 2410' },
];

export type SelectedPhoneCountry = CountryCode | 'INTL';

export interface PhoneValidationResult {
  valid: boolean;
  normalizedE164: string;
  internationalDisplay: string;
  countryCode: string;
  callingCode: string;
  reason?: string;
}

const UK_DRAMA_NATIONAL_PREFIXES = [
  '7700900',
  '1632960',
  '2079460',
  '1134960',
  '1144960',
  '1154960',
  '1164960',
  '1174960',
  '1184960',
  '1214960',
  '1314960',
  '1414960',
  '1514960',
  '1614960',
  '1914980',
  '2896496',
  '2920180',
  '3069990',
  '8081570',
  '9098790',
];

const AU_DRAMA_NATIONAL_PREFIXES = [
  '491570',
  '25550',
  '37010',
  '75550',
  '85550',
  '87010',
];

const FAMOUS_FAKE_NATIONALS = new Set([
  '8675309',
  '4088675309',
  '2128675309',
  '3108675309',
  '4158675309',
  '9988776655',
  '9998887776',
  '9876501234',
  '9123456789',
]);

export function guessDefaultPhoneCountry(): SelectedPhoneCountry {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Kolkata') || tz.includes('Calcutta')) return 'IN';
    if (tz === 'Europe/London') return 'GB';
    if (tz === 'Asia/Dubai') return 'AE';
    if (tz === 'Asia/Singapore') return 'SG';
    if (tz.startsWith('Australia/')) return 'AU';
    if (tz === 'Europe/Berlin') return 'DE';
    if (tz === 'Europe/Paris') return 'FR';
    if (tz === 'Europe/Amsterdam') return 'NL';
    if (tz === 'Asia/Tokyo') return 'JP';
    if (tz.includes('Toronto') || tz.includes('Vancouver') || tz.includes('Montreal')) return 'CA';
  } catch {
    // ignore environment without Intl timezone
  }
  return 'US';
}

export function detectCountryFromPlusPrefix(rawInput: string): SelectedPhoneCountry | null {
  const trimmed = rawInput.trim();
  if (!trimmed.startsWith('+')) return null;
  const parsed = parsePhoneNumberFromString(trimmed);
  if (parsed?.country) {
    const match = PHONE_COUNTRY_OPTIONS.find((opt) => opt.code === parsed.country);
    return match ? match.code : 'INTL';
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('971')) return 'AE';
  if (digits.startsWith('91')) return 'IN';
  if (digits.startsWith('44')) return 'GB';
  if (digits.startsWith('65')) return 'SG';
  if (digits.startsWith('61')) return 'AU';
  if (digits.startsWith('49')) return 'DE';
  if (digits.startsWith('33')) return 'FR';
  if (digits.startsWith('31')) return 'NL';
  if (digits.startsWith('81')) return 'JP';
  if (digits.startsWith('1')) return 'US';
  return 'INTL';
}

function hasSequentialRun(digits: string, minLength = 6): boolean {
  const ascending = '0123456789012345';
  const descending = '9876543210987654';
  if (digits.length < minLength) return false;
  for (let i = 0; i <= digits.length - minLength; i += 1) {
    const slice = digits.slice(i, i + minLength);
    if (ascending.includes(slice) || descending.includes(slice)) {
      return true;
    }
  }
  return false;
}

function isRepeatingPattern(digits: string): boolean {
  if (digits.length < 6) return false;
  // All 2-digit pairs doubled (e.g. 9988776655, 1122334455)
  if (digits.length % 2 === 0) {
    let allDoubledPairs = true;
    for (let i = 0; i < digits.length; i += 2) {
      if (digits[i] !== digits[i + 1]) {
        allDoubledPairs = false;
        break;
      }
    }
    if (allDoubledPairs) return true;
  }

  // Exact 2-digit or 3-digit cycle across at least first 6 digits (e.g. 121212..., 1231231234)
  for (const period of [2, 3]) {
    const pattern = digits.slice(0, period);
    const repeated = pattern.repeat(Math.ceil(digits.length / period)).slice(0, digits.length);
    if (digits === repeated || digits.slice(0, 6) === repeated.slice(0, 6)) {
      // Avoid blocking legit 123-123-xxxx unless >= 8 matching digits
      let matchLen = 0;
      for (let i = 0; i < digits.length; i += 1) {
        if (digits[i] === repeated[i]) matchLen += 1;
        else break;
      }
      if (matchLen >= 8 || matchLen === digits.length) return true;
    }
  }

  return false;
}

export function isPlausibleNationalNumber(national: string, countryCode: string): boolean {
  if (!national || national.length < 5) return false;

  // All identical digits (0000000, 9999999999)
  if (/^(\d)\1+$/.test(national)) return false;

  // 5+ consecutive identical digits anywhere (e.g. 408-600-0000 or 9000001234)
  if (/(\d)\1{4,}/.test(national)) return false;

  // Very low digit entropy overall or across the 7-digit local subscriber suffix (e.g. 408-404-0404)
  if (national.length >= 7 && (new Set(national).size <= 2 || new Set(national.slice(-7)).size <= 2)) {
    return false;
  }

  // Sequential ascending/descending runs of 6+ digits (e.g. 9876543210, 4081234567)
  if (hasSequentialRun(national, 6)) return false;

  // Repeating digit pairs / cyclic fakes (e.g. 9988776655, 1231231234)
  if (isRepeatingPattern(national)) return false;

  if (FAMOUS_FAKE_NATIONALS.has(national)) return false;

  // US / Canada (NANP) fictional blocks
  if (countryCode === 'US' || countryCode === 'CA' || countryCode === '') {
    if (
      /^\d{3}55501\d{2}$/.test(national) ||
      /^\d{3}5551212$/.test(national) ||
      /^\d{3}5550000$/.test(national) ||
      /^555\d{7}$/.test(national) ||
      /^55501\d{2}$/.test(national) ||
      /\d{6}0000$/.test(national)
    ) {
      return false;
    }
  }

  // UK Ofcom drama/fake numbers
  if (countryCode === 'GB') {
    if (UK_DRAMA_NATIONAL_PREFIXES.some((prefix) => national.startsWith(prefix))) {
      return false;
    }
  }

  // Australia ACMA drama numbers
  if (countryCode === 'AU') {
    if (AU_DRAMA_NATIONAL_PREFIXES.some((prefix) => national.startsWith(prefix))) {
      return false;
    }
  }

  // India: 10-digit mobile starting 6-9 is checked by libphonenumber-js, block trailing 00000 / 98765x
  if (countryCode === 'IN') {
    if (/^[6-9]\d{4}00000$/.test(national)) return false;
  }

  return true;
}

export function validateAndNormalizePhone(
  rawInput: string,
  selectedCountry: SelectedPhoneCountry = 'US'
): PhoneValidationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      valid: true,
      normalizedE164: '',
      internationalDisplay: '',
      countryCode: '',
      callingCode: '',
    };
  }

  if (trimmed.length > 40 || !/^[+\d\s().-]+$/.test(trimmed)) {
    return {
      valid: false,
      normalizedE164: '',
      internationalDisplay: '',
      countryCode: '',
      callingCode: '',
      reason: 'Phone number contains invalid characters.',
    };
  }

  const startsWithPlus = trimmed.startsWith('+');
  const fallbackCountry: CountryCode | undefined =
    selectedCountry === 'INTL' ? undefined : selectedCountry;

  if (!startsWithPlus && !fallbackCountry) {
    return {
      valid: false,
      normalizedE164: '',
      internationalDisplay: '',
      countryCode: '',
      callingCode: '',
      reason: 'Include your country code starting with "+" (e.g. +1 408 839 4720 or +91 98201 45678).',
    };
  }

  let parsed = parsePhoneNumberFromString(
    trimmed,
    startsWithPlus ? undefined : fallbackCountry
  );

  // If no "+" was supplied and default country is US, allow valid international "+CC..." digits?
  // Only fall back to Indian 10-digit mobile if US parse failed AND digits match [6-9]\d{9} when no country explicitly forced?
  // Wait: if backend receives bare "9820145678" without a country selector, parsing as US fails (982 area code invalid/or mobile) - keep strict unless explicit '+' or country selector!
  if (!parsed && !startsWithPlus && fallbackCountry === 'US') {
    const bareDigits = trimmed.replace(/\D/g, '');
    if (bareDigits.length >= 11 && bareDigits.length <= 15) {
      parsed = parsePhoneNumberFromString(`+${bareDigits}`);
    }
  }

  if (!parsed || !parsed.isValid()) {
    return {
      valid: false,
      normalizedE164: '',
      internationalDisplay: '',
      countryCode: parsed?.country || '',
      callingCode: parsed?.countryCallingCode ? `+${parsed.countryCallingCode}` : '',
      reason: startsWithPlus
        ? 'Please enter a valid international phone number (check country code and digit count).'
        : `Please enter a valid ${selectedCountry} phone number, or switch the country code.`,
    };
  }

  const countryCode = parsed.country || '';
  const national = parsed.nationalNumber || '';

  if (!isPlausibleNationalNumber(national, countryCode)) {
    return {
      valid: false,
      normalizedE164: '',
      internationalDisplay: '',
      countryCode,
      callingCode: parsed.countryCallingCode ? `+${parsed.countryCallingCode}` : '',
      reason: 'Please enter a genuine phone number (dummy, sequential, or reserved test numbers are blocked).',
    };
  }

  return {
    valid: true,
    normalizedE164: parsed.number,
    internationalDisplay: parsed.formatInternational(),
    countryCode,
    callingCode: parsed.countryCallingCode ? `+${parsed.countryCallingCode}` : '',
  };
}
