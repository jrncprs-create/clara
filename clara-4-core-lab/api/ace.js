import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECTS = new Set(['clara', 'clara-core-lab', 'lalampe', 'begeister', 'afk-landjuweel-amarte']);
const TARGETS = new Map([
  ['clara', 'projectbrain/raw/clara.md'],
  ['clara-core-lab', 'projectbrain/raw/clara-core-lab.md'],
  ['lalampe', 'projectbrain/raw/lalampe.md'],
  ['begeister', 'projectbrain/raw/begeister.md'],
  ['afk-landjuweel-amarte', 'projectbrain/raw/afk-landjuweel-amarte.md'],
  ['misc', 'projectbrain/misc/personal.md'],
  ['inbox', 'projectbrain/raw/_inbox.md'],
  ['category_suggestion', 'projectbrain/raw/_category_suggestions.md']
]);

const PROJECT_ALIASES = [
  ['lalampe', /\b(lalampe|lampenworkshop|lamp workshop|workshopflow|lampenkappen)\b/i, 120],
  ['begeister', /\b(begeister|marlon|samenwerking|rollen|verdeling)\b/i, 120],
  ['afk-landjuweel-amarte', /\b(afk|landjuweel|amarte|nachtdiertjes|ruigoord|lichtbeeldenroute)\b/i, 120],
  ['clara-core-lab', /\b(clara core lab|core lab|projectbrain|automatic chatgpt export)\b/i, 90],
  ['clara-core-lab', /\b(ace)\b/i, 35],
  ['clara', /\b(clara 3|clara assistant)\b/i, 80],
  ['clara', /\b(clara)\b/i, 45]
];

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function checkActionAuth(req) {
  const secret = process.env.ACE_ACTION_SECRET;
  if (!secret) {
    return {
      ok: true,
      warning: 'ACE_ACTION_SECRET is not set; endpoint is unprotected in this environment'
    };
  }
  return { ok: getHeader(req, 'x-ace-secret') === secret };
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function normalizeInput(body) {
  const input = String(body.input || '').trim();
  const mode = body.mode === 'write' ? 'write' : 'check';
  return {
    input,
    source: String(body.source || 'chatgpt').trim().slice(0, 80) || 'chatgpt',
    mode,
    conversation_title: body.conversation_title ? String(body.conversation_title).trim().slice(0, 160) : '',
    project_hint: body.project_hint ? String(body.project_hint).trim().slice(0, 80) : ''
  };
}

function truncate(value, max = 1200) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function blockquote(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n');
}

function confidenceFor(route) {
  if (route === 'project') return 0.78;
  if (route === 'misc') return 0.66;
  if (route === 'category_suggestion') return 0.7;
  if (route === 'ignore') return 0.72;
  return 0.5;
}

function summarize(input) {
  const text = truncate(input, 220);
  return text || 'Geen bruikbare input.';
}

function detectProject(input, hint = '') {
  const text = `${hint}\n${input}`;
  let best = null;
  for (const [project, pattern, score] of PROJECT_ALIASES) {
    if (!pattern.test(text)) continue;
    if (!best || score > best.score) best = { project, score };
  }
  return best?.project || null;
}

function looksLikeCategorySuggestion(input) {
  return /\b(steeds vaker|aparte categorie|nieuwe categorie|apart bewaken|categorie maken)\b/i.test(input) &&
    /\b(festival|inschrijv|deadline|fusion)\b/i.test(input);
}

function looksMisc(input) {
  return /\b(fusion|inschrijving|deadline|sluit|beslissen|herinner|reminder|overmorgen|morgen|vandaag|moet nog)\b/i.test(input);
}

function looksIgnore(input) {
  return /\b(welke film|lijkt op|filmtip|filmadvies|wat is|wie is|hoe heet)\b/i.test(input) && !looksMisc(input);
}

function classifyHeuristically(payload) {
  const { input, project_hint } = payload;
  const project = detectProject(input, project_hint);
  if (!input) {
    return { route: 'ignore', project: null, summary: 'Lege input.', reason: 'Geen input om te exporteren.', requires_user_approval: false };
  }
  if (looksLikeCategorySuggestion(input)) {
    return { route: 'category_suggestion', project: null, summary: summarize(input), reason: 'Input suggereert een terugkerende categorie die nog niet automatisch mag worden aangemaakt.', requires_user_approval: true };
  }
  if (project && PROJECTS.has(project)) {
    return { route: 'project', project, summary: summarize(input), reason: `Input matcht projectalias voor ${project}.`, requires_user_approval: false };
  }
  if (looksIgnore(input)) {
    return { route: 'ignore', project: null, summary: summarize(input), reason: 'Losse informatievraag zonder duidelijke vervolgwaarde voor Projectbrain.', requires_user_approval: false };
  }
  if (looksMisc(input)) {
    return { route: 'misc', project: null, summary: summarize(input), reason: 'Persoonlijk/praktisch signaal zonder bekend project.', requires_user_approval: false };
  }
  return { route: 'inbox', project: null, summary: summarize(input), reason: 'Relevant of mogelijk relevant, maar project/categorie blijft onzeker.', requires_user_approval: false };
}

async function classifyWithAI(payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL_ACE || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content: 'Classify ACE export input. Return only JSON with route, project, summary, reason, requires_user_approval. Routes: project, misc, inbox, category_suggestion, ignore. Projects: clara, clara-core-lab, lalampe, begeister, afk-landjuweel-amarte. Never invent new project names.'
          },
          {
            role: 'user',
            content: JSON.stringify({
              input: payload.input,
              source: payload.source,
              conversation_title: payload.conversation_title,
              project_hint: payload.project_hint
            })
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'ace_classification',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['route', 'project', 'summary', 'reason', 'requires_user_approval'],
              properties: {
                route: { type: 'string', enum: ['project', 'misc', 'inbox', 'category_suggestion', 'ignore'] },
                project: { type: ['string', 'null'], enum: ['clara', 'clara-core-lab', 'lalampe', 'begeister', 'afk-landjuweel-amarte', null] },
                summary: { type: 'string' },
                reason: { type: 'string' },
                requires_user_approval: { type: 'boolean' }
              }
            }
          }
        }
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.output_text || data.output?.flatMap((item) => item.content || []).find((part) => part.type === 'output_text')?.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function resolveTargetFile(route, project) {
  if (route === 'ignore') return null;
  if (route === 'project') {
    if (!PROJECTS.has(project)) return TARGETS.get('inbox');
    return TARGETS.get(project);
  }
  if (route === 'misc') return TARGETS.get('misc');
  if (route === 'inbox') return TARGETS.get('inbox');
  if (route === 'category_suggestion') return TARGETS.get('category_suggestion');
  return null;
}

