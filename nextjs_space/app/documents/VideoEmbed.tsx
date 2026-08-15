import type { GuideVideo } from "@/lib/documents/types";

/**
 * Guide videos embed via YouTube's privacy-enhanced host only — no cookies
 * until play, and the CSP's docs variant allows exactly this frame origin
 * (lib/security/csp.ts). Shared by the guide pages and the series index.
 */
export function VideoEmbed({ video }: { video: GuideVideo }) {
  return (
    <figure className="my-6">
      <div
        className="relative w-full overflow-hidden rounded-bs-md border border-bs-border-100"
        style={{ paddingTop: "56.25%" }}
      >
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`}
          title={video.title}
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <figcaption className="mt-2 text-sm text-bs-fg-muted">▶ {video.title}</figcaption>
    </figure>
  );
}
