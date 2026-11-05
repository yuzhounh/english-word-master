import React from 'react';
import {
  Award, Bookmark, Clock, FileText, Globe, Library, ListChecks, LogIn, LogOut, Moon, Plus, RefreshCw,
  Settings, Sun, TriangleAlert, UserRound, Volume2, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLongPress } from '../../hooks/useLongPress';
import { UserProfile, SpeechAccent } from '../../types';
import { DefaultBookBadge, StartupSettings } from '../NotebookPreferences';
import { useCurrentBookQuiz } from './chrome';
import { useI18n } from '../../i18n';

export interface MenuList { id: string; name: string; count: number }

interface MobileMenuProps {
  activeKey: string;
  counts: { library: number; wrong: number; highError: number; recent: number; mastered: number; masteredRecent: number };
  lists: MenuList[];
  onClose: () => void;
  onOpenView: (key: string) => void;
  /** Opens the import / export / test / delete menu of a notebook after switching to it. */
  onManage: (key: string) => void;
  onCreateList: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  speechAccent: SpeechAccent;
  onToggleSpeechAccent: () => void;
  user: UserProfile | null;
  onLogin: () => void;
  onLogout: () => void;
  sync: { text: string | null; busy: boolean; onRetry: () => void };
  version: string;
}

const Ico: React.FC<{ icon: LucideIcon }> = ({ icon: Icon }) => <Icon width={22} height={22} strokeWidth={1.8} aria-hidden />;

