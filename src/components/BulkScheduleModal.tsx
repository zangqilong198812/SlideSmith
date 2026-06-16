import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, CalendarClock, CheckCircle2, ExternalLink } from 'lucide-react';
import type { Slideshow, SocialAccount, ProjectDefaults } from '../types';
import { Button } from './Button';
import { renderSlideshow } from '../lib/render';
import { schedule as scheduleOne, getScheduledPosts } from '../lib/api';
import { useT } from '../i18n';

// post-bridge dashboard — where the user reviews what we just sent over.
const PB_SCHEDULED_URL = 'https://www.post-bridge.com/dashboard/posts/scheduled';
const PB_DRAFTS_URL = 'https://www.post-bridge.com/dashboard/posts/drafts';

interface BulkScheduleModalProps {
  slideshows: Slideshow[];
  accounts: SocialAccount[];
  defaults: ProjectDefaults;
  onClose: () => void;
  onDone: () => void;
}

const INTERVAL_PRESETS = [1, 3, 6, 12, 24];

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BulkScheduleModal({ slideshows, accounts, defaults, onClose, onDone }: BulkScheduleModalProps) {
  const t = useT();
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>(defaults.socialAccountIds);
  const [mode, setMode] = useState<'schedule' | 'draft'>(defaults.mode === 'draft' ? 'draft' : 'schedule');
  const [hours, setHours] = useState(6);
  const [startLocal, setStartLocal] = useState(() => toLocalInput(new Date(Date.now() + 6 * 3600_000)));
  const [lastScheduledMs, setLastScheduledMs] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [doneCount, setDoneCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default the start time to AFTER the last thing already scheduled in post-bridge.
  useEffect(() => {
    getScheduledPosts()
      .then((posts) => {
        const future = posts
          .map((p) => (p.scheduledAt ? new Date(p.scheduledAt).getTime() : 0))
          .filter((t) => t > Date.now());
        const last = future.length ? Math.max(...future) : null;
        setLastScheduledMs(last);
        const base = last ?? Date.now();
        setStartLocal(toLocalInput(new Date(base + 6 * 3600_000)));
      })
      .catch(() => {});
  }, []);

  const resetStartAfterLast = (h: number) => {
    const base = lastScheduledMs ?? Date.now();
    setStartLocal(toLocalInput(new Date(base + h * 3600_000)));
  };

  const toggleAccount = (id: number) =>
    setSelectedAccounts((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const lastFireLabel = useMemo(() => {
    const start = new Date(startLocal).getTime();
    if (Number.isNaN(start) || !slideshows.length) return null;
    return new Date(start + (slideshows.length - 1) * hours * 3600_000).toLocaleString();
  }, [startLocal, hours, slideshows.length]);

  const submit = async () => {
    setError(null);
    if (!selectedAccounts.length) return setError(t('Pick at least one account.', '至少选择一个账号。'));
    if (mode === 'schedule') {
      const start = new Date(startLocal).getTime();
      if (Number.isNaN(start)) return setError(t('Pick a valid start time.', '请选择有效的开始时间。'));
      if (start < Date.now() - 60_000) return setError(t('Start time is in the past.', '开始时间已经过去。'));
    }
    const startMs = new Date(startLocal).getTime();
    const stepMs = hours * 3600_000;
    setProgress({ done: 0, total: slideshows.length });

    // Process several slideshows at once instead of one-at-a-time — each is an
    // independent render + upload, so a small pool cuts wall-clock dramatically
    // for big batches. Each post keeps its own slot time (index i), so running
    // out of order doesn't change the schedule.
    // Each slideshow already fans out its slide uploads in parallel, so keep the
    // slideshow-level pool modest — too many at once overwhelms post-bridge's
    // upload endpoint and starts dropping slides.
    const CONCURRENCY = 3;
    let ok = 0;
    let done = 0;
    let next = 0;

    const worker = async () => {
      while (next < slideshows.length) {
        const i = next++;
        const show = slideshows[i];
        try {
          const slides = await renderSlideshow(show);
          const caption = `${show.caption}${show.hashtags.length ? ' ' + show.hashtags.map((t) => `#${t}`).join(' ') : ''}`;
          await scheduleOne({
            id: show.id,
            caption,
            slides,
            socialAccounts: selectedAccounts,
            scheduledAt: mode === 'schedule' ? new Date(startMs + i * stepMs).toISOString() : null,
            mode,
          });
          ok++;
        } catch (e) {
          console.error('[bulk] failed for', show.id, e);
        }
        setProgress({ done: ++done, total: slideshows.length });
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, slideshows.length) }, worker));
    setDoneCount(ok);
  };

  const busy = progress !== null && doneCount === null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={busy ? undefined : onClose}>
      <div className="bg-card border border-line rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="text-[15px] font-semibold text-ink">{t(`Schedule ${slideshows.length} slideshow${slideshows.length === 1 ? '' : 's'}`, `批量排程 ${slideshows.length} 条`)}</h2>
          {!busy && <button onClick={onClose} className="text-ink-5 hover:text-ink"><X size={18} /></button>}
        </div>

        {doneCount !== null ? (
          <div className="px-5 py-8 text-center space-y-2">
            <CheckCircle2 size={28} className="text-emerald-600 mx-auto" />
            <p className="text-[14px] font-medium text-ink">{t(`${doneCount} of ${slideshows.length} ${mode === 'schedule' ? 'scheduled' : 'saved as drafts'}`, `${slideshows.length} 条中已完成 ${doneCount} 条${mode === 'schedule' ? '排程' : '草稿'}`)}</p>
            <p className="text-[12px] text-ink-5">
              {mode === 'schedule' ? t('post-bridge will publish them at their times.', 'post-bridge 会按时间发布。') : t('Find them in your post-bridge drafts.', '可在 post-bridge 草稿中查看。')}
            </p>
            <a
              href={mode === 'schedule' ? PB_SCHEDULED_URL : PB_DRAFTS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 mt-2 rounded-lg bg-ink text-bg text-[13px] font-medium hover:opacity-90"
            >
              {t('View on post-bridge', '在 post-bridge 查看')} <ExternalLink size={13} />
            </a>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Accounts */}
            <div>
              <label className="text-[11px] text-ink-5 uppercase tracking-widest font-semibold mb-1.5 block">{t('Post to', '发布到')}</label>
              {accounts.length === 0 ? (
                <p className="text-[12px] text-ink-5">{t('No connected accounts. Add your post-bridge key and connect accounts in Settings.', '还没有连接账号。先在设置里添加 post-bridge Key 并连接账号。')}</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {accounts.map((a) => (
                    <label key={a.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-line cursor-pointer hover:border-line-2">
                      <input type="checkbox" checked={selectedAccounts.includes(a.id)} onChange={() => toggleAccount(a.id)} disabled={busy} />
                      <span className="text-[13px] text-ink font-medium">{a.username}</span>
                      <span className="text-[11px] text-ink-5 uppercase">{a.platform}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Mode */}
            <div>
              <label className="text-[11px] text-ink-5 uppercase tracking-widest font-semibold mb-1.5 block">{t('When', '发布时间')}</label>
              <div className="flex gap-2">
                <Button variant={mode === 'schedule' ? 'primary' : 'secondary'} onClick={() => setMode('schedule')} disabled={busy}>{t('Schedule', '排程')}</Button>
                <Button variant={mode === 'draft' ? 'primary' : 'secondary'} onClick={() => setMode('draft')} disabled={busy}>{t('Save all as drafts', '全部存草稿')}</Button>
              </div>
            </div>

            {mode === 'schedule' && (
              <div className="rounded-lg border border-line bg-surface p-3 space-y-3">
                <div>
                  <label className="text-[10px] text-ink-6 uppercase tracking-wider mb-1 block">{t('Start at', '开始时间')}</label>
                  <input
                    type="datetime-local"
                    value={startLocal}
                    onChange={(e) => setStartLocal(e.target.value)}
                    disabled={busy}
                    className="w-full h-9 bg-card border border-line rounded-lg px-3 text-[13px] text-ink outline-none focus:border-ink-7"
                  />
                  {lastScheduledMs && (
                    <p className="text-[11px] text-ink-6 mt-1">
                      {t(`Last scheduled post is ${new Date(lastScheduledMs).toLocaleString()} — defaulting to after it.`, `最后一条已排程时间是 ${new Date(lastScheduledMs).toLocaleString()}，默认接在它后面。`)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-ink-6 uppercase tracking-wider mb-1 block">{t('Space each one', '间隔')}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {INTERVAL_PRESETS.map((h) => (
                      <button
                        key={h}
                        onClick={() => { setHours(h); resetStartAfterLast(h); }}
                        disabled={busy}
                        className={`px-2.5 h-8 rounded-lg border text-[12px] font-medium transition-colors ${
                          hours === h ? 'border-ink bg-ink text-bg' : 'border-line bg-card text-ink-5 hover:border-line-2'
                        }`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>
                {lastFireLabel && (
                  <p className="text-[11px] text-ink-6 leading-snug">
                    {t(`${slideshows.length} posts, ${hours}h apart — last one fires`, `${slideshows.length} 条，每 ${hours} 小时一条，最后一条时间`)} <strong className="text-ink-3">{lastFireLabel}</strong>.
                  </p>
                )}
              </div>
            )}

            {error && <p className="text-[12px] text-red-600">{error}</p>}
            {progress && <p className="text-[12px] text-ink-5 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> {t(`Uploading ${progress.done} / ${progress.total}…`, `上传中 ${progress.done} / ${progress.total}…`)}</p>}
          </div>
        )}

        <div className="px-5 py-4 border-t border-line flex justify-end gap-2">
          {doneCount !== null ? (
            <Button variant="primary" onClick={onDone}>{t('Done', '完成')}</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose} disabled={busy}>{t('Cancel', '取消')}</Button>
              <Button
                variant="primary"
                icon={busy ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />}
                onClick={submit}
                disabled={busy}
              >
                {busy ? t('Scheduling…', '排程中…') : mode === 'schedule' ? t(`Schedule ${slideshows.length}`, `排程 ${slideshows.length} 条`) : t(`Draft ${slideshows.length}`, `草稿 ${slideshows.length} 条`)}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
