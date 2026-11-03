import React, { useEffect, useState } from 'react';
import { getPreferredVoice, getSpeechVoices, setPreferredVoice, speakEnglish, stopSpeech, type SpeechVoice } from '../lib/speech';
import { useI18n } from '../i18n';

export function SpeechVoiceSettings({ standalone = false }: { standalone?: boolean }) {
  const { t } = useI18n();
  const [voices, setVoices] = useState<SpeechVoice[]>([]);
  const [engine, setEngine] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(() => ({ 'en-US': getPreferredVoice('en-US'), 'en-GB': getPreferredVoice('en-GB') }));
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      setLoading(true);
      setNotice('');
      try {
        const result = await getSpeechVoices();
        if (disposed) return;
        setVoices([...new Map(result.voices.map(voice => [voice.id, voice])).values()]
          .sort((a, b) => a.language.localeCompare(b.language) || a.name.localeCompare(b.name)));
        setEngine(result.engine);
      } catch { if (!disposed) setNotice(t('暂时无法读取声音，请稍后刷新重试。')); }
      finally { if (!disposed) setLoading(false); }
    };
    void refresh();
    const synth = window.speechSynthesis;
    synth?.addEventListener('voiceschanged', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      disposed = true;
      synth?.removeEventListener('voiceschanged', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [revision]);

  const choose = (language: 'en-US' | 'en-GB', id: string) => {
    try {
      setPreferredVoice(language, id);
      setSelected(previous => ({ ...previous, [language]: id }));
      setNotice('');
      void stopSpeech();
    } catch { setNotice(t('声音选择未能保存，请检查设备可用空间。')); }
  };

  return <section aria-label={t('朗读声音')} className={standalone ? 'space-y-3' : 'space-y-3 border-t border-slate-200 px-3 py-4 dark:border-slate-700'}>
    {!standalone && (
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{t('朗读声音')}</h3>
        <button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)} className="min-h-10 min-w-10 text-sm text-brand-600 disabled:opacity-50 dark:text-brand-300 cursor-pointer">{t('刷新')}</button>
      </div>
    )}
    <div className="flex items-center justify-between gap-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
      <span>
        {engine && <>{engine} · </>}{loading ? t('正在读取可用声音…') : t('当前提供 {n} 个英语声音。', { n: voices.length })}
        {!loading && voices.length === 1 && t('此引擎仅提供一种英语声音。')}
        {!loading && voices.length === 0 && t('暂未列出英语声音，仍可尝试自动选择。')}
      </span>
      {standalone && (
        <button
          type="button"
          disabled={loading}
          onClick={() => setRevision(value => value + 1)}
          className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 dark:text-brand-400 cursor-pointer hover:underline py-0.5 px-1"
        >
          {t('刷新')}
        </button>
      )}
    </div>
    {(['en-US', 'en-GB'] as const).map(language => {
      const preferred = voices.filter(voice => [language.toLowerCase(), 'en'].includes(voice.language.toLowerCase()));
      const other = voices.filter(voice => !preferred.includes(voice));
      const missing = selected[language] && !voices.some(voice => voice.id === selected[language]);
      const option = (voice: SpeechVoice) => <option key={voice.id} value={voice.id}>{voice.name} · {voice.language}{voice.networkRequired ? t(' · 需联网') : ''}</option>;
      return <div key={language} className="space-y-2">
        <label className="block text-sm" htmlFor={`speech-voice-${language}`}>{language === 'en-US' ? t('美音模式声音') : t('英音模式声音')}</label>
        <div className="flex min-w-0 items-center gap-2">
          <select id={`speech-voice-${language}`} value={selected[language]} disabled={loading}
            onChange={event => choose(language, event.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
            <option value="">{t('自动选择')}</option>
            {missing && <option value={selected[language]}>{t('已选声音暂不可用（自动回退）')}</option>}
            {preferred.map(option)}
            {other.length > 0 && <optgroup label={t('其他英语口音')}>{other.map(option)}</optgroup>}
          </select>
          <button type="button" disabled={loading} onClick={() => {
            setNotice('');
            void speakEnglish(['Hello! Welcome to Word Master.'], { language, onError: () => setNotice(t('试听失败，请尝试其他声音或检查系统语音设置。')) });
          }} className="min-h-11 shrink-0 rounded-lg bg-slate-100 px-3 text-sm dark:bg-slate-700">{t('试听')}</button>
        </div>
      </div>;
    })}
    <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('声音由当前设备和语音引擎提供，选择仅保存在本机。实际口音以所选声音为准；通用英语声音可能不区分英音和美音。')}</p>
    {notice && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">{notice}</p>}
  </section>;
}
