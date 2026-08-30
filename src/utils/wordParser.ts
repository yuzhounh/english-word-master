import { WordItem, WrongWordItem, MasteredWordItem } from '../types';
import { getApiUrl } from '../lib/apiConfig';

export interface ParsedWord {
  word: string;
  chinese: string;
  phonetic?: string;
  exampleSentence?: string;
  exampleSentenceCn?: string;
}

/** Parse a plain word list: one English word (or hyphenated phrase) per line. */
export function parsePlainWordList(rawText: string): ParsedWord[] {
  if (!rawText?.trim()) return [];

  const result: ParsedWord[] = [];
  const seen = new Set<string>();

  for (const line of rawText.split(/[\r\n]+/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (/[\u4e00-\u9fa5]/.test(trimmed)) continue;
    if (/[:：]/.test(trimmed)) continue;

    const word = trimmed
      .replace(/^[\d.\-*•\[\]\s]+/, '')
      .trim()
      .replace(/^[^a-zA-Z]+|[^a-zA-Z'\-\s]+$/g, '')
      .trim();

    if (!word || word.length > 45) continue;
    if (!/^[a-zA-Z][a-zA-Z0-9'\-\s]*$/.test(word)) continue;

    const key = word.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;

    seen.add(key);
    result.push({ word, chinese: '' });
  }

  return result;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/** Parse WordMaster exported JSON (生词本/熟词本导出格式). */
export function parseExportedWordMasterJson(rawText: string): ParsedWord[] {
  try {
    const parsed = JSON.parse(rawText.trim());
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const result: ParsedWord[] = [];
    const seen = new Set<string>();

    for (const item of arr) {
      if (!item) continue;
      const word = (item.word || item.id || '').toString().trim();
      if (!word) continue;
      const key = word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        word,
        chinese: item.chinese || item.definition || item.meaning || '',
        phonetic: item.phonetic || '',
        exampleSentence: item.exampleSentence || item.example || '',
        exampleSentenceCn: item.exampleSentenceCn || item.exampleCn || ''
      });
    }
    return result;
  } catch {
    return [];
  }
}

/** Parse WordMaster exported CSV (与导出列一致). */
export function parseExportedWordMasterCsv(rawText: string): ParsedWord[] {
  const lines = rawText.replace(/^\uFEFF/, '').split(/[\r\n]+/).filter(Boolean);
  if (lines.length === 0) return [];

  const result: ParsedWord[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (i === 0 && (line.startsWith('单词,') || line.toLowerCase().startsWith('word,'))) continue;

    const cols = parseCsvLine(line);
    const word = (cols[0] || '').trim();
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      word,
      phonetic: cols[1]?.trim() || '',
      chinese: cols[2]?.trim() || '',
      exampleSentence: cols[3]?.trim() || '',
      exampleSentenceCn: cols[4]?.trim() || ''
    });
  }

  return result;
}

export function parsedToWordItems(parsed: ParsedWord[]): WordItem[] {
  return parsed.map((p) => ({
    id: p.word.toLowerCase().trim(),
    word: p.word,
    phonetic: p.phonetic || '',
    chinese: p.chinese || p.word,
    exampleSentence: p.exampleSentence || '',
    exampleSentenceCn: p.exampleSentenceCn || ''
  }));
}

/** Dictionary lookup first, then AI for missing entries. */
export async function enrichParsedWords(
  words: ParsedWord[],
  onProgress?: (message: string) => void
): Promise<WordItem[]> {
  if (!words.length) return [];

  onProgress?.(`正在查询词库… (${words.length} 个单词)`);
  const { resolved, needsAi } = await resolveWordsWithDictionary(words);

  if (needsAi.length === 0) {
    return resolved;
  }

  onProgress?.(`词库已匹配 ${resolved.length} 个，AI 补全中…`);
  const aiEnriched = await enrichWordsWithAI(needsAi, (processed, total) => {
    onProgress?.(`AI 补全中… ${processed} / ${total}`);
  });

  return restoreSourceOrder(words, [...resolved, ...aiEnriched]);
}

function restoreSourceOrder(source: ParsedWord[], enriched: WordItem[]): WordItem[] {
  const byWord = new Map(enriched.map(item => [item.word.toLowerCase().trim(), item]));
  return source
    .map(item => byWord.get(item.word.toLowerCase().trim()))
    .filter((item): item is WordItem => !!item);
}

/**
 * Smart multi-format parser for English vocabulary lists.
 * Supports:
 * - Format 1: Header tags (### Unit 1) mixed with pure words line by line
 * - Format 2: Pure English word list line by line
 * - Format 3: Numbered markdown lists (1. **exchange** n. 交换；交流 vt. 交换...)
 * - Format 4: Numbered plain text lists (1. exchange n. 交换；交流...)
 * - Other formats: Colon/dash/tab separated, CSV, JSON string, space-separated word + definition
 */
export function parseWordListText(rawText: string): ParsedWord[] {
  if (!rawText || !rawText.trim()) return [];

  const trimmedText = rawText.trim();

  // 1. Check if it's a JSON string
  if (trimmedText.startsWith('[') || trimmedText.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmedText);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const jsonResults: ParsedWord[] = [];
      const jsonSeen = new Set<string>();

      for (const item of arr) {
        if (!item) continue;
        const w = (item.word || item.id || '').trim();
        const cleanWord = w.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '').trim();
        if (cleanWord && !jsonSeen.has(cleanWord.toLowerCase())) {
          jsonSeen.add(cleanWord.toLowerCase());
          jsonResults.push({
            word: cleanWord,
            chinese: item.chinese || item.definition || item.meaning || '',
            phonetic: item.phonetic || '',
            exampleSentence: item.exampleSentence || item.example || '',
            exampleSentenceCn: item.exampleSentenceCn || item.exampleCn || ''
          });
        }
      }

      if (jsonResults.length > 0) return jsonResults;
    } catch {
      // Fallthrough to line-by-line parsing
    }
  }

  // 2. Line-by-line parsing
  const lines = trimmedText.split(/[\r\n]+/);
  const result: ParsedWord[] = [];
  const seen = new Set<string>();

  const isIgnoredLine = (l: string) => {
    const lower = l.toLowerCase();
    // Headers or Markdown rules
    if (l.startsWith('#') || l.startsWith('---') || l.startsWith('===')) {
      return true;
    }
    // Introductory text
    if (
      l.includes('为你整理') ||
      l.includes('完整单词') ||
      l.includes('中文释义列表') ||
      l.includes('教材') ||
      l.includes('必修') ||
      l.includes('新课标')
    ) {
      return true;
    }
    // Section headers like "Welcome Unit", "Unit 1", "Chapter 2"
    if (lower.match(/^(welcome\s+unit|unit\s+\d+|chapter\s+\d+|book\s+\d+|module\s+\d+)/i)) {
      return true;
    }
    return false;
  };

  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue;
    if (isIgnoredLine(trimmed)) continue;

    // Skip CSV header if present
    if (trimmed.toLowerCase().startsWith('单词,') || trimmed.toLowerCase().startsWith('word,')) continue;

    // Strip leading numbering or bullet points like "1.", "1. ", "1) ", "[1] ", "- ", "* ", "• "
    trimmed = trimmed.replace(/^(\d+[\.\、\)\:]|\*|-|•|\[\d+\])+\s*/, '').trim();
    if (!trimmed) continue;

    // Strip markdown bold asterisks e.g. "**exchange**" -> "exchange"
    trimmed = trimmed.replace(/\*\*([^*]+)\*\*/g, '$1');

    // Extract IPA phonetics if enclosed in /.../ or [...]
    let phonetic = '';
    const phoneticMatch = trimmed.match(/[\/\[]([^\/\]]+)[\/\]]/);
    if (phoneticMatch) {
      phonetic = phoneticMatch[0];
      trimmed = trimmed.replace(phoneticMatch[0], '').replace(/\s+/g, ' ').trim();
    }

    let word = '';
    let chinese = '';

    // Check separators
    if (trimmed.includes(':') || trimmed.includes('：')) {
      const parts = trimmed.split(/[:：]/);
      word = parts[0].trim();
      chinese = parts.slice(1).join(':').trim();
    } else if (trimmed.includes(' - ')) {
      const parts = trimmed.split(' - ');
      word = parts[0].trim();
      chinese = parts.slice(1).join(' - ').trim();
    } else if (trimmed.includes('\t')) {
      const parts = trimmed.split('\t');
      word = parts[0].trim();
      chinese = parts.slice(1).join(' ').trim();
    } else if (trimmed.includes(',') && !trimmed.includes(' ')) {
      // Comma-separated single words e.g. "word1,word2,word3"
      const tokens = trimmed.split(',');
      for (const token of tokens) {
        const cleanToken = token.trim().replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
        if (cleanToken && cleanToken.length >= 2 && !seen.has(cleanToken.toLowerCase())) {
          seen.add(cleanToken.toLowerCase());
          result.push({ word: cleanToken, chinese: '', phonetic: '' });
        }
      }
      continue;
    } else {
      // Regex for English word/phrase followed by part-of-speech or Chinese meaning
      // Matches "exchange n. 交换；交流 vt. 交换；交流；兑换"
      // or "extra-curricular adj. 课外 chemical 的"
      const match = trimmed.match(/^([a-zA-Z\s\-\']+?)(?:\s+((?:[a-z]{1,5}\.\s*)?[\u4e00-\u9fa5].*|\b(?:n|v|adj|adv|prep|conj|pron|num|art|vt|vi|c|u)\..*))?$/);

      if (match && match[1]) {
        word = match[1].trim();
        chinese = (match[2] || '').trim();
      } else {
        // Fallback: search for first Chinese character
        const spaceIndex = trimmed.search(/[\u4e00-\u9fa5]/);
        if (spaceIndex > 0) {
          word = trimmed.slice(0, spaceIndex).trim();
          chinese = trimmed.slice(spaceIndex).trim();
        } else {
          word = trimmed;
          chinese = '';
        }
      }
    }

    // Clean English word
    const cleanWord = word.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '').trim();

    // Validate cleanWord
    if (
      cleanWord &&
      cleanWord.length >= 2 &&
      cleanWord.length <= 45 &&
      !seen.has(cleanWord.toLowerCase())
    ) {
      const lower = cleanWord.toLowerCase();
      // Skip leftover header words
      if (lower === 'welcome unit' || lower === 'unit' || lower === 'chapter') {
        continue;
      }

      seen.add(lower);
      result.push({
        word: cleanWord,
        chinese: chinese,
        phonetic: phonetic
      });
    }
  }

  return result;
}

