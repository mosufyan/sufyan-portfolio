import { PERSONAL_INFO } from '../data/portfolioData';

export const PORTFOLIO_CANONICAL_URL = 'https://www.mohammedsufyan.com/';

export function buildVCardString(): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Sufyan;Mohammed;;;',
    `FN:${PERSONAL_INFO.name}`,
    'ORG:Cisco Systems Inc.',
    'TITLE:Software Engineer - Cisco Systems Inc. STO CTO Operations',
    `EMAIL;TYPE=INTERNET,PREF:${PERSONAL_INFO.email}`,
    `URL:${PORTFOLIO_CANONICAL_URL}`,
    `URL;TYPE=LinkedIn:${PERSONAL_INFO.linkedin}`,
    'ADR;TYPE=WORK:;;San Jose;CA;;United States',
    'NOTE:13+ years Cloud Solutions Architect & Staff Software Engineer across Cisco Systems Inc., HCL America Inc./HCLTech, and TCS (US, UK, India).',
    'END:VCARD',
  ];
  return lines.join('\r\n');
}

export function downloadVCard(): void {
  const vcard = buildVCardString();
  const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Mohammed_Sufyan.vcf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
