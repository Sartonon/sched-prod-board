// Copies app/ to dist/ and stamps the git sha (R6).
import { cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
const sha = process.env.BUILD_SHA || execSync('git rev-parse HEAD').toString().trim();
rmSync('dist', { recursive: true, force: true });
cpSync('app', 'dist', { recursive: true });
writeFileSync('dist/index.html', readFileSync('dist/index.html', 'utf8').replaceAll('__BUILD_SHA__', sha));
console.log('built', sha);
