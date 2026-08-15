import type { GuideVideo } from "./types";

/**
 * Series-level videos for the /documents index — the two that introduce the
 * whole guide set rather than documenting one admin tab.
 *
 * Entries with an empty `youtubeId` are filtered out at render, so an
 * un-uploaded video simply does not appear (never a broken embed).
 */
export const SERIES_VIDEOS: GuideVideo[] = [
  { youtubeId: "JkwIK-tbTOk", title: "Why BudStacks" },
  { youtubeId: "YVq66MjI7UI", title: "Your First 30 Minutes" },
];

export const publishedSeriesVideos = (): GuideVideo[] =>
  SERIES_VIDEOS.filter((v) => v.youtubeId.trim().length > 0);
