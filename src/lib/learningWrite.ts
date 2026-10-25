import type { LearningOperation } from './learningSync';
export interface LearningTransaction {
  get(path: string): Promise<Record<string, unknown> | null>;
  set(path: string, data: Record<string, unknown>): void;
  delete(path: string): void;
}

const wordId = (operation: LearningOperation) => (operation.word.id || operation.word.word).toLowerCase().trim();
const isWrong = (operation: LearningOperation) => operation.kind === 'wrong' || operation.kind === 'move-wrong';

async function writeMutation(operation: LearningOperation, transaction: LearningTransaction) {
  const word = operation.word, id = wordId(operation);
  if (!id || id.includes('/')) throw Error('无效的单词标识');
  const wrong = 'wrongWords/' + id, mastered = 'masteredWords/' + id;
  const previous = isWrong(operation) ? await transaction.get(wrong) : null;
  const details = {
    id, word: word.word, phonetic: word.phonetic || previous?.phonetic || '',
    chinese: word.chinese || previous?.chinese || '',
    exampleSentence: word.exampleSentence || previous?.exampleSentence || '',
    exampleSentenceCn: word.exampleSentenceCn || previous?.exampleSentenceCn || '',
  };
  if (isWrong(operation)) {
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
}

/**
 * The leading queued operations and one receipt, named after the first of them, are committed in one
 * transaction. Returns how many leading operations are committed; a receipt found on retry reports a
 * batch whose acknowledgement was lost, and one without a count is a former single-operation receipt.
 */
export async function writeLearningOperations(operations: LearningOperation[], transaction: LearningTransaction) {
  if (!operations.length) return 0;
  const receipt = 'learningSyncReceipts/' + operations[0].id;
  // Firestore needs every read before the first write: read the receipt and all words in parallel.
  const words = operations.filter(isWrong).map(wordId).filter(id => id && !id.includes('/'));
  const paths = [receipt, ...new Set(words.map(id => 'wrongWords/' + id))];
  const documents = new Map(await Promise.all(paths.map(async path => [path, await transaction.get(path)] as const)));
  const committed = documents.get(receipt);
  if (committed) return Math.min(operations.length, Number(committed.count) || 1);
  // Later operations on the same word see earlier staged changes, exactly as one transaction each would.
  const writes = new Map<string, Record<string, unknown> | null>();
  const staged: LearningTransaction = {
    get: async path => {
      if (!documents.has(path)) documents.set(path, await transaction.get(path));
      return documents.get(path)!;
    },
    set: (path, data) => { documents.set(path, data); writes.set(path, data); },
    delete: path => { documents.set(path, null); writes.set(path, null); },
  };
  for (const operation of operations) await writeMutation(operation, staged);
  for (const [path, data] of writes) {
    if (data) transaction.set(path, data); else transaction.delete(path);
  }
  transaction.set(receipt, { createdAt: operations[0].createdAt, kind: 'batch', count: operations.length });
  return operations.length;
}
