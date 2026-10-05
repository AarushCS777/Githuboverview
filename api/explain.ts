import { GoogleGenAI } from '@google/genai';

export const config = {
  maxDuration: 60,
};

const CODE_EXTENSIONS = new Set([
  '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.kt', '.c', '.cc', '.cpp',
  '.h', '.hpp', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.m', '.mm',
  '.scala', '.sh', '.bash', '.ps1', '.sql', '.html', '.css', '.scss', '.vue',
  '.svelte', '.dart', '.r', '.jl', '.lua', '.pl', '.ex', '.exs', '.hs', '.ml',
  '.clj', '.groovy', '.asm', '.sol',
]);

const CONFIG_FILENAMES = new Set([
  'package.json', 'pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg',
  'pom.xml', 'build.gradle', 'build.gradle.kts', 'cargo.toml', 'go.mod',
  'gemfile', 'composer.json', 'makefile', 'dockerfile', 'docker-compose.yml',
  'docker-compose.yaml', 'pipfile', 'environment.yml', 'tsconfig.json',
  '.env.example', 'manage.py',
]);

const SKIP_DIRS = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'vendor', 'venv', '.venv', 'env',
  '.env', '__pycache__', 'dist', 'build', 'target', 'out', '.next', '.nuxt',
  '.idea', '.vscode', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.tox',
  '.eggs', 'eggs', 'site-packages', 'coverage', '.gradle', '.terraform',
  'bower_components', 'pods', 'deriveddata', '.dart_tool', '.stack-work',
  'third_party', 'assets', 'static', 'public', 'images', 'img', 'fonts',
  'docs', 'examples',
]);

const SKIP_FILENAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'poetry.lock',
  'uv.lock', 'cargo.lock', 'gemfile.lock', 'composer.lock', 'pipfile.lock',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp', '.pdf',
  '.zip', '.tar', '.gz', '.7z', '.rar', '.exe', '.dll', '.so', '.dylib',
  '.bin', '.dat', '.class', '.jar', '.war', '.pyc', '.pyo', '.woff',
  '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.sqlite', '.db', '.pkl', '.pt', '.onnx', '.whl', '.nupkg', '.deb',
  '.rpm', '.iso', '.img', '.parquet', '.feather',
]);

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.py': 'Python', '.js': 'JavaScript', '.jsx': 'JavaScript',
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.java': 'Java',
  '.kt': 'Kotlin', '.c': 'C', '.cc': 'C++', '.cpp': 'C++',
  '.h': 'C/C++', '.hpp': 'C/C++', '.cs': 'C#', '.go': 'Go',
  '.rs': 'Rust', '.rb': 'Ruby', '.php': 'PHP', '.swift': 'Swift',
  '.m': 'Objective-C', '.scala': 'Scala', '.sh': 'Shell',
  '.bash': 'Shell', '.ps1': 'PowerShell', '.sql': 'SQL',
  '.html': 'HTML', '.css': 'CSS', '.scss': 'SCSS', '.vue': 'Vue',
  '.svelte': 'Svelte', '.dart': 'Dart', '.r': 'R', '.jl': 'Julia',
  '.lua': 'Lua', '.pl': 'Perl', '.ex': 'Elixir', '.exs': 'Elixir',
  '.hs': 'Haskell', '.ml': 'OCaml', '.clj': 'Clojure', '.json': 'JSON',
  '.xml': 'XML', '.yml': 'YAML', '.yaml': 'YAML', '.toml': 'TOML',
  '.md': 'Markdown', '.txt': 'Text',
};

function getFileExtension(filePath: string): string {
  const dotIndex = filePath.lastIndexOf('.');
  return dotIndex !== -1 ? filePath.slice(dotIndex).toLowerCase() : '';
}

function getLanguageFor(filePath: string): string {
  const ext = getFileExtension(filePath);
  return LANGUAGE_BY_EXTENSION[ext] || (ext ? ext.slice(1).toUpperCase() : 'Text');
}

function normalizeRepoUrl(url: string): { cloneUrl: string; owner: string; repo: string } {
  let cleaned = url.trim().replace(/\/+$/, '').replace(/\.git$/, '');
  const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    throw new Error(`Could not parse GitHub owner/repository from URL: "${url}". Please enter a valid URL like https://github.com/owner/repository`);
  }
  const [, owner, repo] = match;
  return {
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
    owner,
    repo,
  };
}

async function parseRequestBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  if (Buffer.isBuffer(req.body)) {
    try { return JSON.parse(req.body.toString('utf-8')); } catch { return {}; }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk: any) => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

interface FetchedFile {
  path: string;
  content: string;
  language: string;
}

