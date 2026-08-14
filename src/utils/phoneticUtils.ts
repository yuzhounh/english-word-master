import { SpeechAccent } from '../types';

export interface PhoneticFields {
  phonetic?: string;
  phoneticUs?: string;
  phoneticUk?: string;
}

export interface PhoneticDisplayResult {
  label: '美' | '英';
  value: string;
}

export function getAccentPhoneticLabel(accent: SpeechAccent): '美' | '英' {
  return accent === 'en-GB' ? '英' : '美';
}

/** Pick phonetic for the active accent; fall back to the other variant or generic phonetic. */
export function getPhoneticForAccent(
  item: PhoneticFields,
  accent: SpeechAccent = 'en-US',
): PhoneticDisplayResult | null {
  const us = item.phoneticUs?.trim();
  const uk = item.phoneticUk?.trim();
  const generic = item.phonetic?.trim();
  const label = getAccentPhoneticLabel(accent);

  if (accent === 'en-GB') {
    if (uk) return { label, value: uk };
    if (us) return { label, value: us };
    if (generic) return { label, value: generic };
  } else {
    if (us) return { label, value: us };
    if (uk) return { label, value: uk };
    if (generic) return { label, value: generic };
  }
  return null;
}

export function getPhoneticColumnLabel(accent: SpeechAccent): string {
  return accent === 'en-GB' ? '英音音标' : '美音音标';
}
