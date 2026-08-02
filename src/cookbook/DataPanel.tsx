/**
 * Export and import.
 *
 * The honest framing matters here: Mise keeps everything in this browser and
 * nowhere else, so the file this screen produces is the only copy of six weeks
 * of technique progression that survives a "clear site data". The copy says so
 * plainly rather than hiding it behind an "Advanced" heading.
 *
 * Import replaces everything and is stated as such before the file picker, not
 * after.
 */

import { useRef, useState } from 'react';
import {
  EXPORT_TABLES,
  ImportRejected,
  downloadExport,
  exportAll,
  exportFilename,
  importAll,
  type ExportTableName,
} from './exportImport';
import { useCalibration, useCookCount, useSavedRecipes } from './hooks';
import { describeCalibration } from './calibration';

type Status =
  | { kind: 'idle' }
  | { kind: 'exported'; filename: string }
  | { kind: 'imported'; counts: Record<ExportTableName, number> }
  | { kind: 'rejected'; errors: readonly string[] };

export function DataPanel() {
  const saved = useSavedRecipes();
  const cooks = useCookCount();
  const calibration = useCalibration();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleExport() {
    const payload = await exportAll();
    const filename = downloadExport(payload, exportFilename()) ?? exportFilename();
    setStatus({ kind: 'exported', filename });
  }

  async function handleFile(file: File) {
    try {
      const report = await importAll(await file.text());
      setStatus({ kind: 'imported', counts: report.counts });
    } catch (error) {
      setStatus({
        kind: 'rejected',
        errors:
          error instanceof ImportRejected
            ? error.errors
            : [error instanceof Error ? error.message : String(error)],
      });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-gutter py-section">
      <header className="border-b border-rule pb-6">
        <h2 className="font-serif text-display">Your data</h2>
        <p className="mt-2 max-w-prose text-body text-ink-soft">
          Everything lives in this browser and nowhere else. There is no account and no sync, so
          clearing site data would take {saved.length === 1 ? '1 recipe' : `${saved.length} recipes`}{' '}
          and {cooks === 1 ? '1 logged cook' : `${cooks} logged cooks`} with it. The file below is
          the backup.
        </p>
      </header>

      <div className="mt-section">
        <h3 className="text-micro uppercase tracking-wide text-ink-muted">Export</h3>
        <p className="mt-2 max-w-prose text-body text-ink-soft">
          One JSON file containing every table: {EXPORT_TABLES.join(', ')}. Readable in a text
          editor, and the only thing standing between you and starting over.
        </p>
        <button
          type="button"
          onClick={handleExport}
          className="mt-4 min-h-tap rounded bg-accent px-6 text-small text-paper"
        >
          Download backup
        </button>
      </div>

      <div className="mt-section">
        <h3 className="text-micro uppercase tracking-wide text-ink-muted">Import</h3>
        <p className="mt-2 max-w-prose text-body text-ink-soft">
          Restoring a backup <strong className="font-normal text-ink">replaces everything</strong>{' '}
          currently in the app — recipes, cooks, technique progress, settings. A file that is
          damaged or from a newer version is refused whole; nothing is half-restored.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
          className="mt-4 block min-h-tap text-small text-ink-soft"
        />
      </div>

      <div className="mt-section border-t border-rule pt-6">
        <h3 className="text-micro uppercase tracking-wide text-ink-muted">Calibration</h3>
        <p className="mt-2 max-w-prose text-body text-ink-soft">
          {describeCalibration(calibration)}
        </p>
      </div>

      <StatusNote status={status} />
    </section>
  );
}

function StatusNote({ status }: { status: Status }) {
  if (status.kind === 'idle') return null;

  if (status.kind === 'exported') {
    return (
      <p className="mt-section text-small text-ink-muted" role="status">
        Saved as {status.filename}.
      </p>
    );
  }

  if (status.kind === 'imported') {
    const summary = EXPORT_TABLES.filter((t) => status.counts[t] > 0)
      .map((t) => `${status.counts[t]} ${t}`)
      .join(', ');
    return (
      <p className="mt-section text-small text-ink-muted" role="status">
        Restored {summary || 'an empty backup'}.
      </p>
    );
  }

  return (
    <div className="mt-section border border-rule bg-danger-wash px-4 py-3" role="alert">
      <p className="text-small text-danger">
        That file was refused, and nothing was changed. Reasons:
      </p>
      <ul className="mt-2 space-y-1">
        {status.errors.map((error) => (
          <li key={error} className="text-small text-ink-soft">
            {error}
          </li>
        ))}
      </ul>
    </div>
  );
}