interface EnrichBatchResult {
  words: WordItem[];
  pending: ParsedWord[];
  done: boolean;
  success: boolean;
}

async function enrichWordsBatch(
  words: ParsedWord[],
  light: boolean
): Promise<EnrichBatchResult> {
  try {
    const response = await fetch(getApiUrl('/api/enrich-words'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words, light })
    });
    const data = await response.json();
    if (data?.success && Array.isArray(data.words)) {
      return {
        words: data.words,
        pending: Array.isArray(data.pending) ? data.pending : [],
        done: !!data.done,
        success: true
      };
    }
    return { words: [], pending: words, done: false, success: false };
  } catch (err) {
    console.error('Enrich words batch failed:', err);
    return { words: [], pending: words, done: false, success: false };
  }
}

function fallbackWordItems(words: ParsedWord[]): WordItem[] {
  return words.map(w => {
    const base = w.word.toLowerCase().trim();
    return {
      id: base,
      word: w.word,
      phonetic: w.phonetic || '',
      chinese: w.chinese || w.word,
      exampleSentence: w.exampleSentence || '',
      exampleSentenceCn: w.exampleSentenceCn || ''
    };
  });
}

async function enrichWordsStream(
  words: ParsedWord[],
  light: boolean,
  onSliceProgress?: (processed: number) => void
): Promise<WordItem[]> {
  const results: WordItem[] = [];
  let pending: ParsedWord[] = words.slice();
  let guard = 0;

  while (pending.length > 0 && guard < 500) {
    guard++;
    const data = await enrichWordsBatch(pending, light);

    if (data.success) {
      results.push(...data.words);
      onSliceProgress?.(data.words.length);
      if (data.done) break;
      if (data.pending.length > 0) {
        pending = data.pending;
      } else {
        break;
      }
    } else {
      results.push(...fallbackWordItems(pending));
      onSliceProgress?.(pending.length);
      break;
    }
  }

  return results;
}

