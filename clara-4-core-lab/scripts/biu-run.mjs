#!/usr/bin/env node
import { stdin, stdout, stderr, env, argv, exit } from 'node:process';

const ENDPOINT = 'https://clara-4-core-lab.vercel.app/api/ace';
const MODE = argv.includes('--write') ? 'write' : 'check';
const DEFAULT_INPUT = `BIU extract uit ChatGPT-gesprek:

Project Clara Core Lab / ACE:
- BIU v2 splitst multi-project extracts in losse ACE-calls.
- ACE blijft het systeem, BIU is de methode.

Project LaLampe:
- De workshopflow moet simpeler worden.

Project Begeister:
- Grenzen tussen Begeister, LaLampe en autonoom werk blijven een open aandachtspunt.

Misc:
- Niet-projectmatige signalen mogen naar misc of inbox.`;

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (chunk) => { data += chunk; });
    stdin.on('end', () => resolve(data));
  });
}

function hasContent(lines) {
  return lines.some((line) => line.trim());
}

function normalizeTitle(raw) {
  return raw
    .replace(/^#{1,6}\s*/, '')
    .replace(/^Project\s+/i, '')
    .replace(/:\s*$/, '')
    .trim();
}

function sectionTitle(line) {
  const trimmed = line.trim();
  const colon = trimmed.match(/^Project\s+(Clara Core Lab\s*\/\s*ACE|Clara|LaLampe|Begeister|AFK\s*\/\s*Landjuweel\s*\/\s*Amarte)\s*:\s*$/i);
  if (colon) return normalizeTitle(colon[0]);
  const misc = trimmed.match(/^(Misc|Inbox)\s*:\s*$/i);
  if (misc) return normalizeTitle(misc[0]);
  const heading = trimmed.match(/^#{2,6}\s+(Clara Core Lab\s*\/\s*ACE|Clara|LaLampe|Begeister|AFK\s*\/\s*Landjuweel\s*\/\s*Amarte|Misc|Inbox)\s*$/i);
  if (heading) return normalizeTitle(heading[0]);
  return null;
}

function splitSections(input) {
  const lines = String(input || '').split(/\r?\n/);
  const sections = [];
  let current = null;
  const intro = [];

  for (const line of lines) {
    const title = sectionTitle(line);
    if (title) {
      if (current && hasContent(current.lines)) sections.push(current);
      current = { section_title: title, lines: [line] };
      continue;
    }
    if (current) current.lines.push(line);
    else intro.push(line);
  }

  if (current && hasContent(current.lines)) sections.push(current);
  if (!sections.length && hasContent(lines)) {
    return [{ section_title: 'BIU extract', text: String(input).trim() }];
  }

  const prefix = intro.filter((line) => line.trim()).join('\n').trim();
  return sections
    .map((section) => ({
      section_title: section.section_title,
      text: [prefix, section.lines.join('\n').trim()].filter(Boolean).join('\n\n')
    }))
    .filter((section) => section.text.trim());
}

function projectHintForSection(title) {
  if (/clara core lab|ace/i.test(title)) return 'clara-core-lab';
  if (/^clara$/i.test(title)) return 'clara';
  if (/lalampe/i.test(title)) return 'lalampe';
  if (/begeister/i.test(title)) return 'begeister';
  if (/afk|landjuweel|amarte/i.test(title)) return 'afk-landjuweel-amarte';
  return '';
}

async function postSection(section, secret) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-ACE-SECRET': secret
    },
    body: JSON.stringify({
      input: section.text,
      source: 'biu',
      mode: MODE,
      project_hint: projectHintForSection(section.section_title)
    }),
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json().catch(() => ({ ok: false, error: 'Invalid JSON response' }));
  return {
    section_title: section.section_title,
    ok: data.ok === true,
    mode: data.mode || MODE,
    route: data.route || null,
    project: data.project || null,
    target_file: data.target_file || null,
    written: data.written === true,
    summary: data.summary || '',
    warnings: data.warnings || [],
    error: data.error || (data.ok === false ? data.reason || 'Request failed' : null)
  };
}

async function main() {
  const input = env.BIU_INPUT && env.BIU_INPUT.trim() ? env.BIU_INPUT : (await readStdin()).trim() || DEFAULT_INPUT;
  const secret = env.ACE_ACTION_SECRET || '';
  if (!secret.trim()) {
    stderr.write('Fout: ACE_ACTION_SECRET ontbreekt. Shell-wrapper hoort die stil te vragen.\n');
    exit(1);
  }

  const sections = splitSections(input);
  stderr.write(`BIU ${MODE} start: ${sections.length} sectie(s).\n`);
  const results = [];
  for (const section of sections) {
    stderr.write(`- ${section.section_title}\n`);
    try {
      results.push(await postSection(section, secret));
    } catch (error) {
      results.push({
        section_title: section.section_title,
        ok: false,
        mode: MODE,
        route: null,
        project: null,
        target_file: null,
        written: false,
        summary: '',
        warnings: [],
        error: error?.message || String(error)
      });
    }
  }

  const successfulWrites = results.filter((result) => result.written).length;
  const failedSections = results.filter((result) => !result.ok).map((result) => result.section_title);
  const output = {
    ok: failedSections.length === 0,
    mode: MODE,
    total_sections: sections.length,
    successful_writes: successfulWrites,
    failed_sections: failedSections,
    sections: results
  };
  stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
