import { WordItem, WrongWordItem, MasteredWordItem } from '../types';

export interface ParsedWord {
  word: string;
  chinese: string;
  phonetic?: string;
  exampleSentence?: string;
  exampleSentenceCn?: string;
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

/**
 * Call server AI to enrich parsed words with phonetics, part-of-speech Chinese definitions, example sentences & quiz options
 * The server returns partial results within its time budget; the client keeps calling until done.
 * Reports progress via the (processed, total) callback.
 */
export async function enrichWordsWithAI(
  words: ParsedWord[],
  onProgress?: (processed: number, total: number) => void
): Promise<WordItem[]> {
  if (!words || words.length === 0) return [];

  const results: WordItem[] = [];
  const total = words.length;
  let pending: ParsedWord[] = words.slice();
  let processedCount = 0;
  let guard = 0;

  while (pending.length > 0 && guard < 500) {
    guard++;
    let data: any = null;
    try {
      const response = await fetch('/api/enrich-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: pending })
      });
      data = await response.json();
    } catch (err) {
      console.error('Enrich words batch failed:', err);
      break;
    }

    if (data && data.success && Array.isArray(data.words)) {
      results.push(...data.words);
      processedCount += data.words.length;
      if (onProgress) {
        onProgress(Math.min(processedCount, total), total);
      }
      if (data.done) break;
      if (Array.isArray(data.pending) && data.pending.length > 0) {
        pending = data.pending;
      } else {
        break;
      }
    } else {
      // Fallback for the remaining pending words (server error)
      pending.forEach(w => {
        const base = w.word.toLowerCase().trim();
        results.push({
          id: base,
          word: w.word,
          phonetic: w.phonetic || '',
          chinese: w.chinese || w.word,
          exampleSentence: w.exampleSentence || '',
          exampleSentenceCn: w.exampleSentenceCn || ''
        });
      });
      if (onProgress) {
        onProgress(total, total);
      }
      break;
    }
  }

  return results;
}
