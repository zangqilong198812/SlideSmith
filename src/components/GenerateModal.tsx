import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Button } from './Button';
import { PackPicker } from './PackPicker';
import { useT } from '../i18n';
import { getLibrary } from '../lib/api';
import { SHOWCASE_MOCKUP, screenStyle } from '../lib/showcaseMockup';
import type { GenerateStyle, LibraryImage } from '../types';

interface GenerateModalProps {
  defaultPacks: string[];
  generating: boolean;
  onClose: () => void;
  onGenerate: (count: number, packs: string[], style: GenerateStyle) => void;
}

const COUNT_OPTIONS = [1, 3, 5, 10];

function TemplatePreview({ type }: { type: GenerateStyle }) {
  if (type === 'notes') {
    return (
      <div className="relative aspect-[9/16] overflow-hidden rounded-md bg-[#f8f5eb] text-[#191919]">
        <div className="absolute inset-x-0 top-0 h-[15%] bg-[#f2eddf] border-b border-black/10">
          <div className="absolute left-[10%] top-1/2 flex -translate-y-1/2 gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff5f57]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#ffbd2e]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#28c840]" />
          </div>
        </div>
        <div className="absolute inset-x-[10%] top-[24%] space-y-2">
          <div className="h-3 w-[86%] rounded bg-black/85" />
          <div className="h-3 w-[64%] rounded bg-black/85" />
          <div className="pt-4 space-y-1.5">
            <div className="h-1.5 w-full rounded bg-black/45" />
            <div className="h-1.5 w-[92%] rounded bg-black/45" />
            <div className="h-1.5 w-[78%] rounded bg-black/45" />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'showcase') {
    return (
      <div className="relative aspect-[9/16] overflow-hidden rounded-md bg-[#101114] text-white">
        <div className="absolute inset-[-12%] bg-[linear-gradient(135deg,#c6d1d3_0%,#111317_48%,#b8ab9e_100%)] blur-md" />
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-x-[17%] top-[12%] h-2 rounded-full bg-white" />
        <div className="absolute left-1/2 top-[18%] w-[54%] aspect-[1406/2822] -translate-x-1/2 drop-shadow-lg">
          <div className="absolute overflow-hidden bg-[linear-gradient(160deg,#2a3038,#070809)]" style={screenStyle}>
            <div className="mx-auto mt-[8%] h-[4%] w-[32%] rounded-full bg-black" />
            <div className="mx-[14%] mt-[26%] grid grid-cols-2 gap-[10%]">
              <span className="aspect-square rounded-[28%] bg-white/20" />
              <span className="aspect-square rounded-[28%] bg-white/12" />
              <span className="aspect-square rounded-[28%] bg-white/16" />
              <span className="aspect-square rounded-[28%] bg-white/10" />
            </div>
          </div>
          <img src={SHOWCASE_MOCKUP.frameSrc} alt="" className="absolute inset-0 h-full w-full" />
        </div>
        <div className="absolute inset-x-[15%] bottom-[15%] space-y-1.5">
          <div className="mx-auto h-1.5 w-full rounded bg-white/90" />
          <div className="mx-auto h-1.5 w-[70%] rounded bg-white/75" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-md bg-[linear-gradient(135deg,#233246,#7c4b35)] text-white">
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-x-[12%] top-1/2 -translate-y-1/2 space-y-2">
        <div className="mx-auto h-4 w-[86%] rounded bg-white" />
        <div className="mx-auto h-4 w-[64%] rounded bg-white" />
      </div>
    </div>
  );
}

export function GenerateModal({ defaultPacks, generating, onClose, onGenerate }: GenerateModalProps) {
  const t = useT();
  const [count, setCount] = useState(3);
  const [packs, setPacks] = useState<string[]>(defaultPacks);
  const [style, setStyle] = useState<GenerateStyle>('notes');
  const [library, setLibrary] = useState<LibraryImage[] | null>(null);

  useEffect(() => {
    getLibrary().then(setLibrary).catch(() => setLibrary([]));
  }, []);

  const screenshotImages = useMemo(
    () => (library || []).filter((img) => img.purpose === 'screenshot'),
    [library]
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={generating ? undefined : onClose}>
      <div className="bg-card border border-line rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="text-[15px] font-semibold text-ink flex items-center gap-2">
            <Sparkles size={15} /> {t('Generate slideshows', '生成轮播内容')}
          </h2>
          {!generating && <button onClick={onClose} className="text-ink-5 hover:text-ink"><X size={18} /></button>}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Count */}
          <div>
            <label className="text-[11px] text-ink-5 uppercase tracking-widest font-semibold mb-1.5 block">{t('How many?', '生成数量')}</label>
            <div className="flex items-center gap-2">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  disabled={generating}
                  className={`w-12 h-9 rounded-lg border text-[13px] font-medium transition-colors disabled:opacity-50 ${
                    count === n ? 'border-ink bg-ink text-bg' : 'border-line bg-card text-ink-5 hover:border-line-2'
                  }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                disabled={generating}
                onChange={(e) => setCount(Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1))))}
                className="flex-1 h-9 bg-card border border-line rounded-lg px-3 text-[13px] text-ink text-center tabular-nums outline-none focus:border-ink-7 focus:ring-2 focus:ring-ink/10 disabled:opacity-50"
              />
            </div>
            <p className="text-[11px] text-ink-6 mt-1">{t('1–100. Large batches take a while — they generate in chunks.', '1–100。大批量会分块生成，需要一些时间。')}</p>
          </div>

          <div>
            <label className="text-[11px] text-ink-5 uppercase tracking-widest font-semibold mb-1.5 block">{t('Style', '内容风格')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                {
                  key: 'notes' as const,
                  title: t('Notes style', 'Notes 风格'),
                  desc: t('Human hook + Notes screenshot', '真人首图 + 笔记截图'),
                },
                {
                  key: 'showcase' as const,
                  title: t('Showcase', '展示模板'),
                  desc: t('Blurred phone walkthrough', '模糊背景 + 手机展示'),
                },
                {
                  key: 'classic' as const,
                  title: t('Classic slider', '经典轮播'),
                  desc: t('Large text on every slide', '每页大字叠图'),
                },
              ].map((option) => (
                <button
                  key={option.key}
                  onClick={() => setStyle(option.key)}
                  disabled={generating}
                  className={`text-left rounded-xl border p-2 transition-colors disabled:opacity-50 ${
                    style === option.key ? 'border-ink bg-ink/5 text-ink shadow-sm' : 'border-line bg-card text-ink hover:border-line-2'
                  }`}
                >
                  <TemplatePreview type={option.key} />
                  <span className="block text-[13px] font-semibold mt-2">{option.title}</span>
                  <span className="block text-[11px] mt-0.5 text-ink-6">{option.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {style === 'classic' ? (
            <div>
              <label className="text-[11px] text-ink-5 uppercase tracking-widest font-semibold mb-1.5 block">{t('Background packs', '背景素材包')}</label>
              <PackPicker selected={packs} onChange={setPacks} disabled={generating} />
            </div>
          ) : style === 'showcase' ? (
            <div>
              <label className="text-[11px] text-ink-5 uppercase tracking-widest font-semibold mb-1.5 block">{t('App screenshots', 'App 截图')}</label>
              <div className="rounded-xl border border-line bg-surface p-3">
                {library === null ? (
                  <div className="flex items-center gap-2 text-[12px] text-ink-5">
                    <Loader2 size={13} className="animate-spin" /> {t('Loading screenshots…', '加载截图中…')}
                  </div>
                ) : screenshotImages.length ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] text-ink-4">
                        {t(`${screenshotImages.length} screenshots will be used automatically.`, `${screenshotImages.length} 张截图会自动用于 Showcase。`)}
                      </p>
                      <span className="text-[11px] text-ink-6">{t('Library → App screenshots', '素材库 → App 截图')}</span>
                    </div>
                    <div className="flex gap-1.5 overflow-hidden">
                      {screenshotImages.slice(0, 8).map((img) => (
                        <div key={img.id} className="w-10 aspect-[9/16] rounded-md overflow-hidden bg-raised border border-line shrink-0">
                          <img src={img.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-[12px] text-ink-5">
                    <ImageIcon size={14} className="mt-0.5 shrink-0" />
                    <p>
                      {t('No App screenshots yet. Upload screenshots in Library first; otherwise Showcase will fall back to background images.', '还没有 App 截图。建议先去素材库上传截图；否则 Showcase 会退回使用普通背景图。')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-surface p-3 text-[12px] text-ink-5">
              {t('Notes style does not use library images except the optional final slide.', 'Notes 风格不使用素材库图片，除了可选的默认最后一页。')}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-line flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={generating}>{t('Cancel', '取消')}</Button>
          <Button
            variant="primary"
            icon={generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            onClick={() => onGenerate(count, packs, style)}
            disabled={generating}
          >
            {generating ? t('Generating…', '生成中…') : t(`Generate ${count}`, `生成 ${count} 条`)}
          </Button>
        </div>
      </div>
    </div>
  );
}
