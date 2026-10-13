import { WordItem, WordListGroup } from '../types';

interface OfflinePayload {
  version: number;
  defaultBook: string;
  books: { id: string; name: string; source: string; wordIds: string[] }[];
  dictionary: Record<string, { w: string; p?: string; us?: string; uk?: string; c: string; e: string; cn: string }>;
}

let loading: Promise<{ lists: WordListGroup[]; defaultWords: WordItem[] }> | null = null;

export function loadOfflineVocabulary() {
  if (!loading) {
    loading = (async () => {
      // This is a packaged APK / same-origin web asset; no remote API or sign-in.
      const response = await fetch(`${(import.meta as any).env.BASE_URL}offline/vocabulary.bin`);
      if (!response.ok) throw new Error('内置词集文件无法读取，请重试。');
      const bytes = new Uint8Array(await response.arrayBuffer());
      // Some web hosts transparently decompress .gz responses; accept either form.
      const data: OfflinePayload = bytes[0] === 0x1f && bytes[1] === 0x8b
        ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json()
        : JSON.parse(new TextDecoder().decode(bytes));
      if (data.version !== 1 || data.books.length !== 8) throw new Error('内置词集版本不完整。');
      const words = new Map(Object.entries(data.dictionary).map(([id, item]) => [id, {
        id, word: item.w, phonetic: item.p || item.us || item.uk || '', phoneticUs: item.us,
        phoneticUk: item.uk, chinese: item.c, exampleSentence: item.e, exampleSentenceCn: item.cn,
      } as WordItem]));
      const lists: WordListGroup[] = data.books.map(book => ({
        id: book.id, name: book.name, description: book.source, sourceType: 'built_in',
        createdAt: 0, wordCount: book.wordIds.length,
        words: book.wordIds.map(id => {
          const word = words.get(id);
          if (!word) throw new Error(`内置词条缺失：${id}`);
          return word;
        }),
      }));
      const defaultWords = lists.find(list => list.id === data.defaultBook)?.words;
      if (!defaultWords?.length) throw new Error('大学四级词集无法读取。');
      return { lists, defaultWords };
    })().catch(error => { loading = null; throw error; });
  }
  return loading;
}
