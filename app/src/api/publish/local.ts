/**
 * Local archive publish target.
 *
 * Writes each published draft to:
 *   <document>/expresser/YYYY-MM-DD/<timestamp>.m4a   (audio blob, if present)
 *   <document>/expresser/YYYY-MM-DD/<timestamp>.txt   (transcript text)
 *   <document>/expresser/YYYY-MM-DD/<timestamp>.json  (metadata)
 *
 * Uses the SDK 54 expo-file-system API (File / Directory / Paths).
 * Returns the directory URI that was written to.
 */

import { Directory, File, Paths } from 'expo-file-system';
import type { DraftPayload } from '../../types';

/** Format a Date as YYYY-MM-DD (local time). */
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Archive a draft to the device's document directory.
 *
 * @returns The directory URI that was written to.
 */
export async function publishLocal(payload: DraftPayload): Promise<string> {
  const date = fmtDate(new Date(payload.createdAt));
  const timestamp = payload.createdAt.toString();

  // Build the target directory: <document>/expresser/YYYY-MM-DD/
  // expo-file-system v19 throws "containing folder doesn't exist" if the
  // parent (`expresser/`) hasn't been created yet, so create it idempotently
  // first. `intermediates: true` is also passed defensively in case the API
  // changes to support it natively.
  const parent = new Directory(Paths.document, 'expresser');
  if (!parent.exists) {
    parent.create({ intermediates: true, idempotent: true });
  }
  const dir = new Directory(parent, date);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }

  // Collect transcript text from voice pieces
  const transcript = payload.pieces
    .filter((p) => p.kind === 'voice' && p.text)
    .map((p) => p.text ?? '')
    .join('\n');

  // Write transcript (.txt)
  const txtFile = new File(dir, `${timestamp}.txt`);
  txtFile.write(transcript);

  // Write metadata (.json)
  const meta = JSON.stringify(
    {
      createdAt: payload.createdAt,
      pieces: payload.pieces.map(({ id, kind, t, dur, tag, text, cover }) => ({
        id,
        kind,
        t,
        dur,
        tag,
        text,
        cover,
      })),
    },
    null,
    2,
  );
  const jsonFile = new File(dir, `${timestamp}.json`);
  jsonFile.write(meta);

  // Copy audio blob if present (first voice piece with a local file URI)
  const audioPiece = payload.pieces.find((p) => p.kind === 'voice' && p.blobUri);
  if (audioPiece?.blobUri) {
    const dest = new File(dir, `${timestamp}.m4a`);
    const src = new File(audioPiece.blobUri);
    src.copy(dest);
  }

  return dir.uri;
}
