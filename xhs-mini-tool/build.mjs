#!/usr/bin/env node
// Deterministic build of an offline mini-tool ZIP (all packaging deps are system tools).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.dirname(new URL(import.meta.url).pathname);
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const release = path.join(root, 'release');
const zipPath = path.join(release, 'pawcream-xhs-mini-tool.zip');
const files = [
  'index.html', 'styles.css', 'app.js',
  'assets/pink-portrait.png', 'assets/pink-wide.png', 'assets/pink-four.png',
];
const fail = message => { throw new Error(message); };
const required = file => {
  const source = path.join(src, file);
  if (!fs.existsSync(source)) fail('Missing mini-tool source: ' + file);
  return source;
};
const html = fs.readFileSync(required('index.html'), 'utf8');
const js = fs.readFileSync(required('app.js'), 'utf8');
const css = fs.readFileSync(required('styles.css'), 'utf8');
if (!html.startsWith('<!DOCTYPE html>')) fail('index.html must start with DOCTYPE');
if (!html.includes('lang="zh-CN"') || !html.includes('viewport-fit=cover')) fail('Missing HTML locale or viewport');
if (!html.includes('<script src="./app.js"></script>') || !html.includes('href="./styles.css"')) fail('Invalid relative local entry refs');
if (/<script(?!\s+src=)[^>]*>/i.test(html) || /\bon[a-z]+\s*=/i.test(html)) fail('Inline scripts or event handlers are not permitted');
if (/type=["']module["']/i.test(html) || /<iframe\b|<object\b|<base\b/i.test(html)) fail('Unsupported DOM embedded resource');
if (/\b(?:eval|Function|fetch|WebSocket|XMLHttpRequest|Worker)\s*\(/.test(js)) fail('Unsupported runtime capability');
if (/\b(?:import|export)\s+(?:from|\{|default)/.test(js)) fail('Module syntax in classic script');
if (/\?\.|\?\?/.test(js)) fail('JS beyond Chrome 61 baseline');
if (/https?:\/\//.test(html + js + css)) fail('Remote URL referenced in offline entry');
if (/onclick\s*=|javascript:/.test(html + js)) fail('Inline event handlers or JS URI');
execFileSync('node', ['--check', path.join(src, 'app.js')], { stdio: 'inherit' });
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(release, { recursive: true });
let uncompressed = 0;
for (const file of files) {
  const target = path.join(dist, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(required(file), target);
  uncompressed += fs.statSync(target).size;
}
fs.rmSync(zipPath, { force: true });
execFileSync('zip', ['-q', '-X', '-9', '-r', zipPath, '.'], { cwd: dist, stdio: 'inherit' });
const zipBytes = fs.statSync(zipPath).size;
if (zipBytes > 10 * 1024 * 1024) fail('ZIP exceeds 10 MiB');
const audit = path.resolve(root, '../../.skill/minitool-zip-builder/scripts/audit_artifact.py');
if (!fs.existsSync(audit)) fail('Official skill audit missing: ' + audit);
const dirAudit = execFileSync('python3', [audit, dist], { encoding: 'utf8' }).trim();
const zipAudit = execFileSync('python3', [audit, zipPath], { encoding: 'utf8' }).trim();
const list = execFileSync('unzip', ['-Z', '-1', zipPath], { encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean);
if (!list.includes('index.html') || list.some(f => f.startsWith('../') || f.startsWith('/'))) {
  fail('ZIP entry point or path traversal error');
}
const report = {
  skillArchive: 'minitool-zip-builder-1.7.0.skill',
  skillArchiveSha256: '8bd0f4fde976ec3e9784bebc9fd8d16270769c129b39098698fc58572716c305',
  internalSkillVersion: '1.6.0',
  status: 'STATIC_PASS_DEVICE_PENDING',
  entry: 'index.html',
  files: list,
  zipBytes,
  sourceBytes: uncompressed,
  noNetwork: true,
  classicScript: true,
  noInlineScript: true,
  minJsTarget: 'Chrome 61 / ES2017 (static review)',
  apiContract: 'official skill local js-api.md snapshot; live docs unavailable',
  realDeviceTested: false,
  simulatorTested: false,
  note: 'Must test exact ZIP in creator platform simulator, Android and iOS clients.',
  directoryAudit: dirAudit,
  zipAudit,
};
const resultPath = path.join(release, 'validation-summary.json');
fs.writeFileSync(resultPath, JSON.stringify(report, null, 2) + '\n');
console.log('PawCream XHS mini-tool built: ' + zipPath);
console.log('Uncompressed: ' + uncompressed + ' bytes');
console.log('ZIP: ' + zipBytes + ' bytes (' + (zipBytes / 1024 / 1024).toFixed(2) + ' MiB)');
console.log(dirAudit);
console.log(zipAudit);
console.log('Summary: ' + resultPath);
