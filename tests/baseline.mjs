// The build the benches compare against. `--base <ref>:<path>` takes a single-file card stored in git (the
// pre-split history); `--base <ref>` builds that commit's src/ with esbuild. Move DEFAULT_BASE forward after
// an intended, reviewed change to how the card looks or behaves.
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSync } from 'esbuild';

export const DEFAULT_BASE = 'd36a7a3';

export function baselineJs(ref, entry = 'src/index.js', globalName) {
  if (ref.includes(':')) return execSync(`git show ${ref}`, { maxBuffer: 1 << 26 }).toString();
  const dir = mkdtempSync(join(tmpdir(), 'village-base-'));
  try {
    execSync(`git archive ${ref} src | tar -x -C ${dir}`);
    const r = buildSync({ entryPoints: [join(dir, entry)], bundle: true, format: 'iife', target: 'es2020', write: false, globalName, logLevel: 'silent' });
    return r.outputFiles[0].text;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
