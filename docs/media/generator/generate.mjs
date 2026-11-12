// Generates the GIFs and images used in the README from the real app and real test output.
// Usage: node generate.mjs            (all scenes)
//        node generate.mjs ui chaos   (only some)
// PREVIEW_DIR=<dir> also writes a few frames of each GIF as PNGs for reviewing.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, 'scenes');
const scenes = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.mjs')).map((f) => [f.replace('.mjs', ''), join(dir, f)]));

const wanted = process.argv.slice(2);
for (const name of wanted.length ? wanted : Object.keys(scenes)) {
  if (!scenes[name]) throw new Error(`Unknown scene "${name}". Scenes: ${Object.keys(scenes).join(', ')}`);
  const { default: scene } = await import(scenes[name]);
  await scene();
}