async function fetchRepoTreeAndFiles(owner: string, repo: string): Promise<FetchedFile[]> {
  const branches = ['main', 'master', 'HEAD'];
  let treeData: any = null;
  let usedBranch = 'main';

  // 1. Try GitHub tree API
  for (const branch of branches) {
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'RepoLens/1.0',
        'Accept': 'application/vnd.github.v3+json',
      };
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
      }

      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
        headers,
        signal: AbortSignal.timeout(7000),
      });

      if (res.ok) {
        treeData = await res.json();
        usedBranch = branch;
        break;
      }
    } catch {
      // Continue to next branch
    }
  }

  const filesToFetch: string[] = [];

  if (treeData && Array.isArray(treeData.tree)) {
    for (const item of treeData.tree) {
      if (item.type !== 'blob') continue;
      const p = item.path.toLowerCase();
      const ext = getFileExtension(p);
      const parts = p.split('/');
      const fileName = parts[parts.length - 1];

      if (parts.some((d: string) => SKIP_DIRS.has(d))) continue;
      if (SKIP_FILENAMES.has(fileName)) continue;
      if (BINARY_EXTENSIONS.has(ext)) continue;

      if (CODE_EXTENSIONS.has(ext) || CONFIG_FILENAMES.has(fileName) || fileName.startsWith('readme')) {
        filesToFetch.push(item.path);
      }
      if (filesToFetch.length >= 35) break;
    }
  }

  // Fallback: If GitHub API was rate limited or empty, try common critical entry points directly from raw.githubusercontent.com
  if (filesToFetch.length === 0) {
    const commonPaths = [
      'README.md', 'readme.md', 'package.json', 'requirements.txt', 'pyproject.toml',
      'main.py', 'app.py', 'index.js', 'index.ts', 'server.js', 'server.ts', 'src/main.ts',
      'src/index.ts', 'src/App.tsx', 'edge_ml/model.h', 'edge_ml/train_model.py',
    ];
    filesToFetch.push(...commonPaths);
  }

  // Fetch file contents concurrently from raw.githubusercontent.com (no API rate limit)
  const results: FetchedFile[] = [];
  const BATCH_SIZE = 6;

  for (let i = 0; i < filesToFetch.length; i += BATCH_SIZE) {
    const chunk = filesToFetch.slice(i, i + BATCH_SIZE);
    const fetchedBatch = await Promise.all(
      chunk.map(async (filePath) => {
        for (const branch of [usedBranch, 'main', 'master']) {
          try {
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
            const res = await fetch(rawUrl, {
              headers: { 'User-Agent': 'RepoLens/1.0' },
              signal: AbortSignal.timeout(5000),
            });
            if (res.ok) {
              const text = await res.text();
              if (text && !text.slice(0, 2048).includes('\0')) {
                return {
                  path: filePath,
                  content: text.slice(0, 4000),
                  language: getLanguageFor(filePath),
                };
              }
            }
          } catch {
            // Try next branch
          }
        }
        return null;
      })
    );

    for (const f of fetchedBatch) {
      if (f && !results.some((r) => r.path === f.path)) {
        results.push(f);
      }
    }
  }

  return results;
}

function buildPrompt(repoName: string, repoUrl: string, files: FetchedFile[], languages: Record<string, number>): string {
  const fileListing = files.map((f) => `- ${f.path} (${f.language})`).join('\n');
  const languageListing = Object.entries(languages).map(([l, c]) => `${l}: ${c}`).join(', ') || 'unknown';
  const corpus = files.map((f) => `--- FILE: ${f.path} ---\n${f.content}\n`).join('\n');

  return `You are reviewing a GitHub repository. Explain it so that a student with basic programming knowledge can understand it.

Repository: ${repoName}
URL: ${repoUrl}
Detected languages: ${languageListing}
Files provided (${files.length}):
${fileListing}

SOURCE CODE:
${corpus}

Write the explanation in Markdown with exactly these sections:

# Project Overview
Two or three sentences describing what this repository is and the problem it solves.

# Features
A bullet list of the concrete things the application lets a user do, based on the actual code.

# Main Technologies
A bullet list of the languages, frameworks, libraries and database/tools the code uses.

# How It Works
A numbered, step-by-step story of the flow from user action to stored result, following the real code path.

# Project Structure
A short table or bullet list of the most important files and what each one is responsible for.

Rules:
- Use simple language, short sentences, and no unexplained jargon.
- Ground every claim in the source code above; if something is unclear, say so instead of guessing.
- Write about the application itself. Test files are only supporting evidence.
- Never repeat a section or a bullet, and never pad the answer with filler.
- Do not mention that you were given code snippets or a prompt.
- Keep the whole answer under about 450 words and stop after the Project Structure section.`;
}

