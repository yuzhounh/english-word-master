import type { LearningOperation } from './learningSync';
export interface LearningTransaction {
  get(path: string): Promise<Record<string, unknown> | null>;
  set(path: string, data: Record<string, unknown>): void;
  delete(path: string): void;
}

/** All mutations and the acknowledgement receipt are committed in one transaction. */
export async function writeLearningOperation(operation: LearningOperation, transaction: LearningTransaction) {
  const receipt = 'learningSyncReceipts/' + operation.id;
  if (await transaction.get(receipt)) return;
  const word = operation.word, id = (word.id || word.word).toLowerCase().trim();
  if (!id || id.includes('/')) throw Error('无效的单词标识');
  const wrong = 'wrongWords/' + id, mastered = 'masteredWords/' + id;
  const isWrong = operation.kind === 'wrong' || operation.kind === 'move-wrong';
  const previous = isWrong ? await transaction.get(wrong) : null;
  const details = {
    id, word: word.word, phonetic: word.phonetic || previous?.phonetic || '',
    chinese: word.chinese || previous?.chinese || '',
    exampleSentence: word.exampleSentence || previous?.exampleSentence || '',
    exampleSentenceCn: word.exampleSentenceCn || previous?.exampleSentenceCn || '',
  };
  if (isWrong) {
    const increment = Math.max(0, word.errorCount || 0);
    transaction.set(wrong, { ...previous, ...details,
      errorCount: Number(previous?.errorCount || 0) + increment,
      createdAt: previous?.createdAt || operation.createdAt,
      lastErrorAt: increment || !previous ? operation.createdAt : previous.lastErrorAt || operation.createdAt,
    });
    if (operation.kind === 'move-wrong') transaction.delete(mastered);
  } else if (operation.kind === 'mastered' || operation.kind === 'move-mastered') {
    transaction.set(mastered, { ...details, masteredAt: operation.createdAt });
    if (operation.kind === 'move-mastered') transaction.delete(wrong);
  } else if (operation.kind === 'delete-wrong') transaction.delete(wrong);
  else if (operation.kind === 'delete-mastered') transaction.delete(mastered);
  else throw Error('无效的学习同步操作');
  transaction.set(receipt, { createdAt: operation.createdAt, kind: operation.kind });
}