function projectbrainRoot() {
  const apiDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(apiDir, '../../projectbrain');
}

function safeAbsoluteTarget(targetFile) {
  if (!targetFile) return null;
  const allowed = new Set(TARGETS.values());
  if (!allowed.has(targetFile)) throw new Error('Unsafe target file');
  const root = projectbrainRoot();
  const relative = targetFile.replace(/^projectbrain\//, '');
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error('Unsafe target path');
  return absolute;
}

function signalLines(input) {
  const out = [];
  if (/\b(besluit|gekozen|richting)\b/i.test(input)) out.push('Beslissing/richting genoemd in ChatGPT-input.');
  if (/\b(deadline|sluit|overmorgen|morgen|datum)\b/i.test(input)) out.push('Mogelijk datum- of deadlinesignaal.');
  if (/\b(moet|actie|uitzoeken|bestellen|maken|schrijven|beslissen)\b/i.test(input)) out.push('Mogelijke vervolgactie genoemd.');
  if (!out.length) out.push('Recent signaal uit ChatGPT-input.');
  return out;
}

function categorySlug(input) {
  if (/\bfusion|festival|inschrijv|deadline/i.test(input)) return 'festival-deadlines';
  return 'nieuwe-categorie';
}

function buildMarkdownEntry(payload, classification, targetFile) {
  const ts = new Date().toISOString();
  const confidence = confidenceFor(classification.route);
  const raw = blockquote(payload.input);
  if (classification.route === 'project') {
    return `\n\n## ACE update — ${ts}\n- Source: ${payload.source}\n- Route: project\n- Project: ${classification.project}\n- Confidence: ${confidence}\n- Summary: ${classification.summary}\n- Signals:\n${signalLines(payload.input).map((line) => `  - ${line}`).join('\n')}\n- Raw input:\n${raw}\n`;
  }
  if (classification.route === 'misc') {
    const dateSignal = /\b(overmorgen|morgen|vandaag|deadline|sluit)\b/i.test(payload.input) ? 'Ja, mogelijk later checken.' : 'Geen duidelijk datumsignaal.';
    return `\n\n## ACE misc — ${ts}\n- Source: ${payload.source}\n- Route: misc\n- Summary: ${classification.summary}\n- Possible Clara check: Later navragen of dit nog relevant is.\n- Date/deadline signal: ${dateSignal}\n- Raw input:\n${raw}\n`;
  }
  if (classification.route === 'inbox') {
    return `\n\n## ACE inbox — ${ts}\n- Source: ${payload.source}\n- Route: inbox\n- Why inbox: ${classification.reason}\n- Summary: ${classification.summary}\n- Raw input:\n${raw}\n`;
  }
  if (classification.route === 'category_suggestion') {
    const slug = categorySlug(payload.input);
    return `\n\n## ACE category suggestion — ${ts}\n- Source: ${payload.source}\n- Suggested category: ${slug}\n- Requires user approval: true\n- Why: ${classification.reason}\n- Examples/signals:\n  - ${classification.summary}\n- Possible actions for Jeroen:\n  - categorie maken\n  - onder misc laten\n  - aan bestaand project koppelen\n  - naar inbox verplaatsen\n  - negeren\n- Raw input:\n${raw}\n`;
  }
  return '';
}

async function safeAppendMarkdown(targetFile, markdown) {
  const absolute = safeAbsoluteTarget(targetFile);
  if (!absolute) return false;
  await mkdir(path.dirname(absolute), { recursive: true });
  await appendFile(absolute, markdown, 'utf8');
  return true;
}

async function githubRequest({ token, method = 'GET', url, body }) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(`GitHub request failed: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function getGithubFile({ token, owner, repo, targetFile, ref }) {
  try {
    const file = await githubRequest({
      token,
      url: `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(targetFile).replace(/%2F/g, '/')}?ref=${encodeURIComponent(ref)}`
    });
    return {
      exists: true,
      sha: file.sha,
      content: Buffer.from(file.content || '', 'base64').toString('utf8')
    };
  } catch (error) {
    if (error.status === 404) return { exists: false, sha: null, content: '' };
    throw error;
  }
}

async function putGithubFile({ token, owner, repo, targetFile, branch, content, sha }) {
  return githubRequest({
    token,
    method: 'PUT',
    url: `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(targetFile).replace(/%2F/g, '/')}`,
    body: {
      message: `ACE update ${targetFile}`,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch,
      ...(sha ? { sha } : {})
    }
  });
}

function githubConfig() {
  const token = process.env.PROJECTBRAIN_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  const targetRepo = process.env.PROJECTBRAIN_REPO || 'jrncprs-create/clara';
  const branch = process.env.PROJECTBRAIN_BASE_BRANCH || 'main';
  const [owner, repo] = targetRepo.split('/');
  return { token, owner, repo, branch };
}

function shouldUseGithubWrite() {
  return process.env.VERCEL === '1' || process.env.VERCEL_ENV === 'production' || Boolean(process.env.PROJECTBRAIN_GITHUB_TOKEN || process.env.GITHUB_TOKEN);
}

async function appendMarkdown(targetFile, markdown) {
  if (!targetFile) return false;
  const allowed = new Set(TARGETS.values());
  if (!allowed.has(targetFile)) throw new Error('Unsafe target file');

  if (shouldUseGithubWrite()) {
    const { token, owner, repo, branch } = githubConfig();
    if (!token) throw new Error('Missing PROJECTBRAIN_GITHUB_TOKEN or GITHUB_TOKEN for ACE write');
    if (!owner || !repo) throw new Error('Invalid PROJECTBRAIN_REPO. Use owner/repo.');
    const current = await getGithubFile({ token, owner, repo, targetFile, ref: branch });
    await putGithubFile({
      token,
      owner,
      repo,
      targetFile,
      branch,
      content: `${current.content || ''}${markdown}`,
      sha: current.exists ? current.sha : null
    });
    return true;
  }

  return safeAppendMarkdown(targetFile, markdown);
}

function normalizeClassification(raw, fallback) {
  const route = ['project', 'misc', 'inbox', 'category_suggestion', 'ignore'].includes(raw?.route) ? raw.route : fallback.route;
  const project = route === 'project' && PROJECTS.has(raw?.project) ? raw.project : route === 'project' ? fallback.project : null;
  return {
    route,
    project,
    summary: truncate(raw?.summary || fallback.summary, 300),
    reason: truncate(raw?.reason || fallback.reason, 300),
    requires_user_approval: route === 'category_suggestion' || raw?.requires_user_approval === true
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { ok: false, mode: 'check', route: 'ignore', project: null, target_file: null, summary: '', written: false, requires_user_approval: false, reason: 'Method not allowed', warnings: ['Use POST'] });
    }

    const auth = checkActionAuth(req);
    if (!auth.ok) {
      return sendJson(res, 401, { ok: false, error: 'Unauthorized', written: false });
    }

    const payload = normalizeInput(await readJsonBody(req));
    const warnings = [];
    if (auth.warning) warnings.push(auth.warning);
    if (!payload.input) warnings.push('Missing input');

    const fallback = classifyHeuristically(payload);
    let ai = null;
    if (fallback.route === 'inbox') ai = await classifyWithAI(payload);
    if (fallback.route === 'inbox' && !ai) warnings.push('AI classifier unavailable; used heuristic fallback.');
    const classification = normalizeClassification(ai || fallback, fallback);
    const targetFile = resolveTargetFile(classification.route, classification.project);

    let written = false;
    if (payload.mode === 'write' && classification.route !== 'ignore' && targetFile) {
      const markdown = buildMarkdownEntry(payload, classification, targetFile);
      written = await appendMarkdown(targetFile, markdown);
    }

    return sendJson(res, 200, {
      ok: true,
      mode: payload.mode,
      route: classification.route,
      project: classification.project,
      target_file: targetFile,
      summary: classification.summary,
      written,
      requires_user_approval: classification.requires_user_approval,
      reason: classification.reason,
      warnings
    });
  } catch (error) {
    return sendJson(res, 200, {
      ok: false,
      mode: 'check',
      route: 'ignore',
      project: null,
      target_file: null,
      summary: '',
      written: false,
      requires_user_approval: false,
      reason: error?.message || String(error),
      warnings: ['ACE failed; no write performed.']
    });
  }
}

export const __testables = { classifyHeuristically, detectProject, resolveTargetFile };