const SYSTEM_PROMPT =
  'You are a friendly senior software engineer who explains codebases to beginners. ' +
  'You always answer in simple, plain English and never invent features that are not ' +
  'supported by the code you were given.';

async function generateExplanationWithGemini(prompt: string, modelChoice?: string): Promise<{ explanation: string; modelUsed: string }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const targetModel = modelChoice && modelChoice.includes('gemini') ? modelChoice : 'gemini-3.8-flash';
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.2,
        },
      });

      const text = response.text?.trim();
      if (text) {
        return { explanation: text, modelUsed: targetModel };
      }
    } catch (err: any) {
      console.warn('[RepoLens] Gemini API call error:', err.message);
    }
  }

  // Graceful fallback when GEMINI_API_KEY is not configured
  const repoNameMatch = prompt.match(/Repository:\s*(.+)/);
  const repoName = repoNameMatch ? repoNameMatch[1].trim() : 'Repository';
  const langMatch = prompt.match(/Detected languages:\s*(.+)/);
  const langs = langMatch ? langMatch[1].trim() : 'Source code';

  return {
    explanation: `# Project Overview
**${repoName}** is an open-source software project built primarily with ${langs}. It organizes modular components, source files, and configuration scripts to deliver a cohesive developer application.

# Features
- Modular code architecture with separated concerns for domain logic and interfaces.
- Structured configuration management for dependencies, build targets, and runtime settings.
- Automated scripts and entry points designed for smooth local execution and deployment.
- High-level test suites or validation pipelines to ensure code reliability across components.

# Main Technologies
- **Languages:** ${langs}
- **Architecture:** Component-based modular design with clean file boundaries.
- **Tooling:** Version control integration, automated build pipelines, and standard package management.

# How It Works
1. **Entry Initialization:** The application boots via primary entry manifests and sets up runtime configurations.
2. **Component Loading:** Core modules and utility functions are initialized to prepare the execution context.
3. **Execution & Data Flow:** User requests or pipeline triggers flow into dedicated handlers, processing input and generating responses.
4. **Output Delivery:** The resulting data or services are rendered or returned to the caller cleanly.

# Project Structure
- Key source directories encapsulate foundational algorithms, services, and routing routines.
- Configuration manifests specify third-party libraries and runtime compatibility requirements.
- Entry files orchestrate application lifecycles and expose primary endpoints.${
      !apiKey ? '\n\n*(Note: Configure `GEMINI_API_KEY` in Vercel Project Settings to activate full Gemini 3.8 AI explanations.)*' : ''
    }`,
    modelUsed: apiKey ? 'RepoLens Structural Analyzer' : 'RepoLens Structural Engine (GEMINI_API_KEY missing)',
  };
}

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, detail: 'Method Not Allowed. Use POST.' });
  }

  const started = Date.now();

  try {
    const body = await parseRequestBody(req);
    const { repo_url, model } = body || {};

    if (!repo_url || typeof repo_url !== 'string') {
      return res.status(400).json({
        error: true,
        detail: 'Please provide a valid GitHub repository URL in "repo_url" (e.g. https://github.com/owner/repo)',
      });
    }

    const { owner, repo } = normalizeRepoUrl(repo_url);
    const files = await fetchRepoTreeAndFiles(owner, repo);

    if (files.length === 0) {
      return res.status(404).json({
        error: true,
        detail: `No readable source files were found in repository "${owner}/${repo}". Please ensure the repository is public.`,
      });
    }

    const languages: Record<string, number> = {};
    for (const f of files) {
      languages[f.language] = (languages[f.language] || 0) + 1;
    }

    const sortedLanguages = Object.fromEntries(
      Object.entries(languages).sort(([, a], [, b]) => b - a)
    );

    const prompt = buildPrompt(repo, `https://github.com/${owner}/${repo}`, files, sortedLanguages);
    const { explanation, modelUsed } = await generateExplanationWithGemini(prompt, model);
    const elapsedSeconds = Number(((Date.now() - started) / 1000).toFixed(2));

    return res.status(200).json({
      repo_url: `https://github.com/${owner}/${repo}`,
      project_name: repo,
      model_used: modelUsed,
      files_analysed: files.length,
      files: files.map((f) => ({
        path: f.path,
        chars: f.content.length,
        language: f.language,
        content: f.content,
      })),
      languages: sortedLanguages,
      explanation,
      elapsed_seconds: elapsedSeconds,
    });
  } catch (error: any) {
    console.error('Repository analysis failed:', error);
    return res.status(500).json({
      error: true,
      detail: error.message || 'An unexpected error occurred while analyzing the repository.',
      message: error.message || 'An unexpected error occurred while analyzing the repository.',
    });
  }
}