/** Look up words in the pre-enriched server dictionary; return resolved items and words still needing AI. */
export async function resolveWordsWithDictionary(
  words: ParsedWord[]
): Promise<{ resolved: WordItem[]; needsAi: ParsedWord[] }> {
  if (!words.length) return { resolved: [], needsAi: [] };

  try {
    const response = await fetch(getApiUrl('/api/word-dictionary/lookup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words })
    });
    const data = await response.json();
    if (!data?.success || !Array.isArray(data.words)) {
      return { resolved: [], needsAi: words };
    }

    const resolved: WordItem[] = [];
    const needsAi: ParsedWord[] = [];

    data.words.forEach((item: any, i: number) => {
      const source = words[i];
      const key = (source?.word || item.word || '').toLowerCase().trim();
      const wordItem: WordItem = {
        id: key,
        word: item.word || source?.word || '',
        phonetic: item.phonetic || source?.phonetic || '',
        phoneticUk: item.phoneticUk,
        phoneticUs: item.phoneticUs,
        chinese: item.chinese || source?.chinese || '',
        exampleSentence: item.exampleSentence || source?.exampleSentence || '',
        exampleSentenceCn: item.exampleSentenceCn || source?.exampleSentenceCn || ''
      };

      if (item.enriched) {
        resolved.push(wordItem);
      } else {
        needsAi.push(source || { word: wordItem.word, chinese: wordItem.chinese });
      }
    });

    return { resolved, needsAi };
  } catch (err) {
    console.warn('Dictionary lookup failed, falling back to AI for all words:', err);
    return { resolved: [], needsAi: words };
  }
}

