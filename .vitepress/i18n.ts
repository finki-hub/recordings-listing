import { en } from './locales/en.ts';
import { mk } from './locales/mk.ts';
import { sq } from './locales/sq.ts';
import { tr } from './locales/tr.ts';

const languagePrefixPattern = /^\/?(?<capture1>en|sq|tr)(?:\/|$)/u;
const removableLanguagePrefixPattern = /^(?<capture1>\/?)(?:en|sq|tr)(?:\/|$)/u;

export type Language = 'en' | 'mk' | 'sq' | 'tr';
export type Translations = Localized<typeof mk>;
type Localized<T> = T extends string
  ? string
  : { readonly [Key in keyof T]: Localized<T[Key]> };
export const languageNames = {
  en: 'English',
  mk: 'Македонски',
  sq: 'Shqip',
  tr: 'Türkçe',
} as const;
export const languageLocales: Record<Language, string> = {
  en: 'en-GB',
  mk: 'mk-MK',
  sq: 'sq-AL',
  tr: 'tr-TR',
};
export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && Object.hasOwn(languageNames, value);
export const translations: Record<Language, Translations> = { en, mk, sq, tr };

export const languageFromPath = (path: string): Language => {
  const code = languagePrefixPattern.exec(path.replaceAll('\\', '/'))?.at(1);
  return isLanguage(code) ? code : 'mk';
};

export const stripLanguagePrefix = (path: string): string =>
  path
    .replaceAll('\\', '/')
    .replace(removableLanguagePrefixPattern, '$<capture1>');

export const localizedPath = (path: string, language: Language): string => {
  const canonical = stripLanguagePrefix(path);
  const prefix = language === 'mk' ? '' : `/${language}`;
  const route = canonical.startsWith('/') ? canonical : `/${canonical}`;
  return prefix + route;
};

export const LANGUAGE_STORAGE_KEY = 'finki-hub-lang';
export const readLanguagePreference = (): Language => {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(saved) ? saved : 'mk';
  } catch {
    return 'mk';
  }
};

export const saveLanguagePreference = (language: Language): void => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* Keep the selected route when storage is unavailable. */
  }
};
