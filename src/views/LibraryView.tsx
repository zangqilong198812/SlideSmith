import { useEffect, useMemo, useState } from 'react';
import { Loader2, Download, Trash2, Upload } from 'lucide-react';
import type { LibraryImage } from '../types';
import { ViewHeader } from '../components/ViewHeader';
import { Button } from '../components/Button';
import { getLibrary, scrapePinterest, deleteLibraryImage, uploadLibraryImages } from '../lib/api';
import { ImageLightbox } from '../components/Lightbox';
import { useT } from '../i18n';

interface LibraryViewProps {
  hasApify: boolean;
}

export function LibraryView({ hasApify }: LibraryViewProps) {
  const t = useT();
  const [images, setImages] = useState<LibraryImage[] | null>(null);
  const [searches, setSearches] = useState('');
  const [count, setCount] = useState(40);
  const [scraping, setScraping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPurpose, setUploadPurpose] = useState<'background' | 'screenshot'>('screenshot');
  const [activeTab, setActiveTab] = useState<'screenshot' | 'background'>('screenshot');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const load = () => getLibrary().then(setImages).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const scrape = async () => {
    setError(null);
    setNote(null);
    setScraping(true);
    try {
      // Pinterest searches are comma-separated phrases (each can contain spaces).
      const queries = searches.split(',').map((s) => s.trim()).filter(Boolean);
      const r = await scrapePinterest(queries, count);
      setNote(`Added ${r.added} image${r.added === 1 ? '' : 's'} from ${r.found} found.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScraping(false);
    }
  };

  const upload = async (files: FileList | null) => {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    setError(null);
    setNote(null);
    setUploading(true);
    try {
      const dataUrls = await Promise.all(
        selected.map((file) =>
          new Promise<string>((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
              reject(new Error('Upload PNG, JPG, or WEBP images only.'));
              return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error || new Error('Could not read image.'));
            reader.readAsDataURL(file);
          })
        )
      );
      const r = await uploadLibraryImages(
        dataUrls,
        uploadPurpose,
        uploadPurpose === 'screenshot' ? 'Showcase screenshots' : 'Uploads'
      );
      setImages(r.library);
      setNote(`Uploaded ${r.added} image${r.added === 1 ? '' : 's'} to ${uploadPurpose === 'screenshot' ? 'Showcase screenshots' : 'Uploads'}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => setImages(await deleteLibraryImage(id));

  const visibleImages = useMemo(
    () => (images || []).filter((img) => (img.purpose || 'background') === activeTab),
    [images, activeTab]
  );
  const screenshotCount = (images || []).filter((img) => img.purpose === 'screenshot').length;
  const backgroundCount = (images || []).filter((img) => (img.purpose || 'background') === 'background').length;

  // Group by pack for the active material type.
  const groups = useMemo(() => {
    const map = new Map<string, LibraryImage[]>();
    for (const img of visibleImages) {
      if (!map.has(img.pack)) map.set(img.pack, []);
      map.get(img.pack)!.push(img);
    }
    return [...map.entries()];
  }, [visibleImages]);
  const flatImages = visibleImages.map((img) => img.url);

  return (
    <>
      <ViewHeader
        title={t('Library', '素材库')}
        subtitle={t('Background images and Showcase screenshots for generated slides. Upload your app screenshots here so Showcase can use them automatically.', '生成用的背景素材和 Showcase 截图素材。把 App 截图上传到这里，Showcase 会自动使用。')}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Upload + scrape bar */}
        <div className="px-8 py-4 border-b border-line bg-surface">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <label className="text-[11px] text-ink-5 mb-1 block">{t('Upload as', '上传用途')}</label>
                <select
                  value={uploadPurpose}
                  onChange={(e) => {
                    const next = e.target.value === 'background' ? 'background' : 'screenshot';
                    setUploadPurpose(next);
                    setActiveTab(next);
                  }}
                  disabled={uploading}
                  className="h-9 bg-card border border-line rounded-lg px-3 text-[13px] text-ink outline-none focus:border-ink-7 focus:ring-2 focus:ring-ink/10 disabled:opacity-50"
                >
                  <option value="screenshot">{t('Showcase screenshots', 'Showcase 截图')}</option>
                  <option value="background">{t('Background images', '普通背景图')}</option>
                </select>
              </div>
              <label className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-line text-[13px] text-ink-4 hover:text-ink hover:border-line-2 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {uploading ? t('Uploading…', '上传中…') : t('Upload images', '上传图片')}
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    void upload(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              <p className="text-[12px] text-ink-5 flex-1 min-w-[220px]">
                {t('Use Showcase screenshots for app screens, App Store screenshots, lock screens, and home screen setups.', 'Showcase 截图适合放 App 页面、App Store 截图、锁屏和主屏设置。')}
              </p>
            </div>

            <div className="flex items-end gap-2 flex-wrap pt-4 border-t border-line">
              <div className="flex-1 min-w-[220px]">
                <label className="text-[11px] text-ink-5 mb-1 block">{t('Pinterest searches', 'Pinterest 搜索词')}</label>
                <input
                  value={searches}
                  onChange={(e) => setSearches(e.target.value)}
                  placeholder="e.g. dark moody aesthetic, cozy bedroom, foggy mountain"
                  disabled={!hasApify}
                  className="w-full h-9 bg-card border border-line rounded-lg px-3 text-[13px] text-ink placeholder:text-ink-6 outline-none focus:border-ink-7 focus:ring-2 focus:ring-ink/10 disabled:opacity-50"
                />
              </div>
              <div className="w-24">
                <label className="text-[11px] text-ink-5 mb-1 block">{t('Max', '数量')}</label>
                <input
                  type="number"
                  value={count}
                  min={10}
                  max={200}
                  onChange={(e) => setCount(Number(e.target.value))}
                  onBlur={() => setCount((c) => Math.min(Math.max(c || 10, 10), 200))}
                  disabled={!hasApify}
                  className="w-full h-9 bg-card border border-line rounded-lg px-3 text-[13px] text-ink outline-none focus:border-ink-7 focus:ring-2 focus:ring-ink/10 disabled:opacity-50"
                />
                <span className="text-[10px] text-ink-6 mt-1 block">{t('min 10', '至少 10')}</span>
              </div>
              <Button
                variant="primary"
                size="lg"
                icon={scraping ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                onClick={scrape}
                disabled={!hasApify || scraping || !searches.trim()}
              >
                {scraping ? t('Scraping…', '抓取中…') : t('Scrape Pinterest', '抓取 Pinterest')}
              </Button>
            </div>
            {!hasApify && (
              <p className="text-[12px] text-ink-5 mt-2">
                {t('Add your Apify API key in Settings to scrape Pinterest. The bundled packs below work without it.', '在设置里添加 Apify API Key 后即可抓取 Pinterest；下方内置素材无需 Key。')}
              </p>
            )}
            {note && <p className="text-[12px] text-emerald-600 mt-2">{note}</p>}
            {error && <p className="text-[12px] text-red-600 mt-2">{error}</p>}
          </div>
        </div>

        {/* Packs */}
        <div className="p-8">
          <div className="max-w-5xl mx-auto space-y-8">
            {images === null ? (
              <div className="flex items-center justify-center py-16 text-ink-5 text-[13px] gap-2">
                <Loader2 size={14} className="animate-spin" /> {t('Loading library…', '加载素材库…')}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border border-line bg-surface">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('screenshot');
                      setUploadPurpose('screenshot');
                    }}
                    className={`h-10 rounded-lg text-[13px] font-medium transition-colors ${
                      activeTab === 'screenshot' ? 'bg-card border border-line text-ink shadow-sm' : 'text-ink-5 hover:text-ink'
                    }`}
                  >
                    {t('App screenshots', 'App 截图')} · {screenshotCount}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('background');
                      setUploadPurpose('background');
                    }}
                    className={`h-10 rounded-lg text-[13px] font-medium transition-colors ${
                      activeTab === 'background' ? 'bg-card border border-line text-ink shadow-sm' : 'text-ink-5 hover:text-ink'
                    }`}
                  >
                    {t('Backgrounds', '背景素材')} · {backgroundCount}
                  </button>
                </div>

                {groups.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-line-2 bg-surface px-5 py-10 text-center text-[13px] text-ink-5">
                    {activeTab === 'screenshot'
                      ? t('No App screenshots yet. Upload screenshots above, then Showcase will use them automatically.', '还没有 App 截图。先在上方上传截图，Showcase 生成时会自动使用。')
                      : t('No background images yet.', '还没有背景素材。')}
                  </div>
                ) : (
                  groups.map(([pack, imgs]) => (
                    <div key={pack}>
                      <div className="flex items-baseline gap-3 mb-3">
                        <h2 className="text-[13px] font-semibold text-ink uppercase tracking-widest">{pack}</h2>
                        <span className="text-[11px] text-ink-6">{imgs.length}</span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {imgs.map((img) => (
                          <div
                            key={img.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setPreviewIndex(flatImages.indexOf(img.url))}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setPreviewIndex(flatImages.indexOf(img.url));
                              }
                            }}
                            className="group relative aspect-[9/16] rounded-lg overflow-hidden bg-raised cursor-zoom-in"
                          >
                            <img src={img.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                            {img.purpose === 'screenshot' && (
                              <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white">
                                Shot
                              </span>
                            )}
                            {img.source !== 'bundled' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  remove(img.id);
                                }}
                                aria-label="Remove image"
                                className="absolute top-1 right-1 w-6 h-6 rounded-md bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {previewIndex !== null && (
        <ImageLightbox
          images={flatImages}
          index={previewIndex}
          onIndex={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </>
  );
}
