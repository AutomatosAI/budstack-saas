/**
 * Streaming CSV export.
 *
 * `lib/admin/csv-export.ts` is the BROWSER half — it turns an array the client
 * already holds into a download. This is the server half, and it exists because
 * an export whose size is a database question must not be built in memory
 * first: a route that does `findMany()` then `join("\n")` holds the whole result
 * set and the whole rendered file at once, and the failure mode is a request
 * that dies at exactly the moment the export got big enough to matter.
 *
 * The caller supplies a page function keyed on a cursor; this drives it lazily
 * from the stream's own backpressure, so the process holds one page at a time
 * however long the file is.
 */

/** Excel reads a CSV as the local codepage without this, mangling any accent. */
const UTF8_BOM = "\uFEFF";

const LINE_END = "\n";

/**
 * A field starting with any of these executes as a formula when the export is
 * opened in Excel or Sheets. Prefixing with an apostrophe renders it as text
 * and is ignored by every CSV parser — the same neutralization the impersonation
 * audit export applies, for the same reason.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** RFC 4180 quoting, plus the formula neutralization above. Always quoted. */
export function csvField(value: unknown): string {
  const raw =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  const neutralized = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export function csvRow(values: readonly unknown[]): string {
  return values.map(csvField).join(",");
}

export interface CsvPage<T> {
  readonly rows: readonly T[];
  /** Cursor for the next page, or null when this was the last one. */
  readonly nextCursor: string | null;
}

export interface StreamCsvOptions<T> {
  readonly header: readonly string[];
  /** Called with null first, then with whatever the previous page returned. */
  readonly fetchPage: (cursor: string | null) => Promise<CsvPage<T>>;
  readonly toRow: (item: T) => readonly unknown[];
  /**
   * Runaway guard, not a product limit. Callers set it above anything their
   * data can reach, so hitting it means the page function is not advancing its
   * cursor — a loop that would otherwise stream forever.
   */
  readonly maxRows: number;
}

/**
 * A CSV of every row the page function yields, emitted as it is read.
 *
 * A page that throws ERRORS the stream rather than closing it: the client sees
 * a broken download instead of a short file that looks complete, which is the
 * only honest outcome once bytes have already been sent with a 200.
 */
export function streamCsv<T>(options: StreamCsvOptions<T>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cursor: string | null = null;
  let exhausted = false;
  let written = 0;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(UTF8_BOM + csvRow(options.header) + LINE_END),
      );
    },
    async pull(controller) {
      if (exhausted) {
        controller.close();
        return;
      }

      try {
        const page = await options.fetchPage(cursor);
        const remaining = options.maxRows - written;
        const rows = page.rows.slice(0, Math.max(0, remaining));

        if (rows.length > 0) {
          const chunk = rows
            .map((row) => csvRow(options.toRow(row)) + LINE_END)
            .join("");
          controller.enqueue(encoder.encode(chunk));
          written += rows.length;
        }

        cursor = page.nextCursor;
        exhausted = cursor === null || written >= options.maxRows;
        if (exhausted) controller.close();
      } catch (error) {
        controller.error(
          error instanceof Error ? error : new Error("CSV export failed"),
        );
      }
    },
  });
}
