import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI } from '@google/genai';

const execFileAsync = promisify(execFile);

export const CODE_EXTENSIONS = new Set([
  '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.kt', '.c', '.cc', '.cpp',
  '.h', '.hpp', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.m', '.mm',
  '.scala', '.sh', '.bash', '.ps1', '.sql', '.html', '.css', '.scss', '.vue',
  '.svelte', '.dart', '.r', '.jl', '.lua', '.pl', '.ex', '.exs', '.hs', '.ml',
  '.clj', '.groovy', '.asm', '.sol',
]);

export const CONFIG_FILENAMES = new Set([
  'package.json', 'pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg',
  'pom.xml', 'build.gradle', 'build.gradle.kts', 'cargo.toml', 'go.mod',
  'gemfile', 'composer.json', 'makefile', 'dockerfile', 'docker-compose.yml',
  'docker-compose.yaml', 'pipfile', 'environment.yml', 'tsconfig.json',
  '.env.example', 'manage.py',
]);

export const SKIP_DIRS = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'vendor', 'venv', '.venv', 'env',
  '.env', '__pycache__', 'dist', 'build', 'target', 'out', '.next', '.nuxt',
  '.idea', '.vscode', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.tox',
  '.eggs', 'eggs', 'site-packages', 'coverage', '.gradle', '.terraform',
  'bower_components', 'pods', 'deriveddata', '.dart_tool', '.stack-work',
  'third_party', 'assets', 'static', 'public', 'images', 'img', 'fonts',
  'docs', 'examples',
]);

export const SKIP_FILENAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'poetry.lock',
  'uv.lock', 'cargo.lock', 'gemfile.lock', 'composer.lock', 'pipfile.lock',
]);

export const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp', '.pdf',
  '.zip', '.tar', '.gz', '.7z', '.rar', '.exe', '.dll', '.so', '.dylib',
  '.bin', '.dat', '.class', '.jar', '.war', '.pyc', '.pyo', '.woff',
  '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.sqlite', '.db', '.pkl', '.pt', '.onnx', '.whl', '.nupkg', '.deb',
  '.rpm', '.iso', '.img', '.parquet', '.feather',
]);

export const LANGUAGE_BY_EXTENSION: Record<string, string> = {
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

const TEST_DIR_NAMES = new Set(['test', 'tests', 'testing', 'spec', 'specs', '__tests__', 'testdata', 'fixtures']);
const SECONDARY_DIR_NAMES = new Set(['docs', 'doc', 'examples', 'example', 'benchmarks', 'benchmark', 'scripts', 'migrations', 'design', 'demo', 'demos']);
const ENTRY_STEMS = new Set(['main', 'app', 'index', 'server', 'cli', 'manage', '__main__', 'application', 'run', 'start', 'router', 'views']);
const SECONDARY_STEMS = new Set(['changelog', 'contributing', 'license', 'licence', 'authors', 'code_of_conduct', 'history', 'news', 'changes']);

const CATEGORY_ORDER = ['readme', 'manifest', 'entry', 'source', 'config', 'test', 'secondary'] as const;
type Category = typeof CATEGORY_ORDER[number];

const CATEGORY_LIMITS: Record<Category, number> = {
  readme: 1, manifest: 6, entry: 6, source: 32, config: 6, test: 4, secondary: 2,
};

const CATEGORY_CHAR_CAPS: Record<Category, number> = {
  readme: 3000, manifest: 1800, entry: 4000, source: 4000, config: 1500, test: 2500, secondary: 1500,
};

const MAX_FILES = 50;
const MAX_FILE_CHARS = 4000;
const MAX_TOTAL_CHARS = 26000;

export interface ExtractedFile {
  path: string;
  content: string;
  language: string;
}

export interface ExtractedRepo {
  name: string;
  url: string;
  files: ExtractedFile[];
  languages: Record<string, number>;
  total_files_seen: number;
}

export function normalizeRepoUrl(url: string): { cloneUrl: string; owner: string; repo: string } {
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

export function getLanguageFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_BY_EXTENSION[ext] || (ext ? ext.slice(1).toUpperCase() : 'Text');
}

function getCategory(filePath: string, rootDir: string): Category {
  const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const fileName = path.basename(filePath).toLowerCase();
  const stem = path.parse(filePath).name.toLowerCase();
  const parts = rel.split('/').slice(0, -1).map(p => p.toLowerCase());

  if (fileName.startsWith('readme')) return 'readme';
  if (CONFIG_FILENAMES.has(fileName)) return 'manifest';
  if (parts.some(p => TEST_DIR_NAMES.has(p)) || stem.startsWith('test_') || stem.endsWith('_test')) return 'test';
  if (ENTRY_STEMS.has(stem)) return 'entry';
  if (parts.some(p => SECONDARY_DIR_NAMES.has(p)) || SECONDARY_STEMS.has(stem)) return 'secondary';
  const ext = path.extname(filePath).toLowerCase();
  if (CODE_EXTENSIONS.has(ext)) return 'source';
  return 'config';
}

async function walkDirectory(dir: string, rootDir: string): Promise<Array<{ filePath: string; category: Category }>> {
  const results: Array<{ filePath: string; category: Category }> = [];
  
  async function traverse(current: string) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const lowerName = entry.name.toLowerCase();

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(lowerName) || lowerName.startsWith('.')) continue;
        await traverse(fullPath);
      } else if (entry.isFile()) {
        if (SKIP_FILENAMES.has(lowerName)) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) continue;

        const isKnown = CONFIG_FILENAMES.has(lowerName) || lowerName.startsWith('readme');
        if (!CODE_EXTENSIONS.has(ext) && !isKnown && !['.json', '.yml', '.yaml', '.toml', '.xml', '.md'].includes(ext)) {
          continue;
        }

        try {
          const stat = await fs.stat(fullPath);
          if (stat.size > 400_000) continue;
        } catch {
          continue;
        }

        results.push({ filePath: fullPath, category: getCategory(fullPath, rootDir) });
      }
    }
  }

  await traverse(dir);
  return results;
}

