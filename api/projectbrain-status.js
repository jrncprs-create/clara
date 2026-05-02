const PROJECTBRAIN_PROJECTS = {
  clara: 'projectbrain/projects/clara.md',
  lalampe: 'projectbrain/projects/lalampe.md',
  begeister: 'projectbrain/projects/begeister.md',
  'afk-landjuweel-amarte': 'projectbrain/projects/afk-landjuweel-amarte.md'
};

function json(res, status, payload) {
  res.status(status).json(payload);
}

function normalizeProjectSlug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function githubRequest({ token, url }) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'clara-projectbrain-status'
    }
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

async function readProjectbrainFile({ token, owner, repo, path, ref }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(ref)}`;
  const file = await githubRequest({ token, url });
  const content = Buffer.from(file.content || '', 'base64').toString('utf8');

  return {
    path,
    sha: file.sha,
    content
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });

  try {
    const token = process.env.PROJECTBRAIN_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
    const targetRepo = process.env.PROJECTBRAIN_REPO || 'jrncprs-create/clara';
    const branch = process.env.PROJECTBRAIN_BASE_BRANCH || 'main';

    if (!token) return json(res, 500, { ok: false, error: 'Missing PROJECTBRAIN_GITHUB_TOKEN or GITHUB_TOKEN' });

    const [owner, repo] = targetRepo.split('/');
    if (!owner || !repo) return json(res, 500, { ok: false, error: 'Invalid PROJECTBRAIN_REPO. Use owner/repo.' });

    const requestedProject = normalizeProjectSlug(req.query.project || '');
    const requestedAll = String(req.query.all || '').trim() === '1';

    if (requestedAll) {
      const projects = await Promise.all(Object.entries(PROJECTBRAIN_PROJECTS).map(async ([project, path]) => {
        try {
          const file = await readProjectbrainFile({ token, owner, repo, path, ref: branch });
          return { ok: true, project, ...file };
        } catch (error) {
          return { ok: false, project, path, error: error.message || String(error), detail: error.data || null };
        }
      }));

      return json(res, 200, {
        ok: true,
        mode: 'all',
        branch,
        repo: targetRepo,
        projects
      });
    }

    if (!requestedProject || !PROJECTBRAIN_PROJECTS[requestedProject]) {
      return json(res, 400, {
        ok: false,
        error: 'Unknown or missing project',
        allowed_projects: Object.keys(PROJECTBRAIN_PROJECTS)
      });
    }

    const path = PROJECTBRAIN_PROJECTS[requestedProject];
    const file = await readProjectbrainFile({ token, owner, repo, path, ref: branch });

    return json(res, 200, {
      ok: true,
      project: requestedProject,
      branch,
      repo: targetRepo,
      ...file
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: 'Projectbrain status failed',
      message: error.message || String(error),
      detail: error.data || null
    });
  }
}
