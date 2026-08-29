import { Capacitor, registerPlugin } from '@capacitor/core';
interface NativeSpeechPlugin {
  speak(options: { text: string; language: string; rate: number; pitch: number }): Promise<void>;
  stop(): Promise<void>;
}

interface SpeakOptions {
  language?: string;
  delayMs?: number;
  onTextStart?: (text: string) => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
}

const NativeSpeech = registerPlugin<NativeSpeechPlugin>('NativeSpeech');
let activeRequest = 0;

const isAndroidNative = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

async function stopBackend(): Promise<void> {
  if (isAndroidNative()) {
    try {
      await NativeSpeech.stop();
    } catch {
      // The native engine may not be initialized yet.
    }
    return;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function speakInBrowser(text: string, language: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('This browser does not support speech synthesis.'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 0.9;

    const normalizedLanguage = language.toLowerCase();
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((candidate) =>
      candidate.lang.toLowerCase().replace('_', '-') === normalizedLanguage,
    ) || voices.find((candidate) => candidate.lang.toLowerCase().startsWith('en'));

    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(event.error || 'Speech synthesis failed.'));
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Speaks one or more English passages in order. A newer request automatically
 * cancels an older one so navigation cannot leave stale audio playing.
 */
export async function speakEnglish(texts: Array<string | undefined>, options: SpeakOptions = {}): Promise<void> {
  const requestId = ++activeRequest;
  const language = options.language || 'en-US';
  const passages = texts.map((text) => text?.trim()).filter((text): text is string => Boolean(text));

  if (passages.length === 0) return;

  try {
    await stopBackend();
    if (options.delayMs) await wait(options.delayMs);
    if (requestId !== activeRequest) return;

    for (const text of passages) {
      if (requestId !== activeRequest) return;
      options.onTextStart?.(text);

      if (isAndroidNative()) {
        await NativeSpeech.speak({ text, language, rate: 0.9, pitch: 1 });
      } else {
        await speakInBrowser(text, language);
      }
    }

    if (requestId === activeRequest) options.onEnd?.();
  } catch (error) {
    // Interruption by a newer request is expected and should not flash an error.
    if (requestId === activeRequest) options.onError?.(error);
  }
}

export async function stopSpeech(): Promise<void> {
  activeRequest += 1;
  await stopBackend();
}
