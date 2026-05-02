const DEFAULT_PROJECTS = [
  { slug: 'clara', title: 'Clara' },
  { slug: 'lalampe', title: 'LaLampe' },
  { slug: 'begeister', title: 'Begeister' },
  { slug: 'afk-landjuweel-amarte', title: 'AFK / Landjuweel / Amarte' }
];

const PROJECT_ALIASES = {
  clara: 'clara',
  'clara 3': 'clara',
  'clara 4': 'clara',
  lalampe: 'lalampe',
  'la lampe': 'lalampe',
  lampen: 'lalampe',
  begeister: 'begeister',
  afk: 'afk-landjuweel-amarte',
  amarte: 'afk-landjuweel-amarte',
  landjuweel: 'afk-landjuweel-amarte',
  ruigoord: 'afk-landjuweel-amarte',
  nachtdiertjes: 'afk-landjuweel-amarte'
};

function json(res, status, payload) {
  res.status(status).json(payload);
}

function normalizeProjectSlug(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (PROJECT_ALIASES[raw]) return PROJECT_ALIASES[raw];
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function projectTitleFromSlug(slug) {
  return DEFAULT_PROJECTS.find((project) => project.slug === slug)?.title ||
    slug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function todayAmsterdam() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function statusTemplate(slug, title) {
  return `# ${title} Status\n\n## Laatst bijgewerkt\n${todayAmsterdam()}\n\n## Strekking\nNog niet ingevuld.\n\n## Huidige fase\nNog niet ingevuld.\n\n## Laatste ontwikkeling\nNog niet ingevuld.\n\n## Beslissingen\n- Nog geen beslissingen vastgelegd.\n\n## Open acties\n- Projectstatus aanvullen.\n\n## Risico's / onduidelijkheden\n- Nog niet bekend.\n\n## Eerstvolgende stap\nProjectbrain vullen met eerste echte context.\n\n## Bronnen / laatste signalen\n- Eerste statusbestand aangemaakt voor project: ${slug}.\n`;
}

function getOutputText(data) {
  return data.output_text || data.output?.flatMap((item) => item.content || []).find((part) => part.type === 'output_text')?.text || '';
}

async function openaiJson({ apiKey, model, system, user, schema }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: schema.name,
          schema: schema.schema,
          strict: true
        }
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${JSON.stringify(data)}`);
  }

  const text = getOutputText(data);
  if (!text) throw new Error('OpenAI returned no output_text');
  return JSON.parse(text);
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

async function getDefaultBranchSha({ token, owner, repo, baseBranch }) {
  const ref = await githubRequest({
    token,
    url: `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`
  });
  return ref.object.sha;
}

async function createBranch({ token, owner, repo, branch, sha }) {
  return githubRequest({
    token,
    method: 'POST',
    url: `https://api.github.com/repos/${owner}/${repo}/git/refs`,
    body: {
      ref: `refs/heads/${branch}`,
      sha
    }
  });
}

async function getGithubFile({ token, owner, repo, path, ref }) {
  try {
    const file = await githubRequest({
      token,
      url: `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(ref)}`
    });

    const content = Buffer.from(file.content || '', 'base64').toString('utf8');
    return { exists: true, sha: file.sha, content };
  } catch (error) {
    if (error.status === 404) return { exists: false, sha: null, content: '' };
    throw error;
  }
}

async function putGithubFile({ token, owner, repo, path, branch, content, message, sha }) {
  return githubRequest({
    token,
    method: 'PUT',
    url: `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`,
    body: {
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch,
      ...(sha ? { sha } : {})
    }
  });
}

async function createPullRequest({ token, owner, repo, title, body, head, base }) {
  return githubRequest({
    token,
    method: 'POST',
    url: `https://api.github.com/repos/${owner}/${repo}/pulls`,
    body: {
      title,
      body,
      head,
      base,
      draft: false
    }
  });
}

