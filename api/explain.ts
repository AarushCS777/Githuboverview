import {
  extractRepository,
  buildPrompt,
  generateExplanation,
} from '../src/backend/processor';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Method Not Allowed' });
  }

  // Parse body if passed as string
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ detail: 'Invalid JSON body' });
    }
  }

  const { repo_url, model } = body || {};
  if (!repo_url || typeof repo_url !== 'string') {
    return res.status(400).json({ detail: 'Please provide a valid GitHub repository URL in "repo_url"' });
  }

  const started = Date.now();
  try {
    const repo = await extractRepository(repo_url);
    const prompt = buildPrompt(repo.name, repo.url, repo.files, repo.languages);
    const { explanation, modelUsed } = await generateExplanation(prompt, model);
    const elapsedSeconds = Number(((Date.now() - started) / 1000).toFixed(2));

    return res.status(200).json({
      repo_url: repo.url,
      project_name: repo.name,
      model_used: modelUsed,
      files_analysed: repo.files.length,
      files: repo.files.map((f: any) => ({
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
    console.error('[Vercel API explain Error]', error);
    return res.status(500).json({
      detail: error.message || 'An error occurred while analyzing the repository.',
    });
  }
}
