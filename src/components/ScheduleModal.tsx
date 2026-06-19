import { useEffect, useState } from 'react';
import { X, Loader2, CalendarClock, Info, CheckCircle2, ExternalLink } from 'lucide-react';
import type { Slideshow, SocialAccount, PostizIntegration } from '../types';
import { getScheduledPosts } from '../lib/api';
import { Button } from './Button';
import { SlidePreview } from './SlidePreview';
import { SlideLightbox } from './Lightbox';
import { useT } from '../i18n';

// Default gap after the last thing already scheduled (or after now, if nothing
// is queued) so the user isn't forced to pick a time from a blank field.
const DEFAULT_GAP_HOURS = 3;

// post-bridge dashboard — where the user reviews what we just sent over.
const PB_SCHEDULED_URL = 'https://www.post-bridge.com/dashboard/posts/scheduled';
const PB_DRAFTS_URL = 'https://www.post-bridge.com/dashboard/posts/drafts';

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ScheduleModalProps {
  slideshow: Slideshow;
  accounts: SocialAccount[];
  postizIntegrations: PostizIntegration[];
  defaults: { socialAccountIds: number[]; mode: 'draft' | 'schedule'; postizIntegrationId?: string };
  onClose: () => void;
  onConfirm: (opts: {
    publisher: 'postbridge' | 'postiz';
    socialAccounts: number[];
    postizIntegrationId?: string;
    mode: 'draft' | 'schedule';
    scheduledAt: string | null;
  }) => Promise<void>;
}

