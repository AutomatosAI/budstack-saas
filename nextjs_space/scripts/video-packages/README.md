# Video package generator

Exports every published guide from `lib/documents/registry` as plain-markdown
source material for the NotebookLM video library (see the Video Playbook).

    pnpm exec tsx scripts/video-packages/export-guide-sources.mts [outDir]

Canonical storage for the assembled per-video packages (style block + focus
prompt + source material) is S3 — `budstack-uploads/docs/video-packages/`.
Formats stay `.md` end to end; NotebookLM ingests them via file upload.
Regenerate after any guide content change so the videos' sources never drift.
