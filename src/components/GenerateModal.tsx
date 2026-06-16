import { useState } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { PackPicker } from './PackPicker';
import { useT } from '../i18n';

interface GenerateModalProps {
  defaultPacks: string[];
  generating: boolean;
  onClose: () => void;
  onGenerate: (count: number, packs: string[]) => void;
}

const COUNT_OPTIONS = [1, 3, 5, 10];

export function GenerateModal({ defaultPacks, generating, onClose, onGenerate }: GenerateModalProps) {
  const t = useT();
  const [count, setCount] = useState(3);
  const [packs, setPacks] = useState<string[]>(defaultPacks);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={generating ? undefined : onClose}>
      <div className="bg-card border border-line rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
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

          {/* Packs */}
          <div>
            <label className="text-[11px] text-ink-5 uppercase tracking-widest font-semibold mb-1.5 block">{t('Background packs', '背景素材包')}</label>
            <PackPicker selected={packs} onChange={setPacks} disabled={generating} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-line flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={generating}>{t('Cancel', '取消')}</Button>
          <Button
            variant="primary"
            icon={generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            onClick={() => onGenerate(count, packs)}
            disabled={generating}
          >
            {generating ? t('Generating…', '生成中…') : t(`Generate ${count}`, `生成 ${count} 条`)}
          </Button>
        </div>
      </div>
    </div>
  );
}
