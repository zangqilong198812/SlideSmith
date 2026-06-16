import { useEffect, useMemo, useState } from 'react';
import { Loader2, Download, Trash2 } from 'lucide-react';
import type { LibraryImage } from '../types';
import { ViewHeader } from '../components/ViewHeader';
import { Button } from '../components/Button';
import { getLibrary, scrapePinterest, deleteLibraryImage } from '../lib/api';
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

  const remove = async (id: string) => setImages(await deleteLibraryImage(id));

  // Group by pack, scraped packs first.
  const groups = useMemo(() => {
    const map = new Map<string, LibraryImage[]>();
    for (const img of images || []) {
      if (!map.has(img.pack)) map.set(img.pack, []);
      map.get(img.pack)!.push(img);
    }
    return [...map.entries()];
  }, [images]);
  const flatImages = images?.map((img) => img.url) || [];

  return (
    <>
      <ViewHeader
        title={t('Library', '素材库')}
        subtitle={t('Background images for your slides. Ships with curated aesthetic packs — scrape more from Pinterest with your own Apify key.', '轮播页背景素材。内置素材包可直接用，也可以用 Apify 抓取 Pinterest。')}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Scrape bar */}
        <div className="px-8 py-4 border-b border-line bg-surface">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-2 flex-wrap">
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
                        {img.source === 'scraped' && (
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
