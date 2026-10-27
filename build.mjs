// Bundles src/ into one file for Home Assistant: dist/pixel-village-card.js.
//   node build.mjs          production build
//   node build.mjs --dev    also dist/pixel-village-card.dev.js, which exposes the internals as
//                           window.CompanionVillage for tests and sprite sheets
//   node build.mjs --watch  rebuild on every change
import { build, context } from 'esbuild';
import { readFileSync } from 'node:fs';

const version = readFileSync('src/version.js', 'utf8').match(/'([^']+)'/)[1];
const args = process.argv.slice(2);
const common = {
  bundle: true,
  format: 'iife', // nothing leaks into the page, so it can run next to v1 (pixel-village-card)
  target: 'es2020',
  legalComments: 'inline',
  banner: { js: `/* HA Companion Village v${version} | MIT | https://github.com/frankdeluxe5k/pixel-village-card */` },
  logLevel: 'info',
};
const builds = [{ ...common, entryPoints: ['src/index.js'], outfile: 'dist/pixel-village-card.js' }];
if (args.includes('--dev') || args.includes('--watch')) {
  builds.push({ ...common, entryPoints: ['src/dev.js'], outfile: 'dist/pixel-village-card.dev.js', globalName: 'CompanionVillage' });
}
if (args.includes('--watch')) {
  for (const b of builds) await (await context(b)).watch();
} else {
  await Promise.all(builds.map((b) => build(b)));
}
