import { useState } from 'react';
import { Check, X, Sparkles, RefreshCw, Loader2, Pencil, Trash2, Download } from 'lucide-react';
import type { Slideshow } from '../types';
import { ViewHeader } from '../components/ViewHeader';
import { SlidePreview } from '../components/SlidePreview';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { SlideLightbox } from '../components/Lightbox';
import { useT } from '../i18n';
import { downloadSlideshows } from '../lib/download';

interface QueueViewProps {
  slideshows: Slideshow[];
  generating: boolean;
  canGenerate: boolean;
  selectedIds: string[];
  onGenerate: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkSchedule: () => void;
  onDeleteSelected: () => void;
}

export function QueueView({
  slideshows,
  generating,
  canGenerate,
  selectedIds,
  onGenerate,
  onApprove,
  onReject,
  onEdit,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkSchedule,
  onDeleteSelected,
}: QueueViewProps) {
  const t = useT();
  const selectedCount = selectedIds.length;
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportingSelection, setExportingSelection] = useState(false);
  const selectedSlideshows = slideshows.filter((s) => selectedIds.includes(s.id));

  const downloadOne = async (slideshow: Slideshow) => {
    setExportingId(slideshow.id);
    try {
      await downloadSlideshows([slideshow]);
    } finally {
      setExportingId(null);
    }
  };

  const downloadSelected = async () => {
    if (!selectedSlideshows.length) return;
    setExportingSelection(true);
    try {
      await downloadSlideshows(selectedSlideshows);
    } finally {
      setExportingSelection(false);
    }
  };

  return (
    <>
      <ViewHeader
        title="Queue"
        subtitle={t(
          `${slideshows.length} slideshows waiting for your review. Approve to send to the scheduler.`,
          `${slideshows.length} 条内容等待审核。满意后 Approve 发送到排程。`
        )}
        right={
          <>
            {selectedCount > 0 ? (
              <>
                <span className="text-[12px] text-ink-5">{t(`${selectedCount} selected`, `已选 ${selectedCount} 条`)}</span>
                <Button variant="primary" icon={<Check size={13} />} onClick={onBulkSchedule}>
                  {t(`Schedule ${selectedCount}`, `排程 ${selectedCount} 条`)}
                </Button>
                <Button
                  variant="secondary"
                  icon={exportingSelection ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  onClick={downloadSelected}
                  disabled={exportingSelection}
                >
                  {exportingSelection ? t('Exporting…', '导出中…') : t(`Download ${selectedCount}`, `下载 ${selectedCount} 条`)}
                </Button>
                <Button variant="danger-ghost" icon={<Trash2 size={13} />} onClick={onDeleteSelected}>
                  {t(`Delete ${selectedCount}`, `删除 ${selectedCount} 条`)}
                </Button>
                <Button variant="ghost" onClick={onClearSelection}>{t('Clear', '取消选择')}</Button>
              </>
            ) : (
              slideshows.length > 0 && (
                <Button variant="secondary" onClick={onSelectAll}>{t('Select all', '全选')}</Button>
              )
            )}
            <Button
              variant="primary"
              icon={generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={onGenerate}
              disabled={generating || !canGenerate}
            >
              {generating ? t('Generating…', '生成中…') : t('Generate more', '继续生成')}
            </Button>
          </>
        }
      />

      {slideshows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 rounded-full bg-raised flex items-center justify-center mx-auto mb-4">
              <Check size={20} className="text-ink-5" />
            </div>
            <h2 className="text-[15px] font-semibold text-ink">
              {canGenerate ? t('Queue empty', '队列为空') : t('Add your AI key to start', '先添加 AI Key')}
            </h2>
            <p className="text-[13px] text-ink-5 mt-1">
              {canGenerate
                ? t('Generate a fresh batch of slideshows with AI.', '用 AI 生成一批新的轮播内容。')
                : t('Head to Settings, paste your AI API key, and tune the Brain.', '去设置里填 AI API Key，并配置账号脑袋。')}
            </p>
            {canGenerate && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="secondary"
                  icon={generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  onClick={onGenerate}
                  disabled={generating}
                >
                  {generating ? t('Generating…', '生成中…') : t('Generate now', '现在生成')}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl mx-auto">
            {slideshows.map((s) => (
              <SlideshowCard
                key={s.id}
                slideshow={s}
                selected={selectedIds.includes(s.id)}
                onToggleSelect={() => onToggleSelect(s.id)}
                onApprove={() => onApprove(s.id)}
                onReject={() => onReject(s.id)}
                onEdit={() => onEdit(s.id)}
                onDownload={() => downloadOne(s)}
                downloading={exportingId === s.id}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

interface CardProps {
  slideshow: Slideshow;
  selected: boolean;
  onToggleSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  onDownload: () => void;
  downloading: boolean;
}

function SlideshowCard({ slideshow, selected, onToggleSelect, onApprove, onReject, onEdit, onDownload, downloading }: CardProps) {
  const t = useT();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  return (
    <div className={`bg-card border rounded-xl overflow-hidden animate-fadeIn transition-colors ${selected ? 'border-ink ring-1 ring-ink' : 'border-line'}`}>
      {/* Slide strip */}
      <div className="relative p-4 bg-surface border-b border-line">
        <label className="absolute top-2 left-2 z-10 w-6 h-6 rounded-md bg-card/90 border border-line flex items-center justify-center cursor-pointer shadow-sm">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} className="cursor-pointer" />
        </label>
        <div className="grid grid-cols-6 gap-1.5">
          {slideshow.slides.map((slide, i) => (
            <SlidePreview key={slide.id} slide={slide} onClick={() => setPreviewIndex(i)} />
          ))}
        </div>
      </div>

      {/* Meta */}
      <div className="p-4">
        <div className="flex items-start gap-2 mb-2">
          <Sparkles size={12} className="text-ink-6 mt-1 shrink-0" />
          <span className="text-[11px] text-ink-5 leading-snug">
            {slideshow.rationale}
          </span>
        </div>

        <h3 className="text-[14px] font-semibold text-ink leading-snug mb-1.5">
          {slideshow.hook}
        </h3>
        <p className="text-[12px] text-ink-4 leading-snug line-clamp-2">
          {slideshow.caption}
        </p>

        <div className="flex flex-wrap gap-1 mt-2">
          {slideshow.hashtags.map((tag) => (
            <span key={tag} className="text-[10px] text-ink-5 px-1.5 py-0.5 rounded bg-raised">
              #{tag}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-line">
          <Button variant="secondary" icon={<Pencil size={13} />} onClick={onEdit}>
            {t('Edit', '编辑')}
          </Button>
          <Button
            variant="secondary"
            icon={downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            onClick={onDownload}
            disabled={downloading}
          >
            {downloading ? t('Exporting…', '导出中…') : t('Download', '下载')}
          </Button>
          <Button
            variant="primary"
            icon={<Check size={13} />}
            onClick={onApprove}
            fullWidth
          >
            {t('Approve', '发送')}
          </Button>
          <IconButton
            variant="secondary"
            icon={<X size={13} />}
            label="Reject"
            onClick={onReject}
          />
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
