import type { WordItem, WordListGroup, WrongWordItem, MasteredWordItem } from '../types';

export const STARTUP_STORAGE_KEY = 'wordmaster_startup_v1';
export const DEFAULT_BOOK_KEY = 'wrong:custom:offline-cet4';
export interface BookVisit { key: string; mode: 'browse' | 'quiz'; name?: string }
export interface StartupPreferences { rememberLast: boolean; defaultKey: string; lastVisit: BookVisit | null }
export const isBookKey = (key: unknown): key is string => typeof key === 'string' && (
  ['wrong:all', 'wrong:high_error', 'wrong:recent', 'mastered:all', 'mastered:recent'].includes(key)
  || (key.startsWith('wrong:custom:') && key.length > 13)
  || (key.startsWith('library:') && key.length > 8)
);
export function parseStartupPreferences(raw: string | null): StartupPreferences {
  const fallback: StartupPreferences = { rememberLast: true, defaultKey: DEFAULT_BOOK_KEY, lastVisit: null };
  try {
    const value = JSON.parse(raw || 'null');
    if (!value || typeof value !== 'object') return fallback;
    const last = value.lastVisit;
    return {
      rememberLast: typeof value.rememberLast === 'boolean' ? value.rememberLast : true,
      defaultKey: isBookKey(value.defaultKey) && !value.defaultKey.startsWith('library:') ? value.defaultKey : DEFAULT_BOOK_KEY,
      lastVisit: last && isBookKey(last.key) && ['browse', 'quiz'].includes(last.mode)
        ? { key: last.key, mode: last.mode, ...(typeof last.name === 'string' ? { name: last.name } : {}) } : null,
    };
  } catch { return fallback; }
}
export function startupVisit(prefs: StartupPreferences): BookVisit {
  const book = prefs.rememberLast && prefs.lastVisit ? prefs.lastVisit : { key: prefs.defaultKey };
  return { ...book, mode: 'quiz' };
}
export function resolveLocalBook(key: string, lists: WordListGroup[], wrong: WrongWordItem[], mastered: MasteredWordItem[], now = Date.now()): { key: string; name: string; words: WordItem[] } {
  const fallback = { key: 'wrong:all', name: '全量生词', words: wrong };
  if (key.startsWith('wrong:custom:')) {
    const list = lists.find(list => list.id === key.slice(13));
    if (!list) return fallback;
    const wrongById = new Map(wrong.map(word => [word.id.toLowerCase().trim(), word]));
    const masteredIds = new Set(mastered.map(word => word.id));
    return { key, name: list.name, words: list.words
      .filter(word => list.sourceType !== 'built_in' || !masteredIds.has(word.id))
      .map(word => {
        const learned = wrongById.get((word.id || word.word).toLowerCase().trim());
        return learned ? { ...word, ...learned, phonetic: learned.phonetic || word.phonetic,
          chinese: learned.chinese || word.chinese, exampleSentence: learned.exampleSentence || word.exampleSentence,
          exampleSentenceCn: learned.exampleSentenceCn || word.exampleSentenceCn } : word;
      }) };
  }
  if (key === 'wrong:high_error') return { key, name: '顽固难词', words: wrong.filter(word => word.errorCount >= 2) };
  if (key === 'wrong:recent') return { key, name: '近期新增', words: wrong.filter(word => word.errorCount > 0 && now - (word.lastErrorAt || word.createdAt) <= 7 * 86400000) };
  if (key === 'mastered:all') return { key, name: '全量熟词', words: mastered };
  if (key === 'mastered:recent') return { key, name: '近期掌握', words: mastered.filter(word => now - word.masteredAt <= 7 * 86400000) };
  return fallback;
}