const NavRow: React.FC<{
  icon: LucideIcon; label: string; detail?: string | number; active?: boolean;
  onClick: () => void; onLongPress?: () => void; trailing?: React.ReactNode; busy?: boolean; bookKey?: string;
}> = ({ icon, label, detail, active, onClick, onLongPress, trailing, busy, bookKey }) => {
  const press = useLongPress(() => onLongPress?.(), !!onLongPress);
  return (
    <div className="m-nav-line">
      <button type="button" className={`m-nav-row${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}
        disabled={busy} onClick={onClick} {...press}>
        <Ico icon={icon} />
        <span className="m-nav-label flex items-center gap-2"><span className="min-w-0 truncate" title={label}>{label}</span>{bookKey && <DefaultBookBadge bookKey={bookKey} />}</span>
        {detail !== undefined && detail !== 0 && <span className="m-nav-detail">{detail}</span>}
      </button>
      {trailing}
    </div>
  );
};

const Gear: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button type="button" className="m-icon-btn m-gear" aria-label={label} onClick={onClick}>
    <Settings width={20} height={20} strokeWidth={1.8} />
  </button>
);

const GroupHeader: React.FC<{ icon: LucideIcon; label: string; detail?: string; sub?: string; gear?: { label: string; onClick: () => void } }> = (
  { icon, label, detail, sub, gear },
) => (
  <div className="m-group-head">
    <div className="m-group-icon"><Ico icon={icon} /></div>
    <div className="m-group-text">
      <div className="m-group-title">{label}{detail ? <span className="m-nav-detail">{detail}</span> : null}</div>
      {sub && <div className="m-group-sub">{sub}</div>}
    </div>
    {gear && <Gear label={gear.label} onClick={gear.onClick} />}
  </div>
);

/** Full-screen page holding every view and the few global settings (design system section 3). */
export const MobileMenu: React.FC<MobileMenuProps> = ({
  activeKey, counts, lists, onClose, onOpenView, onManage, onCreateList, isDark, onToggleTheme,
  speechAccent, onToggleSpeechAccent, user, onLogin, onLogout, sync, version,
}) => {
  const signedIn = !!user && !user.isGuest;
  const currentQuiz = useCurrentBookQuiz();
  const { t, lang, setLang } = useI18n();
  const testCurrentBook = () => {
    if (!currentQuiz) { onOpenView('quiz'); return; }
    if (currentQuiz.disabled) return;
    onClose();
    currentQuiz.onClick();
  };
  const open = (key: string) => () => onOpenView(key);
  const manage = (key: string) => () => onManage(key);
  return (
    <div className="m-page" role="dialog" aria-modal="true" aria-label={t('词库与设置')}>
      <div className="m-page-bar">
        <h2 className="m-title">{t('词库与设置')}</h2>
        <button type="button" className="m-icon-btn" aria-label={t('关闭菜单')} onClick={onClose}>
          <X width={24} height={24} strokeWidth={1.8} />
        </button>
      </div>
      <div className="m-page-body">
        <section className="m-section">
          <NavRow icon={ListChecks} label={t('单词测试')} active={activeKey === 'quiz'} busy={currentQuiz?.disabled} onClick={testCurrentBook} />
          <NavRow icon={Library} label={t('官方词库')} detail={counts.library ? t('{n} 本', { n: counts.library }) : undefined}
            active={activeKey === 'library'} onClick={open('library')} />
        </section>

        <section className="m-section">
          <GroupHeader icon={Bookmark} label={t('生词本')} detail={String(counts.wrong)} gear={{ label: t('生词本管理'), onClick: manage('wrong:all') }} />
          <NavRow bookKey="wrong:all" icon={Bookmark} label={t('全量生词')} detail={counts.wrong} active={activeKey === 'wrong:all'}
            onClick={open('wrong:all')} onLongPress={manage('wrong:all')} />
          <NavRow bookKey="wrong:high_error" icon={TriangleAlert} label={t('顽固难词')} detail={counts.highError} active={activeKey === 'wrong:high_error'}
            onClick={open('wrong:high_error')} onLongPress={manage('wrong:high_error')} />
          <NavRow bookKey="wrong:recent" icon={Clock} label={t('近期新增')} detail={counts.recent} active={activeKey === 'wrong:recent'}
            onClick={open('wrong:recent')} onLongPress={manage('wrong:recent')} />
        </section>

        <section className="m-section">
          <GroupHeader icon={Award} label={t('熟词本')} detail={String(counts.mastered)} gear={{ label: t('熟词本管理'), onClick: manage('mastered:all') }} />
          <NavRow bookKey="mastered:all" icon={Award} label={t('全量熟词')} detail={counts.mastered} active={activeKey === 'mastered:all'}
            onClick={open('mastered:all')} onLongPress={manage('mastered:all')} />
          <NavRow bookKey="mastered:recent" icon={Clock} label={t('近期掌握')} detail={counts.masteredRecent} active={activeKey === 'mastered:recent'}
            onClick={open('mastered:recent')} onLongPress={manage('mastered:recent')} />
        </section>

        <section className="m-section">
          <GroupHeader icon={FileText} label={t('词本')} detail={String(lists.length)} />
          {lists.map(list => (
            <NavRow key={list.id} bookKey={`wrong:custom:${list.id}`} icon={FileText} label={list.name} detail={list.count}
              active={activeKey === `wrong:custom:${list.id}`} onClick={open(`wrong:custom:${list.id}`)}
              onLongPress={manage(`wrong:custom:${list.id}`)}
              trailing={<Gear label={t('{name}管理', { name: list.name })} onClick={manage(`wrong:custom:${list.id}`)} />} />
          ))}
          <NavRow icon={Plus} label={t('新建词本')} onClick={onCreateList} />
        </section>

        <section className="m-section">
          {sync.text && <NavRow icon={RefreshCw} label={sync.text} busy={sync.busy} onClick={sync.onRetry} />}
          <NavRow icon={isDark ? Moon : Sun} label={t('外观主题')} detail={isDark ? t('深色') : t('浅色')} onClick={onToggleTheme} />
          <NavRow icon={Globe} label={t('界面语言')} detail={lang === 'zh' ? '简体中文' : 'English'}
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} />
          <NavRow icon={Volume2} label={t('朗读发音')} detail={speechAccent === 'en-US' ? t('美音') : t('英音')} onClick={onToggleSpeechAccent} />
          {signedIn ? (
            <div className="m-account-line">
              <Ico icon={UserRound} />
              <span className="m-account-name">{user?.displayName || user?.email || t('已登录')}</span>
              {user?.displayName && user?.email && <span className="m-account-mail">{user.email}</span>}
              <button type="button" className="m-icon-btn m-gear" aria-label={t('退出登录')} onClick={onLogout}><LogOut width={20} height={20} strokeWidth={1.8} /></button>
            </div>
          ) : (
            <NavRow icon={LogIn} label={t('登录 Google 账号')} onClick={onLogin} />
          )}
        </section>

        <section className="m-section"><StartupSettings /></section>
        <footer className="m-page-footer">
          <img src="/logo.svg" alt="" width={40} height={40} />
          <div>WordMaster {version}</div>
        </footer>
      </div>
    </div>
  );
};
