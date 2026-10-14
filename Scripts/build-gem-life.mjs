#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed; packaging stopped.`);
}
run('npm', ['run', 'build'], path.join(root, 'Console'));
const source = path.join(root, 'Console/dist');
const target = path.join(root, 'GemLifeHost/Resources/Console');
if (!existsSync(path.join(source, 'index.html'))) throw new Error('Production index is missing.');
// Only this generated folder is replaced; preserve its tracked placeholder.
for (const entry of readdirSync(target)) if (entry !== 'README.txt') rmSync(path.join(target, entry), { recursive: true });
cpSync(source, target, { recursive: true });
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
const dirty = spawnSync('git', ['diff', '--quiet', 'HEAD'], { cwd: root }).status !== 0;
writeFileSync(path.join(target, 'build-version.json'), JSON.stringify({ revision: revision.status === 0 ? revision.stdout.trim() : 'local', dirty, builtAt: new Date().toISOString() }) + '\n');
if (!process.argv.includes('--assets-only')) {
  run('swift', ['build', '-c', 'release', '--product', 'GemLifeHost']);
  run('swift', ['build', '-c', 'release', '--product', 'GemsForgeAPI']);
}
console.log('Gem Life production assets staged. Use GEM_LIFE_PRODUCTION=1 swift run GemLife to launch.');
