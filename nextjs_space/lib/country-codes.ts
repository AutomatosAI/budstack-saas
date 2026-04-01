/**
 * ISO 3166-1 Alpha-2 to Alpha-3 country code mapping.
 * Consolidated from doctor-green-api.ts and consultation/submit.
 * Dr Green API requires Alpha-3 codes.
 */
export const COUNTRY_CODE_MAP: Record<string, string> = {
  PT: 'PRT',
  GB: 'GBR',
  UK: 'GBR',
  ZA: 'ZAF',
  SA: 'SAU',
  TH: 'THA',
  US: 'USA',
  DE: 'DEU',
  FR: 'FRA',
  ES: 'ESP',
  IT: 'ITA',
  NL: 'NLD',
  BE: 'BEL',
  IE: 'IRL',
  GR: 'GRC',
  CA: 'CAN',
  AU: 'AUS',
  NZ: 'NZL',
  CH: 'CHE',
  SE: 'SWE',
  NO: 'NOR',
  DK: 'DNK',
  PL: 'POL',
  CZ: 'CZE',
  IL: 'ISR',
  BR: 'BRA',
  MX: 'MEX',
  AR: 'ARG',
  CL: 'CHL',
  CO: 'COL',
  MY: 'MYS',
  SG: 'SGP',
  IN: 'IND',
  PK: 'PAK',
  PH: 'PHL',
  ID: 'IDN',
  JP: 'JPN',
  KR: 'KOR',
  CN: 'CHN',
  HK: 'HKG',
  TW: 'TWN',
};

/** Convert ISO Alpha-2 country code to Alpha-3. Returns input if no mapping found. */
export function toAlpha3(code: string): string {
  return COUNTRY_CODE_MAP[code.toUpperCase()] || code;
}