async function detectProject({ apiKey, model, input }) {
  const schema = {
    name: 'projectbrain_detect_project',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['project_slug', 'confidence', 'reason'],
      properties: {
        project_slug: { type: 'string', enum: ['clara', 'lalampe', 'begeister', 'afk-landjuweel-amarte', 'unknown'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reason: { type: 'string' }
      }
    }
  };

  const result = await openaiJson({
    apiKey,
    model,
    schema,
    system: 'Je herkent welk project bedoeld wordt. Antwoord alleen met JSON volgens schema.',
    user: `Bekende projecten:\n${DEFAULT_PROJECTS.map((p) => `- ${p.slug}: ${p.title}`).join('\n')}\n\nInput:\n${input}`
  });

  return result;
}

async function buildUpdatedStatus({ apiKey, model, projectTitle, currentStatus, input, source, mode }) {
  const schema = {
    name: 'projectbrain_status_update',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['markdown', 'change_summary', 'detected_decisions', 'detected_actions', 'uncertainties'],
      properties: {
        markdown: { type: 'string' },
        change_summary: { type: 'string' },
        detected_decisions: { type: 'array', items: { type: 'string' } },
        detected_actions: { type: 'array', items: { type: 'string' } },
        uncertainties: { type: 'array', items: { type: 'string' } }
      }
    }
  };

  return openaiJson({
    apiKey,
    model,
    schema,
    system: `Je bent Projectbrain Extractor voor Jeroen. Werk een bestaand Markdown-statusbestand bij op basis van nieuwe ruwe input.\n\nRegels:\n- Antwoord in het Nederlands.\n- Behoud bestaande nuttige feiten.\n- Voeg alleen informatie toe die uit de nieuwe input volgt.\n- Onderscheid feiten, beslissingen, open acties en onzekerheden.\n- Verwijder geen belangrijke context tenzij die duidelijk achterhaald is.\n- Zet bovenaan Laatst bijgewerkt op ${todayAmsterdam()}.\n- Houd de Markdown rustig, praktisch en compact.\n- Geen verzonnen data, deadlines of technische claims.\n- Als input vaag is, zet dat onder Risico's / onduidelijkheden.\n- Het resultaat moet een volledig nieuw Markdown-bestand zijn, niet alleen een patch.`,
    user: `Project: ${projectTitle}\nMode: ${mode}\nBron: ${source}\n\nBestaande status:\n---\n${currentStatus}\n---\n\nNieuwe ruwe input / chat-samenvatting:\n---\n${input}\n---`
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const {
      project = '',
      input = '',
      source = 'chatgpt',
      mode = 'check',
      create_pr = true
    } = req.body || {};

    const text = String(input || '').trim();
    if (!text) return json(res, 400, { error: 'Missing input' });

    const apiKey = process.env.OPENAI_API_KEY;
    const githubToken = process.env.PROJECTBRAIN_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
    const targetRepo = process.env.PROJECTBRAIN_REPO || 'jrncprs-create/clara';
    const baseBranch = process.env.PROJECTBRAIN_BASE_BRANCH || 'main';
    const model = process.env.PROJECTBRAIN_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini';

    if (!apiKey) return json(res, 500, { error: 'Missing OPENAI_API_KEY' });
    if (!githubToken) return json(res, 500, { error: 'Missing PROJECTBRAIN_GITHUB_TOKEN or GITHUB_TOKEN' });

    const [owner, repo] = targetRepo.split('/');
    if (!owner || !repo) return json(res, 500, { error: 'Invalid PROJECTBRAIN_REPO. Use owner/repo.' });

    let projectSlug = normalizeProjectSlug(project);
    let detection = null;

    if (!projectSlug) {
      detection = await detectProject({ apiKey, model, input: text });
      if (detection.project_slug === 'unknown' || detection.confidence < 0.55) {
        return json(res, 422, {
          error: 'Project unclear',
          detection,
          message: 'Geef project mee, bijvoorbeeld project: "lalampe".'
        });
      }
      projectSlug = detection.project_slug;
    }

    const projectTitle = projectTitleFromSlug(projectSlug);
    const path = `projectbrain/projects/${projectSlug}.md`;
    const current = await getGithubFile({ token: githubToken, owner, repo, path, ref: baseBranch });
    const currentStatus = current.exists ? current.content : statusTemplate(projectSlug, projectTitle);

    const updated = await buildUpdatedStatus({
      apiKey,
      model,
      projectTitle,
      currentStatus,
      input: text,
      source,
      mode
    });

    if (mode === 'check' || mode === 'dry_run') {
      return json(res, 200, {
        ok: true,
        mode: 'check',
        project: projectSlug,
        path,
        detection,
        change_summary: updated.change_summary,
        detected_decisions: updated.detected_decisions,
        detected_actions: updated.detected_actions,
        uncertainties: updated.uncertainties,
        markdown: updated.markdown
      });
    }

    const safeDate = todayAmsterdam();
    const branch = create_pr
      ? `projectbrain/update-${projectSlug}-${safeDate}-${Date.now()}`
      : baseBranch;

    if (create_pr) {
      const baseSha = await getDefaultBranchSha({ token: githubToken, owner, repo, baseBranch });
      await createBranch({ token: githubToken, owner, repo, branch, sha: baseSha });
    }

    const branchCurrent = await getGithubFile({ token: githubToken, owner, repo, path, ref: branch });
    const result = await putGithubFile({
      token: githubToken,
      owner,
      repo,
      path,
      branch,
      content: updated.markdown,
      sha: branchCurrent.exists ? branchCurrent.sha : null,
      message: `Update Projectbrain status for ${projectTitle}`
    });

    let pull_request = null;
    if (create_pr) {
      pull_request = await createPullRequest({
        token: githubToken,
        owner,
        repo,
        title: `Update Projectbrain: ${projectTitle}`,
        body: `Automatische Projectbrain-update.\n\nProject: ${projectTitle}\nBestand: \`${path}\`\n\nSamenvatting:\n${updated.change_summary}`,
        head: branch,
        base: baseBranch
      });
    }

    return json(res, 200, {
      ok: true,
      mode: 'push',
      project: projectSlug,
      path,
      branch,
      commit: result.commit?.sha || null,
      pull_request: pull_request ? { number: pull_request.number, url: pull_request.html_url } : null,
      change_summary: updated.change_summary,
      detected_decisions: updated.detected_decisions,
      detected_actions: updated.detected_actions,
      uncertainties: updated.uncertainties
    });
  } catch (error) {
    return json(res, 500, {
      error: 'Projectbrain update failed',
      message: error?.message || String(error),
      detail: error?.data || null
    });
  }
}
