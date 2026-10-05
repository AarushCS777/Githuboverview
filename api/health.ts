export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const geminiAvailable = Boolean(process.env.GEMINI_API_KEY);
  const availableModels: string[] = [
    'gemini-3.8-flash',
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite',
  ];

  return res.status(200).json({
    status: 'ok',
    git_available: true,
    git_path: 'Cloud HTTP',
    ollama_available: false,
    gemini_available: geminiAvailable,
    ollama_host: 'cloud',
    default_model: 'gemini-3.8-flash',
    available_models: availableModels,
  });
}
