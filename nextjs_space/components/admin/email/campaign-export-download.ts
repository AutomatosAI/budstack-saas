"use client";

/**
 * US-026 — pulling the recipient CSV down from the browser.
 *
 * A plain `<a download>` would be one line, and it is the wrong line: the
 * export can answer 403, 404 or 429, and an anchor saves whichever of those
 * JSON bodies came back AS the CSV file. Fetching first means a refusal is a
 * sentence the author reads on the page rather than a file named
 * `campaign-...csv` containing `{"error":"..."}`.
 *
 * The server names the file (`Content-Disposition`); this only unwraps it.
 */

const DEFAULT_FILENAME = "campaign-recipients.csv";

const FALLBACK_MESSAGE = "Could not export the recipients for this campaign";

/** `attachment; filename="x.csv"` → `x.csv`, or the fallback. */
function filenameFromDisposition(header: string | null): string {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] ?? DEFAULT_FILENAME;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download one campaign's recipient CSV, or throw the server's own sentence.
 *
 * No BOM is added here — the stream already carries one, and a second would
 * show up as a stray character in the first cell.
 */
export async function downloadCampaignRecipients(
  campaignId: string,
): Promise<void> {
  const response = await fetch(
    `/api/tenant-admin/campaigns/${campaignId}/recipients/export`,
  ).catch(() => {
    throw new Error(FALLBACK_MESSAGE);
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || FALLBACK_MESSAGE);
  }

  saveBlob(
    await response.blob(),
    filenameFromDisposition(response.headers.get("Content-Disposition")),
  );
}
