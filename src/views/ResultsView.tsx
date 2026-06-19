import { useCallback, useEffect, useState } from 'react';
import { Eye, Heart, MessageCircle, Share2, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import type { PostResult, PostizPost } from '../types';
import { ViewHeader } from '../components/ViewHeader';
import { getPostizPosts, getResults, syncResults } from '../lib/api';
import { useT } from '../i18n';

interface ResultsViewProps {
  postbridgeConfigured: boolean;
  postizConfigured: boolean;
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

type Channel = 'postiz' | 'postbridge';

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function ResultsView({ postbridgeConfigured, postizConfigured }: ResultsViewProps) {
  const t = useT();
  const [channel, setChannel] = useState<Channel>(postizConfigured ? 'postiz' : 'postbridge');
  const [results, setResults] = useState<PostResult[] | null>(null);
  const [postizPosts, setPostizPosts] = useState<PostizPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setError(null);
    if (channel === 'postbridge') {
      if (!postbridgeConfigured) return;
      getResults()
        .then(setResults)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    } else {
      if (!postizConfigured) return;
      getPostizPosts()
        .then(setPostizPosts)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }
  }, [channel, postbridgeConfigured, postizConfigured]);

  // Refresh pulls fresh metrics from the platforms (post-bridge sync) first,
  // which is also what backfills cover thumbnails once a post goes live.
  const refresh = useCallback(async () => {
    if (channel === 'postbridge' && !postbridgeConfigured) return;
    if (channel === 'postiz' && !postizConfigured) return;
    setRefreshing(true);
    setError(null);
    try {
      if (channel === 'postiz') setPostizPosts(await getPostizPosts());
      else setResults(await syncResults());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, [channel, postbridgeConfigured, postizConfigured]);

  const totalViews = results?.reduce((s, r) => s + r.views, 0) ?? 0;
  const totalLikes = results?.reduce((s, r) => s + r.likes, 0) ?? 0;

  return (
    <>
      <ViewHeader
        title={t('Results', '数据')}
        subtitle={channel === 'postiz'
          ? t('Postiz post status. Analytics still come from Postbridge or the platform itself.', 'Postiz 内容状态。数据仍需从 Postbridge 或平台自身查看。')
          : t("Live analytics from post-bridge for everything you've published.", '从 post-bridge 同步已发布内容的数据。')}
        right={
          ((channel === 'postiz' && postizConfigured) || (channel === 'postbridge' && postbridgeConfigured)) && (
            <button
              onClick={() => void refresh()}
              disabled={refreshing}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line text-[12px] text-ink-4 hover:text-ink hover:border-line-2 disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? t('Syncing…', '同步中…') : t('Refresh', '刷新')}
            </button>
          )
        }
      />
      <div className="flex-1 overflow-y-auto">
        {channel === 'postbridge' && results && results.length > 0 && (
          <div className="px-8 py-4 border-b border-line bg-surface">
            <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6">
              <Stat label={t('Total views', '总播放')} value={formatNumber(totalViews)} />
              <Stat label={t('Total likes', '总点赞')} value={formatNumber(totalLikes)} />
              <Stat label={t('Posts tracked', '追踪内容数')} value={String(results.length)} />
            </div>
          </div>
        )}

        <div className="p-8">
          <div className="max-w-4xl mx-auto flex flex-col gap-3">
            <ChannelTabs channel={channel} onChange={setChannel} />

            {channel === 'postiz' ? (
              !postizConfigured ? (
                <Empty text={t('Add your Postiz API key in Settings to see Postiz post status.', '在设置里添加 Postiz API Key 后查看 Postiz 内容状态。')} />
              ) : error ? (
                <Empty text={error} />
              ) : postizPosts === null ? (
                <Loading text={t('Loading Postiz posts…', '加载 Postiz 内容…')} />
              ) : postizPosts.length === 0 ? (
                <Empty text={t('No Postiz posts found in the current date window.', '当前时间范围内没有 Postiz 内容。')} />
              ) : (
                postizPosts.map((post) => <PostizStatusCard key={post.id} post={post} />)
              )
            ) : !postbridgeConfigured ? (
              <Empty text={t('Add your post-bridge API key in Settings to see analytics.', '在设置里添加 post-bridge API Key 后查看数据。')} />
            ) : error ? (
              <Empty text={error} />
            ) : results === null ? (
              <Loading text={t('Loading analytics…', '加载数据…')} />
            ) : results.length === 0 ? (
              <Empty text={t('No analytics yet. Once your posts go live, post-bridge syncs their performance here.', '还没有数据。内容发布后，post-bridge 会在这里同步表现。')} />
            ) : (
              results.map((r) => <ResultCard key={r.id} result={r} />)
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ChannelTabs({ channel, onChange }: { channel: Channel; onChange: (channel: Channel) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border border-line bg-surface mb-3">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-ink-6 uppercase tracking-widest">{label}</div>
      <div className="text-[22px] font-semibold text-ink leading-none mt-1">{value}</div>
    </div>
  );
}

function ResultCard({ result }: { result: PostResult }) {
  return (
    <div className="bg-card border border-line rounded-xl p-4 flex gap-4">
      <div className="shrink-0 w-20 aspect-[9/16] rounded-md overflow-hidden bg-raised">
        {result.coverImageUrl && (
          <img src={result.coverImageUrl} alt="" className="w-full h-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-line bg-raised uppercase tracking-wide text-ink-4">
            {result.platform || 'post'}
          </span>
          {result.lastSyncedAt && (
            <span className="text-[11px] text-ink-6">
              synced {new Date(result.lastSyncedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        {result.description && (
          <h3 className="text-[14px] font-semibold text-ink leading-snug mb-2 line-clamp-2">
            {result.description}
          </h3>
        )}
        <div className="flex items-center gap-4 text-[12px] text-ink-4">
          <Metric icon={Eye} value={formatNumber(result.views)} />
          <Metric icon={Heart} value={formatNumber(result.likes)} />
          <Metric icon={MessageCircle} value={formatNumber(result.comments)} />
          <Metric icon={Share2} value={formatNumber(result.shares)} />
          {result.shareUrl && (
            <a href={result.shareUrl} target="_blank" rel="noreferrer" className="text-ink-5 underline">
              view post
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function PostizStatusCard({ post }: { post: PostizPost }) {
  const status = post.state || 'UNKNOWN';
  const isPublished = status.toUpperCase() === 'PUBLISHED';
  return (
    <div className="bg-card border border-line rounded-xl p-4 flex gap-4 items-center">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-line bg-raised uppercase tracking-wide text-ink-4">
            {post.integrationProvider || 'postiz'}
          </span>
          <span className={`text-[11px] font-medium ${isPublished ? 'text-emerald-600' : 'text-ink-5'}`}>{status}</span>
          {post.publishDate && <span className="text-[11px] text-ink-6">{new Date(post.publishDate).toLocaleDateString()}</span>}
        </div>
        <div className="text-[13px] text-ink-4 truncate">{stripHtml(post.content) || '(no content)'}</div>
      </div>
      {post.releaseUrl && (
        <a href={post.releaseUrl} target="_blank" rel="noreferrer" className="shrink-0 text-ink-5 hover:text-ink">
          <ExternalLink size={15} />
        </a>
      )}
    </div>
  );
}

function Metric({ icon: Icon, value }: { icon: typeof Eye; value: string }) {
  return (
    <span className="flex items-center gap-1">
      <Icon size={11} className="text-ink-6" />
      {value}
    </span>
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
