import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, CalendarClock, CheckCircle2, ExternalLink } from 'lucide-react';
import type { Slideshow, SocialAccount, ProjectDefaults, PostizIntegration } from '../types';
import { Button } from './Button';
import { renderSlideshow } from '../lib/render';
import { schedule as scheduleOne, getScheduledPosts, publishToPostiz } from '../lib/api';
import { useT } from '../i18n';

// post-bridge dashboard — where the user reviews what we just sent over.
const PB_SCHEDULED_URL = 'https://www.post-bridge.com/dashboard/posts/scheduled';
const PB_DRAFTS_URL = 'https://www.post-bridge.com/dashboard/posts/drafts';

interface BulkScheduleModalProps {
  slideshows: Slideshow[];
  accounts: SocialAccount[];
  postizIntegrations: PostizIntegration[];
  defaults: ProjectDefaults;
  onClose: () => void;
  onDone: () => void;
}

const INTERVAL_PRESETS = [1, 3, 6, 12, 24];

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BulkScheduleModal({ slideshows, accounts, postizIntegrations, defaults, onClose, onDone }: BulkScheduleModalProps) {
  const t = useT();
  const availablePostizIntegrations = postizIntegrations.filter((integration) => !integration.disabled);
  const [publisher, setPublisher] = useState<'postiz' | 'postbridge'>(defaults.postizIntegrationId ? 'postiz' : 'postbridge');
  const [postizIntegrationId, setPostizIntegrationId] = useState(defaults.postizIntegrationId || availablePostizIntegrations[0]?.id || '');
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>(defaults.socialAccountIds);
  const [mode, setMode] = useState<'schedule' | 'draft'>(defaults.mode === 'draft' ? 'draft' : 'schedule');
  const [hours, setHours] = useState(6);
  const [startLocal, setStartLocal] = useState(() => toLocalInput(new Date(Date.now() + 6 * 3600_000)));
  const [lastScheduledMs, setLastScheduledMs] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [doneCount, setDoneCount] = useState<number | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
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

  useEffect(() => {
    if (!postizIntegrationId && availablePostizIntegrations[0]?.id) setPostizIntegrationId(availablePostizIntegrations[0].id);
  }, [postizIntegrationId, availablePostizIntegrations]);

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
    if (publisher === 'postiz' && !postizIntegrationId) return setError(t('Pick a Postiz integration in Settings first.', '请先在设置里选择 Postiz integration。'));
    if (publisher === 'postbridge' && !selectedAccounts.length) return setError(t('Pick at least one account.', '至少选择一个账号。'));
    if (publisher === 'postiz' || (publisher === 'postbridge' && mode === 'schedule')) {
      const start = new Date(startLocal).getTime();
      if (Number.isNaN(start)) return setError(t('Pick a valid start time.', '请选择有效的开始时间。'));
      if (start < Date.now() - 60_000) return setError(t('Start time is in the past.', '开始时间已经过去。'));
    }
    const startMs = new Date(startLocal).getTime();
    const stepMs = hours * 3600_000;
    setProgress({ done: 0, total: slideshows.length });
    setFailures([]);

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
    const failed: string[] = [];

    const worker = async () => {
      while (next < slideshows.length) {
        const i = next++;
        const show = slideshows[i];
        try {
          const slides = await renderSlideshow(show);
          const caption = `${show.caption}${show.hashtags.length ? ' ' + show.hashtags.map((t) => `#${t}`).join(' ') : ''}`;
          if (publisher === 'postiz') {
            await publishToPostiz({
              id: show.id,
              title: show.hook,
              caption,
              slides,
              integrationId: postizIntegrationId,
              scheduledAt: new Date(startMs + i * stepMs).toISOString(),
            });
          } else {
            await scheduleOne({
              id: show.id,
              caption,
              slides,
              socialAccounts: selectedAccounts,
              scheduledAt: mode === 'schedule' ? new Date(startMs + i * stepMs).toISOString() : null,
              mode,
            });
          }
          ok++;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          failed.push(`${show.hook || show.id}: ${message}`);
          console.error('[bulk] failed for', show.id, e);
        }
        setProgress({ done: ++done, total: slideshows.length });
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, slideshows.length) }, worker));
    setFailures(failed);
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
            <p className="text-[14px] font-medium text-ink">
              {publisher === 'postiz'
                ? t(`${doneCount} of ${slideshows.length} sent to Postiz`, `${slideshows.length} 条中已发送 ${doneCount} 条到 Postiz`)
                : t(`${doneCount} of ${slideshows.length} ${mode === 'schedule' ? 'scheduled' : 'saved as drafts'}`, `${slideshows.length} 条中已完成 ${doneCount} 条${mode === 'schedule' ? '排程' : '草稿'}`)}
            </p>
            <p className="text-[12px] text-ink-5">
              {publisher === 'postiz' && doneCount === 0
                ? t('Nothing reached Postiz. Check the failure details below.', '没有任何内容成功到达 Postiz。请看下面的失败原因。')
                : publisher === 'postiz'
                ? t('They were scheduled in Postiz. TikTok items still use inbox upload; simpler platforms publish through Postiz.', '已排程到 Postiz。TikTok 仍走 inbox upload；简单平台由 Postiz 发布。')
                : mode === 'schedule' ? t('post-bridge will publish them at their times.', 'post-bridge 会按时间发布。') : t('Find them in your post-bridge drafts.', '可在 post-bridge 草稿中查看。')}
            </p>
            {failures.length > 0 && (
              <div className="mt-3 text-left rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-[12px] font-medium text-red-700">{t('Failed items', '失败原因')}</p>
                <ul className="mt-1 space-y-1">
                  {failures.slice(0, 4).map((failure, index) => (
                    <li key={index} className="text-[11px] text-red-700 leading-snug break-words">{failure}</li>
                  ))}
                </ul>
                {failures.length > 4 && <p className="text-[11px] text-red-600 mt-1">{t(`+${failures.length - 4} more`, `还有 ${failures.length - 4} 条`)}</p>}
              </div>
            )}
            {doneCount > 0 && (
              <a
                href={publisher === 'postiz' ? 'https://www.tiktok.com/messages?lang=en' : mode === 'schedule' ? PB_SCHEDULED_URL : PB_DRAFTS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 mt-2 rounded-lg bg-ink text-bg text-[13px] font-medium hover:opacity-90"
              >
                {publisher === 'postiz' ? t('Open TikTok inbox', '打开 TikTok inbox') : t('View on post-bridge', '在 post-bridge 查看')} <ExternalLink size={13} />
              </a>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div>
              <label className="text-[11px] text-ink-5 uppercase tracking-widest font-semibold mb-1.5 block">{t('Publisher', '发布通道')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPublisher('postiz')}
                  disabled={busy}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors disabled:opacity-50 ${
                    publisher === 'postiz' ? 'border-ink bg-ink text-bg' : 'border-line bg-card text-ink hover:border-line-2'
                  }`}
                >
                  <span className="block text-[13px] font-semibold">Postiz</span>
                  <span className={`block text-[11px] mt-0.5 ${publisher === 'postiz' ? 'text-bg/70' : 'text-ink-6'}`}>{t('Postiz schedule', 'Postiz 排程')}</span>
                </button>
                <button
                  onClick={() => setPublisher('postbridge')}
                  disabled={busy}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors disabled:opacity-50 ${
                    publisher === 'postbridge' ? 'border-ink bg-ink text-bg' : 'border-line bg-card text-ink hover:border-line-2'
                  }`}
                >
                  <span className="block text-[13px] font-semibold">Postbridge</span>
                  <span className={`block text-[11px] mt-0.5 ${publisher === 'postbridge' ? 'text-bg/70' : 'text-ink-6'}`}>{t('Draft or schedule', '草稿或排程')}</span>
                </button>
              </div>
            </div>

            {publisher === 'postiz' && (
              <div>
                <label className="text-[11px] text-ink-5 uppercase tracking-widest font-semibold mb-1.5 block">{t('Postiz integration', 'Postiz integration')}</label>
                {availablePostizIntegrations.length === 0 ? (
                  <p className="text-[12px] text-ink-5">{t('No integration loaded from Postiz. Add your Postiz key in Settings and connect a channel inside Postiz.', '没有从 Postiz 加载到 integration。请在设置里添加 Postiz Key，并在 Postiz 里连接平台。')}</p>
                ) : (
                  <select
                    value={postizIntegrationId}
                    onChange={(e) => setPostizIntegrationId(e.target.value)}
                    disabled={busy}
                    className="w-full h-9 bg-card border border-line rounded-lg px-3 text-[13px] text-ink outline-none focus:border-ink-7"
                  >
                    <option value="">{t('Select Postiz channel', '选择 Postiz 平台')}</option>
                    {availablePostizIntegrations.map((integration) => (
                      <option key={integration.id} value={integration.id}>{integration.providerIdentifier || 'unknown'} · {integration.name || integration.profile || integration.id}</option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-ink-6 mt-1">{t('Each selected slideshow will be scheduled in Postiz. TikTok uses inbox upload; simpler platforms like Threads publish through Postiz.', '每条选中的轮播都会排程到 Postiz。TikTok 走 inbox upload；Threads 这类简单平台由 Postiz 发布。')}</p>
              </div>
            )}

            {/* Accounts */}
            {publisher === 'postbridge' && <div>
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
            </div>}

            {/* Mode */}
            {publisher === 'postbridge' && <div>
              <label className="text-[11px] text-ink-5 uppercase tracking-widest font-semibold mb-1.5 block">{t('When', '发布时间')}</label>
              <div className="flex gap-2">
                <Button variant={mode === 'schedule' ? 'primary' : 'secondary'} onClick={() => setMode('schedule')} disabled={busy}>{t('Schedule', '排程')}</Button>
                <Button variant={mode === 'draft' ? 'primary' : 'secondary'} onClick={() => setMode('draft')} disabled={busy}>{t('Save all as drafts', '全部存草稿')}</Button>
              </div>
            </div>}

            {(publisher === 'postiz' || (publisher === 'postbridge' && mode === 'schedule')) && (
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
                {busy ? t('Uploading…', '上传中…') : publisher === 'postiz' ? t(`Schedule ${slideshows.length} to Postiz`, `排程 ${slideshows.length} 条到 Postiz`) : mode === 'schedule' ? t(`Schedule ${slideshows.length}`, `排程 ${slideshows.length} 条`) : t(`Draft ${slideshows.length}`, `草稿 ${slideshows.length} 条`)}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
