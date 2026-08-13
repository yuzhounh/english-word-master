export type SpeechAccent = 'en-US' | 'en-GB';

export interface WordItem {
  id: string; // lemmatized word in lowercase
  word: string; // base form e.g. "abandon"
  phonetic: string; // e.g. "/əˈbændən/"
  phoneticUk?: string; // e.g. "[bʊk]" 英音
  phoneticUs?: string; // e.g. "[bʊk]" 美音
  chinese: string; // Chinese definition e.g. "vt. 放弃，抛弃"
  exampleSentence: string; // e.g. "He decided to abandon his car."
  exampleSentenceCn: string; // e.g. "他决定放弃他的汽车。"
  options?: string[]; // 4 multiple choice options (1 correct + 3 distractors)
  listId?: string; // optional word list ID association
}

export interface WrongWordItem {
  id: string; // word key
  word: string;
  phonetic: string;
  phoneticUk?: string;
  phoneticUs?: string;
  chinese: string;
  exampleSentence: string;
  exampleSentenceCn: string;
  errorCount: number; // number of times answered incorrectly
  lastErrorAt: number; // timestamp
  createdAt: number;
  listId?: string;
}

export interface MasteredWordItem {
  id: string; // word key in lowercase
  word: string;
  phonetic: string;
  phoneticUk?: string;
  phoneticUs?: string;
  chinese: string;
  exampleSentence: string;
  exampleSentenceCn: string;
  masteredAt: number; // timestamp when marked as mastered
  listId?: string;
}

export interface WordListGroup {
  id: string; // e.g. "list-1", "extracted-20260809"
  name: string; // e.g. "词本 1", "考研冲刺词汇"
  description?: string;
  category?: string; // e.g. "文本提取", "生词本", "熟词本", "自定义导入"
  words: WordItem[];
  wordCount: number;
  createdAt: number;
  updatedAt?: number;
  sourceType?: 'custom' | 'extracted' | 'built_in' | 'wrong' | 'mastered';
  path?: string; // for remote built-in books e.g. "1.全国各大教材版本中小学同步/人教版/人教版一年级起点一年级上.xlsx"
}

export interface LibraryCategoryNode {
  name: string;
  path: string;
  type: 'folder' | 'book';
  size?: number;
  bookCount?: number;
  children?: LibraryCategoryNode[];
}

export interface QuizQuestion {
  id: string;
  word: string;
  phonetic: string;
  phoneticUk?: string;
  phoneticUs?: string;
  chinese: string;
  exampleSentence: string;
  exampleSentenceCn: string;
  options: string[]; // 4 Chinese translation options
  correctIndex: number; // 0, 1, 2, or 3
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isGuest?: boolean;
}

export interface TextAnalysisResponse {
  success: boolean;
  totalWordsCount: number;
  extractedWordsCount: number;
  words: WordItem[];
  error?: string;
}