export function ScheduleModal({ slideshow, accounts, postizIntegrations, defaults, onClose, onConfirm }: ScheduleModalProps) {
  const t = useT();
  const tiktokIntegrations = postizIntegrations.filter((integration) => integration.providerIdentifier.toLowerCase() === 'tiktok' && !integration.disabled);
  const [publisher, setPublisher] = useState<'postiz' | 'postbridge'>(defaults.postizIntegrationId ? 'postiz' : 'postbridge');
  const [selected, setSelected] = useState<number[]>(defaults.socialAccountIds);
  const [postizIntegrationId, setPostizIntegrationId] = useState(defaults.postizIntegrationId || tiktokIntegrations[0]?.id || '');
  const [mode, setMode] = useState<'draft' | 'schedule'>(defaults.mode);
  // Seed with now + gap immediately so the field is never blank; refine to
  // "after the last scheduled post" once post-bridge responds.
  const [when, setWhen] = useState(() =>
    toLocalInput(new Date(Date.now() + DEFAULT_GAP_HOURS * 3600_000))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which mode succeeded, or null while still on the form. Drives the success screen.
  const [doneMode, setDoneMode] = useState<'draft' | 'schedule' | 'postiz' | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    getScheduledPosts()
      .then((posts) => {
        const future = posts
          .map((p) => (p.scheduledAt ? new Date(p.scheduledAt).getTime() : 0))
          .filter((t) => t > Date.now());
        const base = future.length ? Math.max(...future) : Date.now();
        setWhen(toLocalInput(new Date(base + DEFAULT_GAP_HOURS * 3600_000)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!postizIntegrationId && tiktokIntegrations[0]?.id) setPostizIntegrationId(tiktokIntegrations[0].id);
  }, [postizIntegrationId, tiktokIntegrations]);

  const toggle = (id: number) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const confirm = async () => {
    setError(null);
    if (publisher === 'postiz' && !postizIntegrationId) return setError(t('Pick a Postiz TikTok integration in Settings first.', '请先在设置里选择 Postiz TikTok integration。'));
    if (publisher === 'postbridge' && !selected.length) return setError(t('Pick at least one account.', '至少选择一个账号。'));
    if ((publisher === 'postiz' || (publisher === 'postbridge' && mode === 'schedule')) && !when) return setError(t('Pick a date & time, or save as a draft.', '选择发布时间，或保存为草稿。'));
    setBusy(true);
    try {
      await onConfirm({
        publisher,
        socialAccounts: selected,
        postizIntegrationId,
        mode,
        scheduledAt: publisher === 'postiz' || mode === 'schedule' ? new Date(when).toISOString() : null,
      });
      setBusy(false);
      setDoneMode(publisher === 'postiz' ? 'postiz' : mode); // show the success screen instead of closing
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  if (doneMode) {
    const scheduled = doneMode === 'schedule';
    const postizDone = doneMode === 'postiz';
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-card border border-line rounded-2xl w-full max-w-sm p-6 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <CheckCircle2 size={32} className="text-emerald-600 mx-auto" />
          <h2 className="text-[16px] font-semibold text-ink mt-3">
            {postizDone ? t('Sent to Postiz', '已发送到 Postiz') : scheduled ? t('Scheduled', '已排程') : t('Saved as draft', '已保存为草稿')}
          </h2>
          <p className="text-[13px] text-ink-5 mt-1.5 leading-snug">
            {postizDone
              ? t('Postiz will send it to TikTok inbox. Open TikTok on your phone to finish editing and publish manually.', 'Postiz 会发送到 TikTok inbox。打开手机 TikTok 继续编辑并手动发布。')
              : scheduled
              ? t('post-bridge will publish it at the time you picked.', 'post-bridge 会在你选择的时间发布。')
              : t('It’s waiting in your post-bridge drafts to post by hand.', '它已经在 post-bridge 草稿里，等待你手动发布。')}
          </p>
          <div className="flex flex-col gap-2 mt-5">
            <a
              href={postizDone ? 'https://www.tiktok.com/messages?lang=en' : scheduled ? PB_SCHEDULED_URL : PB_DRAFTS_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 h-9 rounded-lg bg-ink text-bg text-[13px] font-medium hover:opacity-90"
            >
              {postizDone ? t('Open TikTok inbox', '打开 TikTok inbox') : t('View on post-bridge', '在 post-bridge 查看')} <ExternalLink size={13} />
            </a>
            <Button variant="secondary" onClick={onClose}>
              {t('Done', '完成')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-line rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="text-[15px] font-semibold text-ink">{t('Schedule slideshow', '发送轮播内容')}</h2>
          <button onClick={onClose} className="text-ink-5 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Preview */}
          <div>
            <div className="grid grid-cols-6 gap-1.5">
              {slideshow.slides.map((s, i) => (
                <SlidePreview key={s.id} slide={s} onClick={() => setPreviewIndex(i)} />
              ))}
            </div>
            <p className="text-[12px] text-ink-4 mt-2 line-clamp-2">{slideshow.caption}</p>
          </div>

          <div>
            <label className="text-[11px] text-ink-5 mb-1.5 block uppercase tracking-widest font-semibold">
              {t('Publisher', '发布通道')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPublisher('postiz')}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                  publisher === 'postiz' ? 'border-ink bg-ink text-bg' : 'border-line bg-card text-ink hover:border-line-2'
                }`}
              >
                <span className="block text-[13px] font-semibold">Postiz</span>
                <span className={`block text-[11px] mt-0.5 ${publisher === 'postiz' ? 'text-bg/70' : 'text-ink-6'}`}>
                  {t('TikTok inbox upload', 'TikTok inbox 上传')}
                </span>
              </button>
              <button
                onClick={() => setPublisher('postbridge')}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                  publisher === 'postbridge' ? 'border-ink bg-ink text-bg' : 'border-line bg-card text-ink hover:border-line-2'
                }`}
              >
                <span className="block text-[13px] font-semibold">Postbridge</span>
                <span className={`block text-[11px] mt-0.5 ${publisher === 'postbridge' ? 'text-bg/70' : 'text-ink-6'}`}>
                  {t('Draft or schedule', '草稿或排程')}
                </span>
              </button>
            </div>
          </div>

          {publisher === 'postiz' && (
            <div>
              <label className="text-[11px] text-ink-5 mb-1.5 block uppercase tracking-widest font-semibold">
                {t('Postiz TikTok integration', 'Postiz TikTok integration')}
              </label>
              {tiktokIntegrations.length === 0 ? (
                <p className="text-[12px] text-ink-5">
                  {t('No TikTok integration loaded from Postiz. Add your Postiz key in Settings and connect TikTok inside Postiz.', '没有从 Postiz 加载到 TikTok integration。请在设置里添加 Postiz Key，并在 Postiz 里连接 TikTok。')}
                </p>
              ) : (
                <select
                  value={postizIntegrationId}
                  onChange={(e) => setPostizIntegrationId(e.target.value)}
                  className="w-full h-9 bg-card border border-line rounded-lg px-3 text-[13px] text-ink outline-none focus:border-ink-7 focus:ring-2 focus:ring-ink/10"
                >
                  <option value="">{t('Select TikTok', '选择 TikTok')}</option>
                  {tiktokIntegrations.map((integration) => (
                    <option key={integration.id} value={integration.id}>
                      {integration.name || integration.profile || integration.id}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-surface border border-line">
                <Info size={13} className="text-ink-5 mt-0.5 shrink-0" />
                <p className="text-[11px] text-ink-4 leading-snug">
                  {t('This schedules the carousel in Postiz. When Postiz runs it, TikTok still sends it to inbox so you can finish publishing on your phone.', '这会把轮播排程到 Postiz。到点后 Postiz 会发到 TikTok inbox，你仍然在手机上完成发布。')}
                </p>
              </div>
            </div>
          )}

          {/* Accounts */}
          {publisher === 'postbridge' && <div>
            <label className="text-[11px] text-ink-5 mb-1.5 block uppercase tracking-widest font-semibold">
              {t('Post to', '发布到')}
            </label>
            {accounts.length === 0 ? (
              <p className="text-[12px] text-ink-5">
                {t('No connected accounts. Add your post-bridge key in Settings and connect accounts at', '还没有连接账号。先在设置里添加 post-bridge Key，然后去')}
                <a
                  href="https://post-bridge.com?atp=clip-factory"
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink-4 underline hover:text-ink"
                >
                  post-bridge.com
                </a>
                .
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {accounts.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-line cursor-pointer hover:border-line-2"
                  >
                    <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
                    <span className="text-[13px] text-ink font-medium">{a.username}</span>
                    <span className="text-[11px] text-ink-5 uppercase tracking-wide">{a.platform}</span>
                  </label>
                ))}
              </div>
            )}
          </div>}

          {publisher === 'postiz' && (
            <div>
              <label className="text-[11px] text-ink-5 mb-1.5 block uppercase tracking-widest font-semibold">
                {t('When', '发布时间')}
              </label>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="w-full h-9 bg-card border border-line rounded-lg px-3 text-[13px] text-ink outline-none focus:border-ink-7 focus:ring-2 focus:ring-ink/10"
              />
            </div>
          )}

          {/* Mode */}
          {publisher === 'postbridge' && <div>
            <label className="text-[11px] text-ink-5 mb-1.5 block uppercase tracking-widest font-semibold">
              {t('When', '发布时间')}
            </label>
            <div className="flex gap-2 mb-2">
              <Button variant={mode === 'draft' ? 'primary' : 'secondary'} onClick={() => setMode('draft')}>
                {t('Save as draft', '保存为草稿')}
              </Button>
              <Button variant={mode === 'schedule' ? 'primary' : 'secondary'} onClick={() => setMode('schedule')}>
                {t('Schedule', '排程')}
              </Button>
            </div>
            {mode === 'schedule' && (
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="w-full h-9 bg-card border border-line rounded-lg px-3 text-[13px] text-ink outline-none focus:border-ink-7 focus:ring-2 focus:ring-ink/10"
              />
            )}

            <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-surface border border-line">
              <Info size={13} className="text-ink-5 mt-0.5 shrink-0" />
              <p className="text-[11px] text-ink-4 leading-snug">
                {mode === 'draft' ? (
                  <>
                    {t('Saves to your post-bridge inbox to post by hand. No analytics come back on drafts (TikTok only reports content it posts itself) — but posting manually avoids automation detection, so reach potential is often higher.', '保存到 post-bridge 草稿箱，之后手动发布。草稿不会回传数据（TikTok 只统计它自己发布的内容），但手动发布的自动化痕迹更少。')}
                  </>
                ) : (
                  <>{t('post-bridge publishes this automatically at the chosen time and reports its analytics back to Results.', 'post-bridge 会在指定时间自动发布，并把数据同步到数据页。')}</>
                )}
              </p>
            </div>
          </div>}

          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-line flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('Cancel', '取消')}
          </Button>
          <Button
            variant="primary"
            icon={busy ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />}
            onClick={confirm}
            disabled={busy}
          >
            {busy ? t('Uploading…', '上传中…') : publisher === 'postiz' ? t('Schedule to Postiz', '排程到 Postiz') : mode === 'schedule' ? t('Schedule it', '确认排程') : t('Save draft', '保存草稿')}
          </Button>
        </div>
      </div>
      {previewIndex !== null && (
        <SlideLightbox
          slides={slideshow.slides}
          index={previewIndex}
          onIndex={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
}
