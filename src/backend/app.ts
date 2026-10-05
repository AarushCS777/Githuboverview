import express, { Router } from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  extractRepository,
  buildPrompt,
  generateExplanation,
} from './processor.ts';

const execFileAsync = promisify(execFile);
export const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

async function checkGit(): Promise<boolean> {
  try {
    await execFileAsync('git', ['--version']);
    return true;
  } catch {
    return false;
  }
}

async function checkOllama(): Promise<boolean> {
  const ollamaHost = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  try {
    const res = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(1200) });
    return res.ok;
  } catch {
    return false;
  }
}

const apiRouter = Router();

// Meta endpoint
apiRouter.get('/meta', (_req, res) => {
  res.json({
    service: 'Local GitHub Repository Code Explainer',
    docs: '/docs',
    health: '/api/health',
  });
});

// Health check endpoint
apiRouter.get('/health', async (_req, res) => {
  const gitAvailable = await checkGit();
  const ollamaAvailable = await checkOllama();
  const geminiAvailable = Boolean(process.env.GEMINI_API_KEY);

  const availableModels: string[] = [];
  if (geminiAvailable) {
    availableModels.push('gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite');
  }
  availableModels.push('qwen2.5:1.5b', 'llama3.2:1b');

  res.json({
    status: (gitAvailable && (geminiAvailable || ollamaAvailable)) ? 'ok' : 'degraded',
    git_available: gitAvailable,
    git_path: gitAvailable ? 'git' : null,
    ollama_available: ollamaAvailable,
    gemini_available: geminiAvailable,
    ollama_host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
    default_model: geminiAvailable ? 'gemini-3.8-flash' : 'qwen2.5:1.5b',
    available_models: availableModels,
  });
});

// Explain endpoint
apiRouter.post('/explain', async (req, res) => {
  const { repo_url, model } = req.body;
  if (!repo_url || typeof repo_url !== 'string') {
    return res.status(400).json({ detail: 'Please provide a valid GitHub repository URL in "repo_url"' });
  }

  const started = Date.now();
  try {
    const repo = await extractRepository(repo_url);
    const prompt = buildPrompt(repo.name, repo.url, repo.files, repo.languages);
    const { explanation, modelUsed } = await generateExplanation(prompt, model);
    const elapsedSeconds = Number(((Date.now() - started) / 1000).toFixed(2));

    return res.json({
      repo_url: repo.url,
      project_name: repo.name,
      model_used: modelUsed,
      files_analysed: repo.files.length,
      files: repo.files.map(f => ({
        path: f.path,
        chars: f.content.length,
        language: f.language,
        content: f.content,
      })),
      languages: repo.languages,
      explanation,
      elapsed_seconds: elapsedSeconds,
    });
  } catch (error: any) {
    console.error('[RepoLens API Error]', error);
    return res.status(error.statusCode || 500).json({
      detail: error.message || 'An error occurred while analyzing the repository.',
    });
  }
});

// Mount router on both /api (standard local path) and / (Vercel serverless path)
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
