export type AppTab = 'quiz' | 'library' | 'notebook';
export type NotebookSubTab = 'wrong' | 'mastered';
/** One-shot request from the phone menu to the notebook that is (about to be) on screen. */
export interface NotebookCommand { id: number; type: 'menu' | 'create'; target?: string }
