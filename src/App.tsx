import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Search,
  GitBranch,
  FolderGit2,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  FileCode,
  Layers,
  FileText,
  Share2,
  Download,
  X,
  Code,
  Terminal,
  Activity,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';

interface HealthData {
  status: 'ok' | 'degraded' | 'offline';
  git_available: boolean;
  git_path?: string | null;
  ollama_available: boolean;
  gemini_available?: boolean;
  ollama_host: string;
  default_model: string;
  available_models: string[];
}

interface AnalysedFile {
  path: string;
  chars: number;
  language: string;
  content?: string;
}

interface ExplainResponse {
  repo_url: string;
  project_name: string;
  model_used: string;
  files_analysed: number;
  files: AnalysedFile[];
  languages: Record<string, number>;
  explanation: string;
  elapsed_seconds: number;
}

const LANG_COLORS: Record<string, string> = {
  Python: '#3572A5',
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Shell: '#89e051',
  PowerShell: '#012456',
  SQL: '#e38c00',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Dart: '#00B4AB',
  YAML: '#cb171e',
  JSON: '#292929',
  TOML: '#9c4221',
  Markdown: '#083fa1',
  Text: '#64748b',
};

const SAMPLE_REPOS = [
  { name: 'Githuboverview', desc: 'Code explainer source', url: 'https://github.com/AarushCS777/Githuboverview' },
  { name: 'Express', desc: 'Fast, minimalist Node.js web framework', url: 'https://github.com/expressjs/express' },
  { name: 'Flask', desc: 'Lightweight WSGI Python web app', url: 'https://github.com/pallets/flask' },
  { name: 'FastAPI', desc: 'Modern Python web framework for APIs', url: 'https://github.com/fastapi/fastapi' },
];

