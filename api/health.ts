export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const geminiAvailable = Boolean(process.env.GEMINI_API_KEY);
  const availableModels: string[] = [];
  if (geminiAvailable) {
    availableModels.push('gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite');
  }
  availableModels.push('qwen2.5:1.5b', 'llama3.2:1b');

  return res.status(200).json({
    status: 'ok',
    git_available: false,
    git_path: null,
    ollama_available: false,
    gemini_available: geminiAvailable,
    ollama_host: 'cloud',
    default_model: geminiAvailable ? 'gemini-3.8-flash' : 'qwen2.5:1.5b',
    available_models: availableModels,
  });
}
