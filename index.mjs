// FHIR R4 Validate (Anpheros): validates FHIR JSON files through POST /fhir/R4/{type}/$validate.
// No dependencies: Node 20 fetch + fs. A Bundle's entries are validated one by one.
import { appendFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const input = (name, fallback = '') => (process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] ?? fallback).trim();
const apiKey = input('api-key');
const paths = input('paths', '.').split('\n').map((p) => p.trim()).filter(Boolean);
const profile = input('profile');
const failOnWarning = input('fail-on-warning', 'false') === 'true';
const base = input('api-base', 'https://platform.anpheros.com').replace(/\/$/, '');
const SKIP_DIRS = new Set(['.git', 'node_modules', '.github']);

const escape = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const annotate = (level, file, message) => console.log(`::${level} file=${escape(file)}::${escape(message)}`);
const output = (name, value) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);

if (!apiKey) {
  console.log('::error::Set the api-key input to an Anpheros sandbox key (sk_test_…). Get one free at https://platform.anpheros.com/dashboard/');
  process.exit(1);
}
if (apiKey.startsWith('sk_live_')) {
  console.log('::error::Use a sandbox key (sk_test_…) for validation, not a production key.');
  process.exit(1);
}

function collect(path, out) {
  const st = statSync(path);
  if (st.isDirectory()) {
    for (const name of readdirSync(path)) if (!SKIP_DIRS.has(name)) collect(join(path, name), out);
  } else if (path.endsWith('.json')) {
    out.push(path);
  }
  return out;
}

async function validate(resource) {
  const url = new URL(`${base}/fhir/R4/${encodeURIComponent(resource.resourceType)}/$validate`);
  if (profile) url.searchParams.set('profile', profile);
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/fhir+json', 'User-Agent': 'anpheros-fhir-validate-action/1' },
      body: JSON.stringify(resource),
    });
    if ((r.status === 429 || r.status >= 500) && attempt < 3) {
      await new Promise((res) => setTimeout(res, 1000 * 2 ** attempt));
      continue;
    }
    const body = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) throw new Error(`The API refused the key (${r.status}): ${body.issue?.[0]?.diagnostics ?? ''}`);
    return body.issue ?? [{ severity: 'error', diagnostics: `Unexpected response ${r.status}` }];
  }
}

const files = paths.flatMap((p) => collect(p, []));
let resources = 0, errors = 0, warnings = 0, skipped = 0;
const rows = [];

for (const file of files) {
  const name = relative(process.cwd(), file) || file;
  let json;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    annotate('error', name, `Not valid JSON: ${e.message}`);
    errors++;
    continue;
  }
  if (!json || typeof json.resourceType !== 'string') continue; // not FHIR (package.json, tsconfig…)
  const items = json.resourceType === 'Bundle'
    ? (json.entry ?? []).map((e, i) => ({ resource: e.resource, where: `entry[${i}]` })).filter((x) => x.resource?.resourceType)
    : [{ resource: json, where: '' }];
  for (const { resource, where } of items) {
    const label = `${name}${where ? ` ${where}` : ''} (${resource.resourceType})`;
    let issues;
    try {
      issues = await validate(resource);
    } catch (e) {
      console.log(`::error::${escape(e.message)}`);
      process.exit(1);
    }
    if (issues.length === 1 && /not supported/i.test(issues[0].diagnostics ?? '') && issues[0].severity === 'error') {
      annotate('notice', name, `${label}: resource type not supported by the Anpheros validator, skipped.`);
      skipped++;
      continue;
    }
    resources++;
    for (const issue of issues) {
      const where = issue.expression?.length ? ` at ${issue.expression.join(', ')}` : '';
      const message = `${label}${where}: ${issue.diagnostics ?? issue.code}`;
      if (issue.severity === 'error' || issue.severity === 'fatal') {
        errors++;
        annotate('error', name, message);
        rows.push(`| ❌ | ${label} | ${(issue.diagnostics ?? '').replace(/\|/g, '\\|')} |`);
      } else if (issue.severity === 'warning') {
        warnings++;
        annotate('warning', name, message);
        rows.push(`| ⚠️ | ${label} | ${(issue.diagnostics ?? '').replace(/\|/g, '\\|')} |`);
      }
    }
  }
}

const summary = `### FHIR R4 validation\n\n${resources} resources validated in ${files.length} files: **${errors} errors**, ${warnings} warnings` +
  `${skipped ? `, ${skipped} skipped (type not supported)` : ''}.\n` +
  (rows.length ? `\n| | Resource | Issue |\n|---|---|---|\n${rows.slice(0, 200).join('\n')}\n` : '') +
  `\n<sub>Validated with the [Anpheros FHIR R4 API](https://developers.anpheros.com/guides/fhir?utm_source=github&utm_medium=action&utm_content=fhir-validate-action).</sub>\n`;
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
output('resources', resources);
output('errors', errors);
output('warnings', warnings);
if (errors > 0 || (failOnWarning && warnings > 0)) process.exit(1);
