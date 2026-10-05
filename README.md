# RepoLens: GitHub Repository Code Explainer

A modern AI application that takes a GitHub repository URL and explains the codebase in clear, structured, beginner-friendly language.

```
GitHub URL → Git Clone / Archive Fetch → Read & Filter Source Files → Prompt Synthesis → Gemini / LLM Analyzer
                                                                                               ↓
Modern React SPA (Vite + Tailwind) ← Express Backend ← Structured Markdown Explanation
```

## Features

- **Public Repository Analysis:** Accepts any public GitHub repository URL (`https://github.com/username/repository`).
- **Smart Source Code Extraction:** Clones or downloads repository code, selectively filters out `node_modules`, lockfiles, build artifacts, and binaries, and categorizes files (readme, entry points, source files, manifests, configs).
- **Intelligent LLM Explanations:** Sends extracted code context to Gemini (`gemini-3.8-flash` via `@google/genai`) or local models to generate a structured 5-part architecture guide:
  - **Project Overview:** High-level summary of the repository purpose.
  - **Features:** Concrete functionality supported by the real code.
  - **Main Technologies:** Languages, libraries, frameworks, and tooling.
  - **How It Works:** Step-by-step numbered execution flow.
  - **Project Structure:** File roles and directory responsibilities.
- **Modern Responsive Dashboard:** Beautiful dark-themed dashboard with language tags, metric cards, copyable summaries, and collapsible file breakdowns.

## Project Structure

```
.
├── server.ts              # Express server with Vite middleware integration
├── src/
│   ├── backend/
│   │   └── processor.ts   # Repository cloning, filtering, & Gemini prompt execution
│   ├── App.tsx            # Main React UI component
│   ├── main.tsx           # React DOM entry point
│   └── index.css          # Tailwind CSS styling and custom markdown theme
├── index.html             # Application entry point
├── metadata.json          # App metadata & capabilities
├── package.json           # Node.js dependencies and build scripts
├── tsconfig.json          # TypeScript configuration
└── vite.config.ts         # Vite build and dev configuration
```

## Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` to use the application.

## Deploying to Vercel

The repository is pre-configured for Vercel Serverless Functions (`api/index.ts` + `vercel.json`):

### Option 1: Vercel Web Dashboard (Recommended)
1. Push this repository to GitHub.
2. Go to [Vercel Dashboard](https://vercel.com/new) and click **Import Project**.
3. Select your repository.
4. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: Your Google Gemini API Key
5. Click **Deploy**.

### Option 2: Vercel CLI
```bash
npm install -g vercel
vercel
# Follow prompts, set GEMINI_API_KEY when asked or in project settings
```
