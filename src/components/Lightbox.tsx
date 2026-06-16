import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Slide } from '../types';
import { SlidePreview } from './SlidePreview';

interface BaseProps {
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}

interface SlideLightboxProps extends BaseProps {
  slides: Slide[];
}

interface ImageLightboxProps extends BaseProps {
  images: string[];
}

function useLightboxKeys({ count, index, onIndex, onClose }: BaseProps & { count: number }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
      if (event.key === 'ArrowRight') onIndex(Math.min(count - 1, index + 1));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [count, index, onClose, onIndex]);
}

function Shell({
  count,
  index,
  onIndex,
  onClose,
  children,
}: BaseProps & { count: number; children: React.ReactNode }) {
  useLightboxKeys({ count, index, onIndex, onClose });
  const canPrev = index > 0;
  const canNext = index < count - 1;

  return (
    <div className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <button
        onClick={onClose}
        aria-label="Close preview"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
      >
        <X size={20} />
      </button>

      {count > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (canPrev) onIndex(index - 1);
            }}
            disabled={!canPrev}
            aria-label="Previous image"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 flex items-center justify-center"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (canNext) onIndex(index + 1);
            }}
            disabled={!canNext}
            aria-label="Next image"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 flex items-center justify-center"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      <div
        className="aspect-[9/16]"
        style={{ width: 'min(88vw, calc(88vh * 9 / 16))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>

      {count > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[12px] text-white tabular-nums">
          {index + 1} / {count}
        </div>
      )}
    </div>
  );
}

export function SlideLightbox({ slides, index, onIndex, onClose }: SlideLightboxProps) {
  if (!slides.length) return null;
  const safeIndex = Math.max(0, Math.min(index, slides.length - 1));

  return (
    <Shell count={slides.length} index={safeIndex} onIndex={onIndex} onClose={onClose}>
      <SlidePreview slide={slides[safeIndex]} className="w-full h-full rounded-xl shadow-2xl" />
    </Shell>
  );
}

export function ImageLightbox({ images, index, onIndex, onClose }: ImageLightboxProps) {
  if (!images.length) return null;
  const safeIndex = Math.max(0, Math.min(index, images.length - 1));

  return (
    <Shell count={images.length} index={safeIndex} onIndex={onIndex} onClose={onClose}>
      <img src={images[safeIndex]} alt="" className="w-full h-full object-contain rounded-xl shadow-2xl" />
    </Shell>
  );
}
