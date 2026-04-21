type Props = {
  videoUrl?: string | null;
  title: string;
  className?: string;
};

function toEmbedUrl(url: string): string | null {
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/(?:vimeo\.com\/(?:video\/)?)(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

export default function VideoPanel({ videoUrl, title, className = "" }: Props) {
  const embed = videoUrl ? toEmbedUrl(videoUrl) : null;
  const shell =
    "relative overflow-hidden rounded-2xl aspect-video shadow-[0_2px_4px_rgba(43,37,32,0.04),0_16px_40px_-24px_rgba(168,90,58,0.35)]";

  if (embed) {
    return (
      <div className={`${shell} bg-ink/5 ${className}`}>
        <iframe
          src={embed}
          title={`${title} — full recipe video`}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={`${shell} ${className}`}>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #efdbc2 0%, #e2bf99 55%, #c18a60 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(100% 70% at 20% 20%, rgba(255,245,228,0.45), transparent 55%)",
        }}
      />
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full opacity-[0.12] mix-blend-multiply"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="video-panel-dots"
            x="0"
            y="0"
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="#7a3f28" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#video-panel-dots)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-accent-ink">
        <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full border border-accent-ink/25 bg-surface/80 backdrop-blur-sm shadow-[0_4px_14px_-6px_rgba(168,90,58,0.35)]">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-7 w-7 sm:h-8 sm:w-8 translate-x-0.5"
            fill="currentColor"
          >
            <path d="M7 5.5v13a1 1 0 0 0 1.54.84l11-6.5a1 1 0 0 0 0-1.68l-11-6.5A1 1 0 0 0 7 5.5Z" />
          </svg>
        </div>
        <span className="font-serif italic text-sm tracking-[0.05em] opacity-80">
          Video coming soon
        </span>
      </div>
    </div>
  );
}
