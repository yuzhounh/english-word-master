export type LearningKind = 'wrong' | 'mastered' | 'delete-wrong' | 'delete-mastered' | 'move-wrong' | 'move-mastered';
export interface LearningWord {
  id?: string; word: string; phonetic?: string; chinese?: string;
  exampleSentence?: string; exampleSentenceCn?: string; errorCount?: number;
}
export interface LearningOperation { id: string; kind: LearningKind; word: LearningWord; createdAt: number }
export interface LearningSyncState { pending: number; busy: boolean; error: string | null; durable: boolean }
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

/** An account-scoped, durable queue; retry is driven by login, connectivity or the user. */
export class LearningSync {
  private uid: string | null = null;
  private generation = 0;
  private queues = new Map<string, LearningOperation[]>();
  private running = new Map<string, Promise<void>>();
  private confirmed = new Map<string, Map<string, LearningKind>>();
  private listeners = new Set<(state: LearningSyncState) => void>();
  private error: string | null = null;
  private durable = true;
  constructor(private storage: Storage, private apply: (uid: string, operation: LearningOperation) => Promise<void>) {}
  private queue(uid: string) {
    if (!this.queues.has(uid)) {
      const value = JSON.parse(this.storage.getItem('wordmaster_learning_pending_v1:' + uid) || '[]');
      if (!Array.isArray(value)) throw Error('待同步记录读取失败');
      this.queues.set(uid, value);
    }
    return this.queues.get(uid)!;
  }
  private persist(uid: string) {
    this.storage.setItem('wordmaster_learning_pending_v1:' + uid, JSON.stringify(this.queue(uid)));
    if (uid === this.uid) this.durable = true;
  }
  getState(): LearningSyncState {
    let pending = 0;
    try { if (this.uid) pending = this.queue(this.uid).length; } catch { /* Preserve the invalid stored value. */ }
    return { pending, busy: !!this.uid && this.running.has(this.uid), error: this.error, durable: this.durable };
  }
  private emit() { const state = this.getState(); for (const listener of this.listeners) listener(state); }
  subscribe(listener: (state: LearningSyncState) => void) {
    this.listeners.add(listener); listener(this.getState());
    return () => { this.listeners.delete(listener); };
  }
  reportReadError() { this.error = '云端读取失败，本机学习记录仍保留，请重试。'; this.emit(); }
  getConfirmedChanges() { return new Map(this.uid ? this.confirmed.get(this.uid) : undefined); }
  clearConfirmedChanges() { if (this.uid) this.confirmed.delete(this.uid); }
  setUser(uid: string | null) {
    if (uid === this.uid) return;
    this.uid = uid; this.generation++; this.error = null; this.durable = true;
    this.emit();
    if (uid) void this.flush().catch(() => {});
  }
  async enqueue(uid: string, kind: LearningKind, word: LearningWord) {
    if (!uid || uid !== this.uid) throw Error('登录账户已经改变');
    this.queue(uid).push({ id: crypto.randomUUID(), kind, word: structuredClone(word), createdAt: Date.now() });
    try { this.persist(uid); }
    catch (error) {
      this.durable = false; this.error = '待同步操作暂留在当前页面，请保持页面打开后重试。'; this.emit(); throw error;
    }
    this.emit();
    return this.flush();
  }
  async flush(): Promise<void> {
    const uid = this.uid, generation = this.generation;
    if (!uid) return;
    const previous = this.running.get(uid);
    if (previous) {
      await previous;
      if (uid === this.uid && generation === this.generation && this.queue(uid).length) return this.flush();
      return;
    }
    const current = () => uid === this.uid && generation === this.generation;
    const job = Promise.resolve().then(async () => {
      try {
        this.persist(uid);
        while (current() && this.queue(uid).length) {
          const operation = this.queue(uid)[0];
          await this.apply(uid, operation);
          if (!current()) return;
          if (!this.confirmed.has(uid)) this.confirmed.set(uid, new Map());
          this.confirmed.get(uid)!.set((operation.word.id || operation.word.word).toLowerCase().trim(), operation.kind);
          this.queue(uid).shift();
          try { this.persist(uid); }
          catch (error) { this.queue(uid).unshift(operation); this.durable = false; throw error; }
          this.emit();
        }
        if (current()) this.error = null;
      } catch (error) {
        if (current()) this.error = this.durable ? '云端同步失败，学习记录保留在本机，可重试。' : '待同步操作暂留在当前页面，请保持页面打开后重试。';
        throw error;
      } finally { this.running.delete(uid); if (current()) this.emit(); }
    });
    this.running.set(uid, job); this.emit();
    return job;
  }
}