export default function App() {
  const [repoUrl, setRepoUrl] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('Auto (default)');
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'architecture' | 'files' | 'export'>('overview');
  const [fileSearch, setFileSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<AnalysedFile | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedFile, setCopiedFile] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      } else {
        setHealth(null);
      }
    } catch {
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleAnalyze = async (overrideUrl?: string) => {
    const target = (overrideUrl || repoUrl).trim();
    if (!target) {
      setError('Please provide a valid GitHub repository URL.');
      return;
    }

    setError(null);
    setAnalyzing(true);
    setProgressStep(20);
    setProgressLabel('Connecting to GitHub repository...');

    const stepTimers: NodeJS.Timeout[] = [];
    stepTimers.push(
      setTimeout(() => {
        setProgressStep(45);
        setProgressLabel('Filtering code files and pruning dependencies...');
      }, 1000)
    );
    stepTimers.push(
      setTimeout(() => {
        setProgressStep(70);
        setProgressLabel('Analyzing component boundaries and architecture...');
      }, 2400)
    );
    stepTimers.push(
      setTimeout(() => {
        setProgressStep(90);
        setProgressLabel('Synthesizing structured system overview...');
      }, 4000)
    );

    try {
      const payload: { repo_url: string; model?: string } = { repo_url: target };
      if (selectedModel && selectedModel !== 'Auto (default)') {
        payload.model = selectedModel;
      }

      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any;

      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const rawText = await res.text();
        const cleanSnippet = rawText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
        throw new Error(
          cleanSnippet
            ? `Server response (${res.status}): ${cleanSnippet}`
            : `Server returned non-JSON response with HTTP ${res.status}.`
        );
      }

      if (!res.ok) {
        throw new Error(data.detail || data.message || `Analysis failed with status ${res.status}`);
      }

      setProgressStep(100);
      setProgressLabel('Analysis complete');
      setResult(data);
      setActiveTab('overview');
    } catch (err: any) {
      setError(err.message || 'An error occurred during repository analysis.');
    } finally {
      stepTimers.forEach(clearTimeout);
      setAnalyzing(false);
    }
  };

  const handleCopySummary = () => {
    if (!result?.explanation) return;
    navigator.clipboard.writeText(result.explanation);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleCopyFileContent = () => {
    if (!selectedFile?.content) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!result) return;
    const blob = new Blob([result.explanation], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${result.project_name}-architecture.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredFiles = useMemo(() => {
    if (!result?.files) return [];
    if (!fileSearch.trim()) return result.files;
    const query = fileSearch.toLowerCase();
    return result.files.filter(
      (f) => f.path.toLowerCase().includes(query) || f.language.toLowerCase().includes(query)
    );
  }, [result?.files, fileSearch]);

  const totalCharsCount = useMemo(() => {
    if (!result?.files) return 0;
    return result.files.reduce((acc, f) => acc + f.chars, 0);
  }, [result?.files]);

  // Compute language percentage bar
  const languagePercentages = useMemo(() => {
    if (!result?.languages) return [];
    const totalCount = Object.values(result.languages).reduce((a, b) => a + b, 0);
    if (totalCount === 0) return [];
    return Object.entries(result.languages).map(([name, count]) => ({
      name,
      count,
      pct: ((count / totalCount) * 100).toFixed(1),
      color: LANG_COLORS[name] || '#64748b',
    }));
  }, [result?.languages]);

  return (
    <div className="min-h-screen bg-[#090d14] text-[#f0f4fc] flex flex-col font-sans">
      {/* ── Top Bar Contract (3 Zones) ────────────────────────────────────── */}
      <header className="h-14 border-b border-[#1e283d] bg-[#0c111a]/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <a
            href="/"
            onClick={(e) => {
              if (result) {
                e.preventDefault();
                setResult(null);
              }
            }}
            className="text-base font-bold tracking-tight text-white hover:text-[#38bdf8] transition-colors flex items-center gap-2"
          >
            <FolderGit2 size={18} className="text-[#38bdf8]" />
            <span>RepoLens</span>
          </a>
          <span className="text-xs text-[#64748b] hidden sm:inline">/</span>
          <span className="text-xs text-[#94a3b8] font-medium hidden sm:inline">Code Intelligence Studio</span>
        </div>

        {/* Zone 2: Navigation Links / Contextual Views */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {result ? (
            <div className="flex items-center bg-[#141c2e] p-1 rounded-lg border border-[#1e283d]">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'bg-[#1e283d] text-white shadow-sm'
                    : 'text-[#94a3b8] hover:text-[#f0f4fc]'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('architecture')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  activeTab === 'architecture'
                    ? 'bg-[#1e283d] text-white shadow-sm'
                    : 'text-[#94a3b8] hover:text-[#f0f4fc]'
                }`}
              >
                Architecture
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  activeTab === 'files'
                    ? 'bg-[#1e283d] text-white shadow-sm'
                    : 'text-[#94a3b8] hover:text-[#f0f4fc]'
                }`}
              >
                Files ({result.files_analysed})
              </button>
              <button
                onClick={() => setActiveTab('export')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  activeTab === 'export'
                    ? 'bg-[#1e283d] text-white shadow-sm'
                    : 'text-[#94a3b8] hover:text-[#f0f4fc]'
                }`}
              >
                Export
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-6 text-xs text-[#94a3b8]">
              <span className="hidden md:inline hover:text-white transition-colors cursor-default">
                Zero Configuration
              </span>
              <span className="hidden md:inline hover:text-white transition-colors cursor-default">
                Gemini 3.8 Intelligence
              </span>
              <span className="hidden md:inline hover:text-white transition-colors cursor-default">
                Full-Stack Architecture
              </span>
            </div>
          )}
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowDiagnostic(!showDiagnostic)}
            className={`p-1.5 rounded-lg border transition-colors ${
              showDiagnostic
                ? 'bg-[#1e283d] border-[#38bdf8] text-[#38bdf8]'
                : 'bg-[#111622] border-[#1e283d] text-[#94a3b8] hover:text-white hover:border-[#2e3e5c]'
            }`}
            title="System Diagnostics & Engine Status"
          >
            <Activity size={15} />
          </button>

          {result ? (
            <button
              onClick={() => {
                setResult(null);
                setRepoUrl('');
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#141c2e] hover:bg-[#1a243a] text-[#f0f4fc] border border-[#1e283d] transition-colors whitespace-nowrap cursor-pointer"
            >
              New Audit
            </button>
          ) : (
            <button
              onClick={() => handleAnalyze()}
              disabled={analyzing}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#38bdf8] hover:bg-[#0ea5e9] text-[#090d14] transition-colors whitespace-nowrap shadow-sm cursor-pointer disabled:opacity-50"
            >
              Analyze Repo
            </button>
          )}
        </div>
      </header>

      {/* ── Diagnostic Drawer / Banner ────────────────────────────────────── */}
      {showDiagnostic && (
        <aside aria-label="System Diagnostics" className="bg-[#0f1523] border-b border-[#1e283d] px-6 py-3 text-xs text-[#94a3b8] transition-all animate-in slide-in-from-top-2">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    health?.status === 'ok' ? 'bg-[#22c55e]' : 'bg-[#eab308]'
                  }`}
                ></span>
                <span className="text-[#f0f4fc] font-medium">
                  {health?.status === 'ok' ? 'System Nominal' : 'Degraded (HTTP Fallback)'}
                </span>
              </div>
              <span>·</span>
              <span>
                Engine: <span className="text-[#f0f4fc] font-mono">{health?.default_model || 'gemini-3.8-flash'}</span>
              </span>
              <span>·</span>
              <span>
                Git: <span className="text-[#f0f4fc]">{health?.git_available ? 'Available' : 'Cloud Archive'}</span>
              </span>
              <span>·</span>
              <span>
                Gemini SDK: <span className="text-[#f0f4fc]">{health?.gemini_available ? 'Active' : 'Unconfigured'}</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchHealth}
                disabled={loadingHealth}
                className="flex items-center gap-1 text-[#38bdf8] hover:underline"
              >
                <RefreshCw size={12} className={loadingHealth ? 'animate-spin' : ''} />
                <span>Refresh Status</span>
              </button>
              <button
                onClick={() => setShowDiagnostic(false)}
                className="text-[#64748b] hover:text-[#f0f4fc]"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ── Main Canvas Viewport ───────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* If no result: Show Hero Search & Quick Starters */}
        {!result && (
          <div className="space-y-10 py-6">
            {/* Hero Header */}
            <div className="space-y-3 max-w-2xl">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white" style={{ textWrap: 'balance' }}>
                Inspect and decode any GitHub repository.
              </h1>
              <p className="text-base text-[#94a3b8] leading-relaxed">
                Extract source code structure, evaluate dependencies, and generate a clear,
                student-friendly architectural explanation powered by Google Gemini.
              </p>
            </div>

            {/* Input & Search Console */}
            <div className="bg-[#0f1523] border border-[#1e283d] rounded-xl p-3 shadow-xl space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748b]">
                    <Search size={16} />
                  </div>
                  <input
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !analyzing && handleAnalyze()}
                    placeholder="https://github.com/owner/repository"
                    disabled={analyzing}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#141c2e] border border-[#1e283d] focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] rounded-lg text-sm text-[#f0f4fc] placeholder-[#64748b] outline-none transition-all"
                  />
                </div>

                <div className="sm:w-52">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={analyzing}
                    aria-label="Model Choice"
                    className="w-full py-2.5 px-3 bg-[#141c2e] border border-[#1e283d] focus:border-[#38bdf8] rounded-lg text-xs text-[#f0f4fc] outline-none transition-all cursor-pointer font-mono"
                  >
                    <option value="Auto (default)">Auto (default)</option>
                    {(health?.available_models || [
                      'gemini-3.8-flash',
                      'gemini-3.1-pro-preview',
                      'gemini-3.1-flash-lite',
                    ]).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => handleAnalyze()}
                  disabled={analyzing}
                  className="bg-[#38bdf8] hover:bg-[#0ea5e9] text-[#090d14] font-semibold px-5 py-2.5 rounded-lg text-xs transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>

              {/* Error Callout */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-950/30 border border-red-800/40 rounded-lg text-xs text-red-300">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Quick Starters Grid */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                Benchmark Repositories
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {SAMPLE_REPOS.map((sample) => (
                  <button
                    key={sample.name}
                    onClick={() => {
                      setRepoUrl(sample.url);
                      handleAnalyze(sample.url);
                    }}
                    disabled={analyzing}
                    className="p-3.5 bg-[#0f1523] hover:bg-[#141c2e] border border-[#1e283d] hover:border-[#2e3e5c] rounded-xl text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-[#f0f4fc] group-hover:text-[#38bdf8]">
                      <span>{sample.name}</span>
                      <ChevronRight size={13} className="text-[#64748b] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[11px] text-[#64748b] mt-1 line-clamp-1">{sample.desc}</p>
                    <p className="text-[10px] text-[#475569] font-mono mt-2 truncate">
                      {sample.url.replace('https://github.com/', '')}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Platform Highlights */}
            <div className="border-t border-[#1e283d] pt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#f0f4fc]">
                  <Layers size={14} className="text-[#38bdf8]" />
                  <span>Shallow Extraction</span>
                </div>
                <p className="text-xs text-[#94a3b8] leading-relaxed">
                  Fetches tree manifests and source files without bloat, skipping large binaries,
                  lockfiles, and dependencies.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#f0f4fc]">
                  <Code size={14} className="text-[#818cf8]" />
                  <span>Modular Categorization</span>
                </div>
                <p className="text-xs text-[#94a3b8] leading-relaxed">
                  Sorts code into manifests, entrypoints, services, and tests according to standard
                  heuristic limits.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#f0f4fc]">
                  <Terminal size={14} className="text-[#34d399]" />
                  <span>Architecture Synthesis</span>
                </div>
                <p className="text-xs text-[#94a3b8] leading-relaxed">
                  Outputs clean Markdown sections grounded strictly in real code: purpose, features,
                  tech stack, and operational flow.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Display */}
        {analyzing && (
          <div className="bg-[#0f1523] border border-[#1e283d] rounded-xl p-8 space-y-4 text-center max-w-lg mx-auto">
            <div className="flex justify-center">
              <RefreshCw size={24} className="text-[#38bdf8] animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#f0f4fc]">{progressLabel}</p>
              <p className="text-xs text-[#64748b] font-mono tabular-nums">{progressStep}% complete</p>
            </div>
            <div className="w-full bg-[#141c2e] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#38bdf8] h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressStep}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* ── Analyzed Repository View ──────────────────────────────────────── */}
        {result && !analyzing && (
          <div className="space-y-6">
            {/* Repository Header Strip (Single elevation) */}
            <div className="bg-[#0f1523] border border-[#1e283d] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold tracking-tight text-white">{result.project_name}</h2>
                  <a
                    href={result.repo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#64748b] hover:text-[#38bdf8] transition-colors p-1"
                    title="Open on GitHub"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
                {/* Zero-Pill Unboxed Metadata with · separator */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#94a3b8]">
                  <span>{result.repo_url.replace('https://github.com/', '')}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{result.files_analysed} files audited</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{totalCharsCount.toLocaleString()} chars</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{result.elapsed_seconds}s</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[#a5b4fc]">{result.model_used}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto">
                <button
                  onClick={handleCopySummary}
                  className="px-3 py-1.5 bg-[#141c2e] hover:bg-[#1a243a] border border-[#1e283d] rounded-lg text-xs font-medium text-[#cbd5e1] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedSummary ? <Check size={13} className="text-[#22c55e]" /> : <Copy size={13} />}
                  <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={handleDownloadMarkdown}
                  className="px-3 py-1.5 bg-[#141c2e] hover:bg-[#1a243a] border border-[#1e283d] rounded-lg text-xs font-medium text-[#cbd5e1] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download size={13} />
                  <span>Download .md</span>
                </button>
                <a
                  href={result.repo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-[#141c2e] hover:bg-[#1a243a] border border-[#1e283d] rounded-lg text-xs font-medium text-[#cbd5e1] flex items-center gap-1.5 transition-colors"
                >
                  <GitBranch size={13} />
                  <span>GitHub</span>
                </a>
              </div>
            </div>

            {/* Language Breakdown Ribbon */}
            {languagePercentages.length > 0 && (
              <div className="space-y-2">
                <div className="w-full h-2 rounded-full overflow-hidden flex bg-[#141c2e]">
                  {languagePercentages.map((l) => (
                    <div
                      key={l.name}
                      style={{ width: `${l.pct}%`, backgroundColor: l.color }}
                      title={`${l.name}: ${l.pct}% (${l.count} files)`}
                      className="h-full transition-all"
                    />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#94a3b8]">
                  {languagePercentages.map((l) => (
                    <div key={l.name} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: l.color }} />
                      <span className="font-medium text-[#f0f4fc]">{l.name}</span>
                      <span className="font-mono text-[#64748b] tabular-nums">{l.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tab Views ──────────────────────────────────────────────── */}

            {/* Tab 1: Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="bg-[#0f1523] border border-[#1e283d] rounded-xl p-6 md:p-8">
                  <div className="markdown-doc">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.explanation}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Architecture Focus */}
            {activeTab === 'architecture' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#0f1523] border border-[#1e283d] rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#38bdf8]">
                      <Layers size={16} />
                      <span>Audited Languages</span>
                    </div>
                    <div className="divide-y divide-[#1e283d]">
                      {Object.entries(result.languages).map(([lang, count]) => (
                        <div key={lang} className="py-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: LANG_COLORS[lang] || '#64748b' }}
                            />
                            <span className="font-medium text-[#f0f4fc]">{lang}</span>
                          </div>
                          <span className="font-mono text-[#94a3b8] tabular-nums">
                            {count} {count === 1 ? 'file' : 'files'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#0f1523] border border-[#1e283d] rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#a5b4fc]">
                      <Activity size={16} />
                      <span>Execution Profile</span>
                    </div>
                    <div className="divide-y divide-[#1e283d] text-xs">
                      <div className="py-2.5 flex items-center justify-between">
                        <span className="text-[#94a3b8]">Processing Engine</span>
                        <span className="font-mono text-[#f0f4fc]">{result.model_used}</span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between">
                        <span className="text-[#94a3b8]">Audit Duration</span>
                        <span className="font-mono text-[#f0f4fc] tabular-nums">{result.elapsed_seconds}s</span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between">
                        <span className="text-[#94a3b8]">Files Analyzed</span>
                        <span className="font-mono text-[#f0f4fc] tabular-nums">{result.files_analysed} files</span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between">
                        <span className="text-[#94a3b8]">Extracted Character Volume</span>
                        <span className="font-mono text-[#f0f4fc] tabular-nums">{totalCharsCount.toLocaleString()} chars</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0f1523] border border-[#1e283d] rounded-xl p-6 md:p-8">
                  <div className="markdown-doc">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.explanation}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Interactive File Explorer with Source Viewer */}
            {activeTab === 'files' && (
              <div className="bg-[#0f1523] border border-[#1e283d] rounded-xl overflow-hidden">
                <div className="p-4 border-b border-[#1e283d] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3 top-3 text-[#64748b]" />
                    <input
                      type="text"
                      placeholder="Filter files by path or language..."
                      value={fileSearch}
                      onChange={(e) => setFileSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-[#141c2e] border border-[#1e283d] rounded-lg text-xs text-[#f0f4fc] placeholder-[#64748b] outline-none"
                    />
                  </div>
                  <span className="text-xs text-[#94a3b8] font-mono tabular-nums">
                    Showing {filteredFiles.length} of {result.files_analysed} files
                  </span>
                </div>

                <div className="divide-y divide-[#1e283d]/60 max-h-[500px] overflow-y-auto">
                  {filteredFiles.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#64748b]">
                      No files match query "{fileSearch}"
                    </div>
                  ) : (
                    filteredFiles.map((file) => {
                      const color = LANG_COLORS[file.language] || '#64748b';
                      return (
                        <div
                          key={file.path}
                          className="px-4 py-3 flex items-center justify-between hover:bg-[#141c2e] transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 truncate pr-4">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <FileCode size={15} className="text-[#64748b] shrink-0" />
                            <span className="text-xs font-mono text-[#f0f4fc] truncate" title={file.path}>
                              {file.path}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <span className="text-xs text-[#94a3b8] hidden sm:inline">{file.language}</span>
                            <span className="text-xs font-mono text-[#64748b] tabular-nums">
                              {file.chars.toLocaleString()} ch
                            </span>
                            {file.content && (
                              <button
                                onClick={() => setSelectedFile(file)}
                                className="px-2.5 py-1 text-[11px] font-medium bg-[#1e283d] hover:bg-[#2e3e5c] text-[#f0f4fc] rounded transition-colors cursor-pointer"
                              >
                                View
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: Raw Export & Documentation Sharing */}
            {activeTab === 'export' && (
              <div className="space-y-4">
                <div className="bg-[#0f1523] border border-[#1e283d] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-semibold text-[#f0f4fc]">Raw Markdown Report</h3>
                      <p className="text-xs text-[#64748b]">
                        Ready to paste into your project's README.md, technical spec, or wiki.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopySummary}
                        className="px-3 py-1.5 bg-[#141c2e] hover:bg-[#1a243a] border border-[#1e283d] rounded-lg text-xs font-medium text-[#f0f4fc] flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedSummary ? <Check size={13} className="text-[#22c55e]" /> : <Copy size={13} />}
                        <span>{copiedSummary ? 'Copied' : 'Copy Markdown'}</span>
                      </button>
                      <button
                        onClick={handleDownloadMarkdown}
                        className="px-3 py-1.5 bg-[#38bdf8] hover:bg-[#0ea5e9] text-[#090d14] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Download size={13} />
                        <span>Save .md</span>
                      </button>
                    </div>
                  </div>

                  <pre className="p-4 bg-[#090d14] border border-[#1e283d] rounded-lg text-xs font-mono text-[#94a3b8] overflow-x-auto max-h-96 whitespace-pre-wrap">
                    {result.explanation}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── File Content Modal / Drawer ───────────────────────────────────── */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#1e283d] flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <FileCode size={16} className="text-[#38bdf8]" />
                <span className="text-xs font-mono font-semibold text-[#f0f4fc] truncate">
                  {selectedFile.path}
                </span>
                <span className="text-xs text-[#64748b]">·</span>
                <span className="text-xs text-[#94a3b8]">{selectedFile.language}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyFileContent}
                  className="px-2.5 py-1 text-xs bg-[#141c2e] hover:bg-[#1a243a] text-[#f0f4fc] border border-[#1e283d] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copiedFile ? <Check size={12} className="text-[#22c55e]" /> : <Copy size={12} />}
                  <span>{copiedFile ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-1 text-[#64748b] hover:text-[#f0f4fc] rounded-lg hover:bg-[#141c2e] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-1 bg-[#090d14]">
              <pre className="text-xs font-mono text-[#cbd5e1] leading-relaxed whitespace-pre-wrap">
                {selectedFile.content || 'No content preview available'}
              </pre>
            </div>

            <div className="px-5 py-3 border-t border-[#1e283d] text-[11px] text-[#64748b] flex justify-between items-center">
              <span>{selectedFile.chars.toLocaleString()} characters extracted</span>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-xs text-[#38bdf8] hover:underline cursor-pointer"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