/** Enrich words, using dictionary first and AI only for missing entries. */
export async function enrichWordsWithDictionaryFallback(
  words: ParsedWord[],
  onProgress?: (processed: number, total: number) => void
): Promise<WordItem[]> {
  const { resolved, needsAi } = await resolveWordsWithDictionary(words);
  if (needsAi.length === 0) {
    onProgress?.(words.length, words.length);
    return resolved;
  }

  const aiEnriched = await enrichWordsWithAI(needsAi, (processed, total) => {
    onProgress?.(resolved.length + processed, words.length);
  });

  return restoreSourceOrder(words, [...resolved, ...aiEnriched]);
}

/**
 * Call server AI to enrich parsed words with phonetics, part-of-speech Chinese definitions & example sentences.
 * Quiz options are generated locally during quizzes (light mode) for faster bulk processing.
 * The server returns partial results within its time budget; the client keeps calling until done.
 * Reports progress via the (processed, total) callback.
 */
export async function enrichWordsWithAI(
  words: ParsedWord[],
  onProgress?: (processed: number, total: number) => void
): Promise<WordItem[]> {
  if (!words || words.length === 0) return [];

  const total = words.length;
  const light = words.length > 5;
  const parallelStreams = words.length >= 120 ? 2 : 1;
  let processedCount = 0;

  const reportProgress = (delta: number) => {
    processedCount = Math.min(processedCount + delta, total);
    onProgress?.(processedCount, total);
  };

  if (parallelStreams === 1) {
    return enrichWordsStream(words, light, reportProgress);
  }

  const sliceSize = Math.ceil(words.length / parallelStreams);
  const slices: ParsedWord[][] = [];
  for (let i = 0; i < words.length; i += sliceSize) {
    slices.push(words.slice(i, i + sliceSize));
  }

  const sliceResults = await Promise.all(
    slices.map(slice => enrichWordsStream(slice, light, reportProgress))
  );

  return sliceResults.flat();
}
