import React from 'react';
import {
  Award, Bookmark, Clock, FileText, Library, ListChecks, LogIn, LogOut, Moon, Plus, RefreshCw,
  Settings, Sun, TriangleAlert, UserRound, Volume2, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLongPress } from '../../hooks/useLongPress';
import { UserProfile, SpeechAccent } from '../../types';

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
  onClick: () => void; onLongPress?: () => void; trailing?: React.ReactNode; busy?: boolean;
}> = ({ icon, label, detail, active, onClick, onLongPress, trailing, busy }) => {
  const press = useLongPress(() => onLongPress?.(), !!onLongPress);
  return (
    <div className="m-nav-line">
      <button type="button" className={`m-nav-row${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}
        disabled={busy} onClick={onClick} {...press}>
        <Ico icon={icon} />
        <span className="m-nav-label">{label}</span>
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
  const open = (key: string) => () => onOpenView(key);
  const manage = (key: string) => () => onManage(key);
  return (
    <div className="m-page" role="dialog" aria-modal="true" aria-label="词库与设置">
      <div className="m-page-bar">
        <h2 className="m-title">词库与设置</h2>
        <button type="button" className="m-icon-btn" aria-label="关闭菜单" onClick={onClose}>
          <X width={24} height={24} strokeWidth={1.8} />
        </button>
      </div>
      <div className="m-page-body">
        <section className="m-section">
          <NavRow icon={ListChecks} label="单词测试" active={activeKey === 'quiz'} onClick={open('quiz')} />
          <NavRow icon={Library} label="官方词库" detail={counts.library ? `${counts.library} 本` : undefined}
            active={activeKey === 'library'} onClick={open('library')} />
        </section>

        <section className="m-section">
          <GroupHeader icon={Bookmark} label="生词本" detail={String(counts.wrong)} gear={{ label: '生词本管理', onClick: manage('wrong:all') }} />
          <NavRow icon={Bookmark} label="全量生词" detail={counts.wrong} active={activeKey === 'wrong:all'}
            onClick={open('wrong:all')} onLongPress={manage('wrong:all')} />
          <NavRow icon={TriangleAlert} label="顽固难词" detail={counts.highError} active={activeKey === 'wrong:high_error'}
            onClick={open('wrong:high_error')} onLongPress={manage('wrong:high_error')} />
          <NavRow icon={Clock} label="近期新增" detail={counts.recent} active={activeKey === 'wrong:recent'}
            onClick={open('wrong:recent')} onLongPress={manage('wrong:recent')} />
        </section>

        <section className="m-section">
          <GroupHeader icon={Award} label="熟词本" detail={String(counts.mastered)} gear={{ label: '熟词本管理', onClick: manage('mastered:all') }} />
          <NavRow icon={Award} label="全量熟词" detail={counts.mastered} active={activeKey === 'mastered:all'}
            onClick={open('mastered:all')} onLongPress={manage('mastered:all')} />
          <NavRow icon={Clock} label="近期掌握" detail={counts.masteredRecent} active={activeKey === 'mastered:recent'}
            onClick={open('mastered:recent')} onLongPress={manage('mastered:recent')} />
        </section>

        <section className="m-section">
          <GroupHeader icon={FileText} label="词本" detail={String(lists.length)} />
          {lists.map(list => (
            <NavRow key={list.id} icon={FileText} label={list.name} detail={list.count}
              active={activeKey === `wrong:custom:${list.id}`} onClick={open(`wrong:custom:${list.id}`)}
              onLongPress={manage(`wrong:custom:${list.id}`)}
              trailing={<Gear label={`${list.name}管理`} onClick={manage(`wrong:custom:${list.id}`)} />} />
          ))}
          <NavRow icon={Plus} label="新建词本" onClick={onCreateList} />
        </section>

        <section className="m-section">
          {sync.text && <NavRow icon={RefreshCw} label={sync.text} busy={sync.busy} onClick={sync.onRetry} />}
          <NavRow icon={isDark ? Moon : Sun} label="外观主题" detail={isDark ? '深色' : '浅色'} onClick={onToggleTheme} />
          <NavRow icon={Volume2} label="朗读发音" detail={speechAccent === 'en-US' ? '美音' : '英音'} onClick={onToggleSpeechAccent} />
          {signedIn ? (
            <div className="m-account-line">
              <Ico icon={UserRound} />
              <span className="m-account-name">{user?.displayName || user?.email || '已登录'}</span>
              {user?.displayName && user?.email && <span className="m-account-mail">{user.email}</span>}
              <button type="button" className="m-icon-btn m-gear" aria-label="退出登录" onClick={onLogout}><LogOut width={20} height={20} strokeWidth={1.8} /></button>
            </div>
          ) : (
            <NavRow icon={LogIn} label="登录 Google 账号" onClick={onLogin} />
          )}
        </section>

        <footer className="m-page-footer">
          <img src="/logo.svg" alt="" width={40} height={40} />
          <div>WordMaster {version}</div>
        </footer>
      </div>
    </div>
  );
};
