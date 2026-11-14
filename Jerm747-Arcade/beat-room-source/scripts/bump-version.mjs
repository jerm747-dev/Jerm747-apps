// Runs before every build (npm "prebuild"): bumps the last number of the version in
// package.json (0.3.4 -> 0.3.5) so each build is numbered. The app shows it in the footer.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const file = fileURLToPath(new URL('../package.json', import.meta.url));
const pkg = JSON.parse(readFileSync(file, 'utf8'));
const [maj, min, patch] = String(pkg.version || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
pkg.version = `${maj}.${min}.${patch + 1}`;
writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Beat Room build ${pkg.version}`);