export async function cloneOrFetchRepo(repoUrl: string): Promise<{ workDir: string; owner: string; repo: string }> {
  const { cloneUrl, owner, repo } = normalizeRepoUrl(repoUrl);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `repolens_${owner}_${repo}_`));

  let cloneSuccess = false;
  try {
    // Attempt fast shallow git clone
    await execFileAsync('git', ['clone', '--depth', '1', `https://github.com/${owner}/${repo}.git`, tempDir], {
      timeout: 45000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    cloneSuccess = true;
  } catch (err: any) {
    console.warn(`[RepoLens] git clone failed: ${err.message}. Trying GitHub REST archive API fallback...`);
  }

  if (!cloneSuccess) {
    // Fallback: fetch repository tree or zip archive via GitHub public API
    try {
      const branches = ['main', 'master', 'HEAD'];
      let treeData: any = null;
      let usedBranch = 'main';

      for (const branch of branches) {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
        const res = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'RepoLens-App',
            'Accept': 'application/vnd.github.v3+json',
          },
        });
        if (res.ok) {
          treeData = await res.json();
          usedBranch = branch;
          break;
        }
      }

      if (!treeData || !Array.isArray(treeData.tree)) {
        throw new Error(`Repository ${owner}/${repo} was not found on GitHub, or it is private/rate-limited.`);
      }

      // Filter and fetch files from raw.githubusercontent.com
      const filesToFetch = treeData.tree
        .filter((item: any) => item.type === 'blob')
        .slice(0, 100);

      for (const item of filesToFetch) {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${usedBranch}/${item.path}`;
        try {
          const rawRes = await fetch(rawUrl, { headers: { 'User-Agent': 'RepoLens-App' } });
          if (rawRes.ok) {
            const content = await rawRes.text();
            const destPath = path.join(tempDir, item.path);
            await fs.mkdir(path.dirname(destPath), { recursive: true });
            await fs.writeFile(destPath, content, 'utf-8');
          }
        } catch {
          // ignore single file error
        }
      }
    } catch (fallbackErr: any) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      throw new Error(`Failed to access repository ${repoUrl}: ${fallbackErr.message}`);
    }
  }

  return { workDir: tempDir, owner, repo };
}

export async function extractRepository(repoUrl: string): Promise<ExtractedRepo> {
  const { workDir, owner, repo } = await cloneOrFetchRepo(repoUrl);

  try {
    const candidates = await walkDirectory(workDir, workDir);
    const seen = candidates.length;

    // Group files by category
    const grouped: Record<Category, Array<{ filePath: string; category: Category }>> = {
      readme: [], manifest: [], entry: [], source: [], config: [], test: [], secondary: [],
    };

    for (const item of candidates) {
      grouped[item.category].push(item);
    }

    const chosen: Array<{ filePath: string; category: Category }> = [];
    for (const cat of CATEGORY_ORDER) {
      const bucket = grouped[cat].sort((a, b) => {
        const partsA = path.relative(workDir, a.filePath).split(path.sep).length;
        const partsB = path.relative(workDir, b.filePath).split(path.sep).length;
        return partsA - partsB;
      });

      for (const item of bucket.slice(0, CATEGORY_LIMITS[cat])) {
        if (chosen.length >= MAX_FILES) break;
        chosen.push(item);
      }
      if (chosen.length >= MAX_FILES) break;
    }

    const extractedFiles: ExtractedFile[] = [];
    const languageCounts: Record<string, number> = {};
    let totalChars = 0;

    for (const item of chosen) {
      let content: string;
      try {
        content = await fs.readFile(item.filePath, 'utf-8');
      } catch {
        continue;
      }

      // Check for null bytes (binary)
      if (content.slice(0, 4096).includes('\0')) continue;

      const cap = Math.min(MAX_FILE_CHARS, CATEGORY_CHAR_CAPS[item.category]);
      content = content.slice(0, cap);

      if (totalChars + content.length > MAX_TOTAL_CHARS) {
        if (totalChars === 0) {
          content = content.slice(0, MAX_TOTAL_CHARS);
        } else {
          continue;
        }
      }

      totalChars += content.length;
      const relPath = path.relative(workDir, item.filePath).replace(/\\/g, '/');
      const lang = getLanguageFor(item.filePath);

      extractedFiles.push({ path: relPath, content, language: lang });
      languageCounts[lang] = (languageCounts[lang] || 0) + 1;
    }

    if (extractedFiles.length === 0) {
      throw new Error(`No readable source code files were found in repository ${owner}/${repo}.`);
    }

    return {
      name: repo,
      url: `https://github.com/${owner}/${repo}`,
      files: extractedFiles,
      languages: Object.fromEntries(
        Object.entries(languageCounts).sort(([, a], [, b]) => b - a)
      ),
      total_files_seen: seen,
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function buildPrompt(repoName: string, repoUrl: string, files: ExtractedFile[], languages: Record<string, number>): string {
  const fileListing = files.map(f => `- ${f.path} (${f.language})`).join('\n');
  const languageListing = Object.entries(languages).map(([l, c]) => `${l}: ${c}`).join(', ') || 'unknown';
  const corpus = files.map(f => `--- FILE: ${f.path} ---\n${f.content}\n`).join('\n');

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
- Write about the application itself. Test files are only supporting evidence, so never list individual test cases and never turn the answer into a test catalogue.
- Never repeat a section or a bullet, and never pad the answer with filler.
- Do not mention that you were given code snippets or a prompt.
- Keep the whole answer under about 450 words and stop after the Project Structure section.`;
}

export const SYSTEM_PROMPT =
  "You are a friendly senior software engineer who explains codebases to beginners. " +
  "You always answer in simple, plain English and never invent features that are not " +
  "supported by the code you were given.";

export async function generateExplanation(
  prompt: string,
  modelChoice?: string
): Promise<{ explanation: string; modelUsed: string }> {
  // If GEMINI_API_KEY is available, use @google/genai
  if (process.env.GEMINI_API_KEY) {
    const targetModel = modelChoice && modelChoice.includes('gemini')
      ? modelChoice
      : 'gemini-3.8-flash';

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    try {
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
      console.warn(`[RepoLens] Gemini API call error: ${err.message}`);
    }
  }

  // Fallback to Ollama if available
  const ollamaHost = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  try {
    const tagsRes = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (tagsRes.ok) {
      const tagsData = await tagsRes.json();
      const models: string[] = (tagsData.models || []).map((m: any) => m.name);
      const chosenModel = modelChoice && models.includes(modelChoice)
        ? modelChoice
        : (models[0] || 'qwen2.5:1.5b');

      const genRes = await fetch(`${ollamaHost}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: chosenModel,
          prompt,
          system: SYSTEM_PROMPT,
          stream: false,
          options: { temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (genRes.ok) {
        const genData = await genRes.json();
        if (genData.response) {
          return { explanation: genData.response.trim(), modelUsed: `ollama (${chosenModel})` };
        }
      }
    }
  } catch {
    // Ollama not reachable
  }

  // Self-contained structural analysis fallback when no LLM key is configured
  return {
    explanation: generateStructuralExplanation(prompt),
    modelUsed: 'RepoLens Code Analyzer',
  };
}

function generateStructuralExplanation(prompt: string): string {
  // Extract project name, detected languages, and files from prompt
  const repoNameMatch = prompt.match(/Repository:\s*(.+)/);
  const repoName = repoNameMatch ? repoNameMatch[1].trim() : 'Project';
  const langMatch = prompt.match(/Detected languages:\s*(.+)/);
  const langs = langMatch ? langMatch[1].trim() : 'Source code';

  return `# Project Overview
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
- Entry files orchestrate application lifecycles and expose primary endpoints.`;
}
