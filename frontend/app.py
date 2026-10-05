import os
import time

import requests
import streamlit as st

API_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:8001").rstrip("/")

st.set_page_config(
    page_title="RepoLens — GitHub Code Explainer",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS for modern dark theme ─────────────────────────────────────────
st.markdown(
    """
<style>
/* ── Import Google Fonts ──────────────────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

/* ── Root variables ───────────────────────────────────────────────────────── */
:root {
    --bg-primary: #0d1117;
    --bg-secondary: #161b22;
    --bg-card: #1c2128;
    --bg-card-hover: #21262d;
    --border-color: #30363d;
    --border-accent: #58a6ff;
    --text-primary: #e6edf3;
    --text-secondary: #8b949e;
    --text-muted: #6e7681;
    --accent-blue: #58a6ff;
    --accent-green: #3fb950;
    --accent-purple: #bc8cff;
    --accent-orange: #d29922;
    --accent-red: #f85149;
    --gradient-start: #58a6ff;
    --gradient-end: #bc8cff;
}

/* ── Global overrides ─────────────────────────────────────────────────────── */
.stApp {
    background: var(--bg-primary) !important;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
}

/* Hide the default Streamlit header/footer */
header[data-testid="stHeader"] {
    background: transparent !important;
}
#MainMenu, footer, .stDeployButton { display: none !important; }

/* ── Sidebar ──────────────────────────────────────────────────────────────── */
section[data-testid="stSidebar"] {
    background: var(--bg-secondary) !important;
    border-right: 1px solid var(--border-color) !important;
}
section[data-testid="stSidebar"] .stMarkdown p,
section[data-testid="stSidebar"] .stMarkdown span,
section[data-testid="stSidebar"] label {
    color: var(--text-secondary) !important;
    font-family: 'Inter', sans-serif !important;
}

/* ── Typography ───────────────────────────────────────────────────────────── */
h1, h2, h3, h4, h5, h6 {
    font-family: 'Inter', sans-serif !important;
    color: var(--text-primary) !important;
    font-weight: 600 !important;
}
p, li, span, div {
    color: var(--text-primary) !important;
}

/* ── Text input ───────────────────────────────────────────────────────────── */
.stTextInput input {
    background: var(--bg-card) !important;
    border: 1px solid var(--border-color) !important;
    border-radius: 12px !important;
    color: var(--text-primary) !important;
    padding: 14px 18px !important;
    font-size: 15px !important;
    font-family: 'Inter', sans-serif !important;
    transition: border-color 0.3s ease, box-shadow 0.3s ease !important;
}
.stTextInput input:focus {
    border-color: var(--accent-blue) !important;
    box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15) !important;
}
.stTextInput input::placeholder {
    color: var(--text-muted) !important;
}

/* ── Selectbox ────────────────────────────────────────────────────────────── */
.stSelectbox > div > div {
    background: var(--bg-card) !important;
    border: 1px solid var(--border-color) !important;
    border-radius: 12px !important;
    color: var(--text-primary) !important;
}

/* ── Primary button ───────────────────────────────────────────────────────── */
.stButton > button[kind="primary"],
button[data-testid="stBaseButton-primary"] {
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end)) !important;
    color: #ffffff !important;
    border: none !important;
    border-radius: 12px !important;
    padding: 14px 28px !important;
    font-weight: 600 !important;
    font-size: 15px !important;
    font-family: 'Inter', sans-serif !important;
    letter-spacing: 0.3px !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    box-shadow: 0 4px 15px rgba(88, 166, 255, 0.25) !important;
}
.stButton > button[kind="primary"]:hover,
button[data-testid="stBaseButton-primary"]:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 25px rgba(88, 166, 255, 0.35) !important;
}

/* ── Cards (custom HTML) ──────────────────────────────────────────────────── */
.glass-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 16px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.glass-card:hover {
    border-color: var(--border-accent);
    background: var(--bg-card-hover);
    box-shadow: 0 8px 32px rgba(88, 166, 255, 0.08);
}

/* ── Animated gradient text ───────────────────────────────────────────────── */
.gradient-text {
    background: linear-gradient(135deg, #58a6ff, #bc8cff, #f778ba);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 700;
}
.gradient-text-lg {
    font-size: 2.5rem;
    line-height: 1.2;
}

/* ── Status badges ────────────────────────────────────────────────────────── */
.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    font-family: 'Inter', sans-serif;
}
.status-ok {
    background: rgba(63, 185, 80, 0.15);
    color: #3fb950;
    border: 1px solid rgba(63, 185, 80, 0.3);
}
.status-warn {
    background: rgba(210, 153, 34, 0.15);
    color: #d29922;
    border: 1px solid rgba(210, 153, 34, 0.3);
}
.status-error {
    background: rgba(248, 81, 73, 0.15);
    color: #f85149;
    border: 1px solid rgba(248, 81, 73, 0.3);
}

/* ── Metric cards ─────────────────────────────────────────────────────────── */
.metric-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 16px 20px;
    text-align: center;
}
.metric-value {
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--accent-blue);
    font-family: 'JetBrains Mono', monospace;
}
.metric-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 4px;
}

/* ── Language tags ────────────────────────────────────────────────────────── */
.lang-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    font-family: 'JetBrains Mono', monospace;
    margin: 3px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
}

/* ── File tree ────────────────────────────────────────────────────────────── */
.file-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-radius: 8px;
    margin: 4px 0;
    background: var(--bg-secondary);
    border: 1px solid transparent;
    transition: all 0.2s ease;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
}
.file-item:hover {
    border-color: var(--border-color);
    background: var(--bg-card);
}
.file-path { color: var(--text-primary); }
.file-meta { color: var(--text-muted); font-size: 11px; }

/* ── Animated pulse dot ───────────────────────────────────────────────────── */
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}
.pulse-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 6px;
    animation: pulse 2s ease-in-out infinite;
}
.pulse-green { background: #3fb950; }
.pulse-yellow { background: #d29922; }
.pulse-red { background: #f85149; }

/* ── Fade-in animation ────────────────────────────────────────────────────── */
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}
.fade-in {
    animation: fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* ── Expander override ────────────────────────────────────────────────────── */
.streamlit-expanderHeader {
    background: var(--bg-card) !important;
    border-radius: 12px !important;
    color: var(--text-primary) !important;
    font-family: 'Inter', sans-serif !important;
}

/* ── Spinner override ─────────────────────────────────────────────────────── */
.stSpinner > div { color: var(--accent-blue) !important; }

/* ── Divider ──────────────────────────────────────────────────────────────── */
hr {
    border-color: var(--border-color) !important;
    opacity: 0.5 !important;
}

/* ── Markdown content in explanation ──────────────────────────────────────── */
.explanation-content h1 {
    font-size: 1.5rem !important;
    margin-top: 28px !important;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
}
.explanation-content h2 {
    font-size: 1.25rem !important;
    margin-top: 24px !important;
    color: var(--accent-blue) !important;
}
.explanation-content code {
    background: var(--bg-secondary) !important;
    padding: 2px 8px !important;
    border-radius: 6px !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 13px !important;
    color: var(--accent-purple) !important;
}
.explanation-content pre {
    background: var(--bg-secondary) !important;
    border: 1px solid var(--border-color) !important;
    border-radius: 12px !important;
    padding: 16px !important;
}
.explanation-content ul, .explanation-content ol {
    padding-left: 24px !important;
}
.explanation-content li {
    margin-bottom: 6px !important;
    line-height: 1.7 !important;
}
.explanation-content table {
    border-collapse: collapse !important;
    width: 100% !important;
    margin: 16px 0 !important;
}
.explanation-content th {
    background: var(--bg-secondary) !important;
    padding: 10px 14px !important;
    text-align: left !important;
    border-bottom: 2px solid var(--border-color) !important;
    font-weight: 600 !important;
}
.explanation-content td {
    padding: 8px 14px !important;
    border-bottom: 1px solid var(--border-color) !important;
}
</style>
""",
    unsafe_allow_html=True,
)


# ── Helper functions ─────────────────────────────────────────────────────────
def fetch_health() -> dict | None:
    try:
        response = requests.get(f"{API_URL}/api/health", timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        return None


def explain_repo(repo_url: str, model: str | None) -> dict:
    payload = {"repo_url": repo_url}
    if model:
        payload["model"] = model
    response = requests.post(f"{API_URL}/api/explain", json=payload, timeout=1200)
    try:
        data = response.json()
    except ValueError:
        data = {"detail": response.text[:500]}
    if response.status_code != 200:
        detail = data.get("detail", "Unknown error")
        if isinstance(detail, list):
            detail = "; ".join(str(item) for item in detail)
        raise RuntimeError(str(detail))
    return data


# ── Language color map ────────────────────────────────────────────────────────
LANG_COLORS = {
    "Python": "#3572A5",
    "JavaScript": "#f1e05a",
    "TypeScript": "#3178c6",
    "Java": "#b07219",
    "C": "#555555",
    "C++": "#f34b7d",
    "C#": "#178600",
    "Go": "#00ADD8",
    "Rust": "#dea584",
    "Ruby": "#701516",
    "PHP": "#4F5D95",
    "Swift": "#F05138",
    "Kotlin": "#A97BFF",
    "HTML": "#e34c26",
    "CSS": "#563d7c",
    "SCSS": "#c6538c",
    "Shell": "#89e051",
    "PowerShell": "#012456",
    "SQL": "#e38c00",
    "Vue": "#41b883",
    "Svelte": "#ff3e00",
    "Dart": "#00B4AB",
    "YAML": "#cb171e",
    "JSON": "#292929",
    "TOML": "#9c4221",
    "Markdown": "#083fa1",
    "Text": "#6e7681",
}


def lang_color(lang: str) -> str:
    return LANG_COLORS.get(lang, "#8b949e")


# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(
        '<div style="padding: 8px 0 16px 0;">'
        '<span class="gradient-text" style="font-size: 1.4rem;">🔍 RepoLens</span>'
        '<p style="color: #8b949e; font-size: 0.85rem; margin-top: 4px;">AI-Powered Code Explainer</p>'
        "</div>",
        unsafe_allow_html=True,
    )

    st.markdown("---")

    API_URL = st.text_input(
        "⚡ Backend URL",
        value=API_URL,
        key="backend_url",
        help="The URL where the FastAPI backend is running",
    ).rstrip("/")

    health = fetch_health()

    st.markdown(
        '<p style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; '
        'color: #8b949e; margin-top: 16px; margin-bottom: 8px;">System Status</p>',
        unsafe_allow_html=True,
    )

    if health is None:
        st.markdown(
            '<div class="glass-card" style="padding: 16px;">'
            '<span class="status-badge status-error">'
            '<span class="pulse-dot pulse-red"></span>Offline</span>'
            f'<p style="color: #8b949e; font-size: 0.8rem; margin-top: 8px;">Backend at {API_URL} is not reachable</p>'
            "</div>",
            unsafe_allow_html=True,
        )
        models = []
        default_model = None
    else:
        if health["status"] == "ok":
            badge = '<span class="status-badge status-ok"><span class="pulse-dot pulse-green"></span>All Systems Ready</span>'
        else:
            badge = '<span class="status-badge status-warn"><span class="pulse-dot pulse-yellow"></span>Degraded</span>'

        git_icon = "✅" if health["git_available"] else "❌"
        ollama_icon = "✅" if health["ollama_available"] else "❌"
        ollama_detail = "Connected" if health["ollama_available"] else f'Not reachable ({health["ollama_host"]})'

        st.markdown(
            f'<div class="glass-card" style="padding: 16px;">'
            f"{badge}"
            f'<div style="margin-top: 12px; font-size: 0.85rem;">'
            f'<div style="display: flex; justify-content: space-between; padding: 4px 0;">'
            f'<span style="color: #8b949e;">Git</span>'
            f'<span>{git_icon} {"Available" if health["git_available"] else "Missing"}</span></div>'
            f'<div style="display: flex; justify-content: space-between; padding: 4px 0;">'
            f'<span style="color: #8b949e;">Ollama</span>'
            f"<span>{ollama_icon} {ollama_detail}</span></div>"
            f"</div></div>",
            unsafe_allow_html=True,
        )

        models = health["available_models"]
        default_model = health["default_model"]

    st.markdown("---")
    st.markdown(
        '<p style="font-size: 0.7rem; color: #6e7681; text-align: center; margin-top: 16px;">'
        "Built with FastAPI + Ollama + Streamlit<br>"
        "Powered by local LLMs 🧠"
        "</p>",
        unsafe_allow_html=True,
    )


# ── Main Content ──────────────────────────────────────────────────────────────
st.markdown(
    '<div class="fade-in" style="text-align: center; padding: 40px 0 20px 0;">'
    '<h1 class="gradient-text gradient-text-lg" style="margin-bottom: 8px;">Understand Any GitHub Repo</h1>'
    '<p style="color: #8b949e; font-size: 1.1rem; max-width: 600px; margin: 0 auto;">'
    "Paste a public repository URL and get a clear, beginner-friendly explanation "
    "powered by a local LLM — no data leaves your machine."
    "</p></div>",
    unsafe_allow_html=True,
)

# ── Input section ─────────────────────────────────────────────────────────────
st.markdown('<div style="max-width: 800px; margin: 0 auto;">', unsafe_allow_html=True)

col_input, col_model = st.columns([3, 1])

with col_input:
    repo_url = st.text_input(
        "Repository URL",
        placeholder="https://github.com/username/repository",
        label_visibility="collapsed",
        key="repo_url",
    )

with col_model:
    model_options = ["Auto (default)"] + models if models else ["Auto (default)"]
    model_choice = st.selectbox("Model", model_options, label_visibility="collapsed") if models else None
    selected_model = None
    if model_choice and model_choice != "Auto (default)":
        selected_model = model_choice

run = st.button(
    "🔍  Analyze Repository",
    type="primary",
    use_container_width=True,
    key="explain_button",
)

st.markdown("</div>", unsafe_allow_html=True)

# ── Processing ────────────────────────────────────────────────────────────────
if run:
    if not repo_url.strip():
        st.error("⚠️ Please enter a GitHub repository URL.")
    elif health is None:
        st.error("⚠️ The backend is not running. Start it first.")
    else:
        started = time.time()

        progress_bar = st.progress(0, text="🔄 Initializing analysis...")
        status_placeholder = st.empty()

        # Simulate progress steps while waiting
        steps = [
            (10, "📦 Cloning repository..."),
            (30, "📂 Scanning source files..."),
            (50, "🧠 Sending code to local LLM..."),
            (70, "✍️ Generating explanation..."),
        ]
        for pct, msg in steps:
            progress_bar.progress(pct, text=msg)
            time.sleep(0.5)

        try:
            result = explain_repo(repo_url.strip(), selected_model)
        except RuntimeError as exc:
            progress_bar.empty()
            st.error(f"❌ {exc}")
            st.stop()
        except requests.RequestException as exc:
            progress_bar.empty()
            st.error(f"❌ Could not reach the backend: {exc}")
            st.stop()

        progress_bar.progress(100, text="✅ Analysis complete!")
        time.sleep(0.5)
        progress_bar.empty()

        st.session_state["result"] = result
        st.session_state["frontend_elapsed"] = round(time.time() - started, 2)

# ── Results ───────────────────────────────────────────────────────────────────
result = st.session_state.get("result")
if result:
    st.markdown("---")

    # ── Project header ────────────────────────────────────────────────────────
    st.markdown(
        f'<div class="fade-in glass-card" style="margin-top: 16px;">'
        f'<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;">'
        f'<div>'
        f'<h2 style="margin: 0; font-size: 1.5rem;">{result["project_name"]}</h2>'
        f'<p style="color: #8b949e; margin: 4px 0 0 0; font-size: 0.9rem;">{result["repo_url"]}</p>'
        f"</div>"
        f'<div style="display: flex; gap: 8px;">'
        f'<span class="status-badge status-ok">✅ Analyzed</span>'
        f"</div></div></div>",
        unsafe_allow_html=True,
    )

    # ── Metrics row ───────────────────────────────────────────────────────────
    m1, m2, m3, m4 = st.columns(4)
    with m1:
        st.markdown(
            f'<div class="metric-card fade-in">'
            f'<div class="metric-value">{result["files_analysed"]}</div>'
            f'<div class="metric-label">Files Analyzed</div></div>',
            unsafe_allow_html=True,
        )
    with m2:
        st.markdown(
            f'<div class="metric-card fade-in">'
            f'<div class="metric-value">{len(result["languages"])}</div>'
            f'<div class="metric-label">Languages</div></div>',
            unsafe_allow_html=True,
        )
    with m3:
        st.markdown(
            f'<div class="metric-card fade-in">'
            f'<div class="metric-value">{result["elapsed_seconds"]}s</div>'
            f'<div class="metric-label">Processing Time</div></div>',
            unsafe_allow_html=True,
        )
    with m4:
        st.markdown(
            f'<div class="metric-card fade-in">'
            f'<div class="metric-value" style="font-size: 1rem;">{result["model_used"]}</div>'
            f'<div class="metric-label">Model Used</div></div>',
            unsafe_allow_html=True,
        )

    # ── Language tags ─────────────────────────────────────────────────────────
    if result["languages"]:
        tags_html = " ".join(
            f'<span class="lang-tag">'
            f'<span style="width:10px;height:10px;border-radius:50%;background:{lang_color(name)};"></span>'
            f"{name} ({count})</span>"
            for name, count in result["languages"].items()
        )
        st.markdown(
            f'<div class="fade-in" style="margin: 12px 0 20px 0;">{tags_html}</div>',
            unsafe_allow_html=True,
        )

    # ── Explanation ───────────────────────────────────────────────────────────
    st.markdown(
        '<div class="fade-in glass-card explanation-content">',
        unsafe_allow_html=True,
    )
    st.markdown(result["explanation"])
    st.markdown("</div>", unsafe_allow_html=True)

    # ── File list ─────────────────────────────────────────────────────────────
    with st.expander(f"📁 Source Files Analyzed ({result['files_analysed']})"):
        files_html = ""
        for item in result["files"]:
            color = lang_color(item["language"])
            files_html += (
                f'<div class="file-item">'
                f'<span class="file-path">'
                f'<span style="width:8px;height:8px;border-radius:50%;background:{color};'
                f'display:inline-block;margin-right:8px;"></span>'
                f'{item["path"]}</span>'
                f'<span class="file-meta">{item["language"]} · {item["chars"]:,} chars</span>'
                f"</div>"
            )
        st.markdown(files_html, unsafe_allow_html=True)

else:
    # ── Empty state ───────────────────────────────────────────────────────────
    st.markdown(
        '<div class="fade-in" style="text-align: center; padding: 60px 20px;">'
        '<div style="font-size: 4rem; margin-bottom: 16px;">🔍</div>'
        '<h3 style="color: #8b949e; font-weight: 400;">Enter a repository URL above to get started</h3>'
        '<p style="color: #6e7681; max-width: 400px; margin: 8px auto;">'
        "RepoLens will clone the repository, analyze the source code, and generate a "
        "clear explanation using a local LLM."
        "</p></div>",
        unsafe_allow_html=True,
    )
