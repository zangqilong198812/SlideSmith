import type { Slide } from '../types';
import { captionTextStyle, SLIDE_CONTAINER_STYLE, SIDE_PAD_PCT } from '../lib/captionStyle';

interface SlidePreviewProps {
  slide: Slide;
  className?: string;
  showText?: boolean;
  onClick?: () => void;
}

function NotesPreview({ text }: { text: string }) {
  const [title, ...body] = text.split('\n');

  return (
    <div className="absolute inset-0 bg-[#f8f5eb] text-[#191919] font-sans">
      <div className="absolute inset-x-0 top-0 h-[8.5%] bg-[#f2eddf] border-b border-black/10 flex items-center justify-between px-[6%]">
        <div className="flex items-center gap-[4%] w-[30%]">
          <span className="w-[10cqh] max-w-2.5 aspect-square rounded-full bg-[#ff5f57]" />
          <span className="w-[10cqh] max-w-2.5 aspect-square rounded-full bg-[#ffbd2e]" />
          <span className="w-[10cqh] max-w-2.5 aspect-square rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[3cqh] font-semibold text-black/35">Notes</span>
      </div>
      <div className="absolute inset-x-[7%] top-[14%] bottom-[8%]">
        <div className="text-[4.8cqh] leading-[1.08] font-bold tracking-normal whitespace-pre-wrap break-words">
          {title}
        </div>
        <div className="mt-[5%] text-[3.25cqh] leading-[1.38] font-medium tracking-normal whitespace-pre-wrap break-words">
          {body.join('\n')}
        </div>
      </div>
    </div>
  );
}

export function SlidePreview({ slide, className = '', showText = true, onClick }: SlidePreviewProps) {
  // Generated slides have no source image — render the same gradient the canvas
  // renderer uses, so the preview matches the exported PNG.
  const background = slide.imageUrl
    ? undefined
    : `linear-gradient(135deg, ${slide.bgFrom || '#0f172a'}, ${slide.bgTo || '#1e293b'})`;

  return (
    <div
      // containerType: 'size' lets the caption's `cqh` units resolve to a percent
      // of THIS slide's height, so the text scales identically to the baked PNG.
      className={`relative aspect-[9/16] rounded-md overflow-hidden bg-raised ${onClick ? 'cursor-zoom-in' : ''} ${className}`}
      style={background ? { background, ...SLIDE_CONTAINER_STYLE } : SLIDE_CONTAINER_STYLE}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {slide.imageUrl && (
        <>
          <img
            src={slide.imageUrl}
            alt=""
            className={`absolute inset-0 w-full h-full ${slide.imageFit === 'contain' ? 'object-contain bg-white' : 'object-cover'}`}
          />
          {/* Match the canvas bake's darkening (rgba(0,0,0,0.45)) for readability. */}
          {slide.darkOverlay !== false && <div className="absolute inset-0 bg-black/45" />}
        </>
      )}
      {slide.layout === 'notes' && showText ? (
        <NotesPreview text={slide.text} />
      ) : showText && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ paddingLeft: `${SIDE_PAD_PCT}%`, paddingRight: `${SIDE_PAD_PCT}%` }}
        >
          <span style={captionTextStyle()}>{slide.text}</span>
        </div>
      )}
    </div>
  );
}
