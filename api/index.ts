export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({
    service: 'RepoLens GitHub Code Explainer API',
    endpoints: ['/api/health', '/api/explain'],
  });
}
