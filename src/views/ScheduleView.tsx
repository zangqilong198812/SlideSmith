import { useCallback, useEffect, useState } from 'react';
import { Loader2, FileEdit, CheckCircle2, Clock, RefreshCw, ExternalLink } from 'lucide-react';
import type { ScheduledPost, PostizPost } from '../types';
import { ViewHeader } from '../components/ViewHeader';
import { getPostizPosts, getScheduledPosts } from '../lib/api';
import { ImageLightbox } from '../components/Lightbox';
import { useT } from '../i18n';

interface ScheduleViewProps {
  postbridgeConfigured: boolean;
  postizConfigured: boolean;
}

function dayKey(p: ScheduledPost) {
  if (!p.scheduledAt) return 'Drafts';
  return new Date(p.scheduledAt).toDateString();
}

function formatDayLabel(key: string) {
  if (key === 'Drafts') return 'Drafts';
  const d = new Date(key);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const statusMeta: Record<string, { icon: typeof Clock; className: string; label: string }> = {
  draft: { icon: FileEdit, className: 'text-ink-5', label: 'Draft' },
  scheduled: { icon: Clock, className: 'text-ink-5', label: 'Scheduled' },
  processing: { icon: Loader2, className: 'text-amber-600', label: 'Processing' },
  posted: { icon: CheckCircle2, className: 'text-emerald-600', label: 'Posted' },
};

type Channel = 'postiz' | 'postbridge';

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function ScheduleView({ postbridgeConfigured, postizConfigured }: ScheduleViewProps) {
  const t = useT();
  const [channel, setChannel] = useState<Channel>(postizConfigured ? 'postiz' : 'postbridge');
  const [posts, setPosts] = useState<ScheduledPost[] | null>(null);
  const [postizPosts, setPostizPosts] = useState<PostizPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [preview, setPreview] = useState<{ images: string[]; index: number } | null>(null);

  const load = useCallback(async () => {
    if (channel === 'postbridge' && !postbridgeConfigured) return;
    if (channel === 'postiz' && !postizConfigured) return;
    setRefreshing(true);
    setError(null);
    try {
      if (channel === 'postiz') setPostizPosts(await getPostizPosts());
      else setPosts(await getScheduledPosts());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, [channel, postbridgeConfigured, postizConfigured]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = posts
    ? Object.entries(
        posts.reduce<Record<string, ScheduledPost[]>>((acc, p) => {
          (acc[dayKey(p)] ||= []).push(p);
          return acc;
        }, {})
      ).sort(([a], [b]) =>
        a === 'Drafts' ? 1 : b === 'Drafts' ? -1 : new Date(a).getTime() - new Date(b).getTime()
      )
    : [];

  return (
    <>
      <ViewHeader
        title={t('Schedule', '排程')}
        subtitle={channel === 'postiz'
          ? t('Posts created in Postiz. TikTok Upload still needs the phone inbox flow when Postiz runs it.', '已创建到 Postiz 的内容。TikTok Upload 到点后仍需手机 inbox 流程。')
          : t('Posts queued in post-bridge — it publishes them to your connected accounts at the scheduled time.', '已进入 post-bridge 队列的内容，会在设定时间发布。')}
        right={
          ((channel === 'postiz' && postizConfigured) || (channel === 'postbridge' && postbridgeConfigured)) && (
            <button
              onClick={() => void load()}
              disabled={refreshing}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line text-[12px] text-ink-4 hover:text-ink hover:border-line-2 disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              {t('Refresh', '刷新')}
            </button>
          )
        }
      />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <ChannelTabs channel={channel} onChange={setChannel} />

          {channel === 'postiz' ? (
            !postizConfigured ? (
              <Empty text={t('Add your Postiz API key in Settings to see Postiz posts.', '在设置里添加 Postiz API Key 后查看 Postiz 内容。')} />
            ) : error ? (
              <Empty text={error} />
            ) : postizPosts === null ? (
              <Loading text={t('Loading from Postiz…', '从 Postiz 加载中…')} />
            ) : postizPosts.length === 0 ? (
              <Empty text={t('No Postiz posts found in the current date window.', '当前时间范围内没有 Postiz 内容。')} />
            ) : (
              <div className="flex flex-col gap-2">
                {postizPosts.map((post) => <PostizRow key={post.id} post={post} />)}
              </div>
            )
          ) : !postbridgeConfigured ? (
            <Empty text={t('Add your post-bridge API key in Settings to see your scheduled posts.', '在设置里添加 post-bridge API Key 后查看排程。')} />
          ) : error ? (
            <Empty text={error} />
          ) : posts === null ? (
            <Loading text={t('Loading from post-bridge…', '从 post-bridge 加载中…')} />
          ) : posts.length === 0 ? (
            <Empty text={t('Nothing scheduled yet. Approve a slideshow from the Queue to send it here.', '还没有排程内容。在队列里发送内容后会显示在这里。')} />
          ) : (
            grouped.map(([day, items]) => (
              <div key={day}>
                <div className="flex items-baseline gap-3 mb-3">
                  <h2 className="text-[13px] font-semibold text-ink uppercase tracking-widest">
                    {formatDayLabel(day)}
                  </h2>
                  <span className="text-[11px] text-ink-6">
                    {items.length} post{items.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((p) => (
                    <ScheduledRow
                      key={p.id}
                      post={p}
                      onPreview={(index) => setPreview({ images: p.mediaUrls, index })}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {preview && (
        <ImageLightbox
          images={preview.images}
          index={preview.index}
          onIndex={(index) => setPreview((current) => current ? { ...current, index } : current)}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}

function ChannelTabs({ channel, onChange }: { channel: Channel; onChange: (channel: Channel) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border border-line bg-surface">
      {(['postiz', 'postbridge'] as Channel[]).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`h-10 rounded-lg text-[13px] font-medium transition-colors ${
            channel === item ? 'bg-card border border-line text-ink shadow-sm' : 'text-ink-5 hover:text-ink'
          }`}
        >
          {item === 'postiz' ? 'Postiz' : 'Postbridge'}
        </button>
      ))}
    </div>
  );
}

function PostizRow({ post }: { post: PostizPost }) {
  const status = post.state || 'UNKNOWN';
  const isPublished = status.toUpperCase() === 'PUBLISHED';
  const when = post.publishDate ? new Date(post.publishDate).toLocaleString() : '—';
  return (
    <div className="bg-card border border-line rounded-xl p-4 flex items-center gap-4 hover:border-line-2 transition-colors">
      <div className="w-28 shrink-0">
        <div className="text-[11px] text-ink-6 uppercase tracking-wide">{post.integrationName || post.integrationProvider || 'Postiz'}</div>
        <div className={`text-[12px] font-semibold mt-1 ${isPublished ? 'text-emerald-600' : 'text-ink-4'}`}>{status}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-ink-4 truncate">{stripHtml(post.content) || '(no content)'}</div>
        <div className="text-[11px] text-ink-6 mt-1">{when}</div>
      </div>
      {post.releaseUrl && (
        <a href={post.releaseUrl} target="_blank" rel="noreferrer" className="shrink-0 text-ink-5 hover:text-ink">
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}

function ScheduledRow({ post, onPreview }: { post: ScheduledPost; onPreview: (index: number) => void }) {
  const meta = statusMeta[post.status] || statusMeta.scheduled;
  const Icon = meta.icon;
  return (
    <div className="bg-card border border-line rounded-xl p-3 flex items-center gap-4 hover:border-line-2 transition-colors">
      <div className="w-16 shrink-0">
        <div className="text-[15px] font-semibold text-ink leading-none">{formatTime(post.scheduledAt)}</div>
        <div className={`flex items-center gap-1 mt-1 ${meta.className}`}>
          <Icon size={10} className={post.status === 'processing' ? 'animate-spin' : ''} />
          <span className="text-[10px]">{meta.label}</span>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        {post.mediaUrls.slice(0, 4).map((url, i) => (
          <button key={i} onClick={() => onPreview(i)} className="w-9 aspect-[9/16] rounded-md overflow-hidden bg-raised cursor-zoom-in">
            <img src={url} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-ink-4 truncate">{post.caption || '(no caption)'}</div>
      </div>
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-ink-5 text-[13px] gap-2">
      <Loader2 size={14} className="animate-spin" /> {text}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-16 text-[13px] text-ink-5 max-w-md mx-auto">{text}</div>;
}
