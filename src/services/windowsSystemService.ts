// Sovereign Windows System & Software Installer Service
// Enables Auro to inspect local Windows 11 system metrics, execute PowerShell/CMD commands,
// and guide the user through step-by-step installations via Winget, Chocolatey, NPM, and Pip.

import { WindowsHostInfo, WindowsToolStatus, WindowsSystemExecutionResult } from '../types';
import { getApiUrl } from './api';

export interface WindowsSystemInfoResponse {
  success: boolean;
  os: WindowsHostInfo;
  tools: Record<string, WindowsToolStatus>;
}

export interface SoftwareCatalogItem {
  id: string;
  name: string;
  packageId: string;
  manager: 'winget' | 'choco' | 'npm' | 'pip';
  category: 'Dev Tools' | 'AI & ML' | 'Media & Utilities' | 'Runtimes';
  icon: string;
  description: string;
  steps: string[];
}

export const POPULAR_WINDOWS_SOFTWARE: SoftwareCatalogItem[] = [
  {
    id: 'ollama',
    name: 'Ollama Local AI',
    packageId: 'Ollama.Ollama',
    manager: 'winget',
    category: 'AI & ML',
    icon: '🦙',
    description: 'Run open-weight frontier LLMs (Llama 3.2, DeepSeek, Mistral) locally on your GPU',
    steps: [
      'Query Windows Package Manager repository for Ollama installer',
      'Download and run official Ollama silent installer with background service',
      'Verify Ollama CLI binary in PATH and check localhost:11434 API readiness',
    ],
  },
  {
    id: 'python',
    name: 'Python 3.12',
    packageId: 'Python.Python.3.12',
    manager: 'winget',
    category: 'Runtimes',
    icon: '🐍',
    description: 'Official Python programming language and Pip package manager',
    steps: [
      'Download Python 3.12 Windows 64-bit installer',
      'Install with system PATH environment registration enabled',
      'Verify python --version and pip --version',
    ],
  },
  {
    id: 'git',
    name: 'Git for Windows',
    packageId: 'Git.Git',
    manager: 'winget',
    category: 'Dev Tools',
    icon: '📦',
    description: 'Fast, scalable, distributed version control system with Git Bash and Windows Credential Manager',
    steps: [
      'Fetch Git installer package via Winget',
      'Execute silent setup with Windows Terminal integration',
      'Verify git --version and GitHub credentials',
    ],
  },
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    packageId: 'Microsoft.VisualStudioCode',
    manager: 'winget',
    category: 'Dev Tools',
    icon: '💻',
    description: 'Lightweight and extensible code editor with rich language and debugger support',
    steps: [
      'Locate Microsoft VS Code user installer via Winget',
      'Run silent installation with Windows Explorer context menu shortcuts',
      'Verify code command in PATH',
    ],
  },
  {
    id: 'ffmpeg',
    name: 'FFmpeg Media Engine',
    packageId: 'Gyan.FFmpeg',
    manager: 'winget',
    category: 'Media & Utilities',
    icon: '🎬',
    description: 'Complete cross-platform solution to record, convert, and stream audio and video',
    steps: [
      'Download Gyan full build of FFmpeg',
      'Extract binaries and register ffmpeg.exe in System PATH',
      'Verify ffmpeg -version and codecs',
    ],
  },
  {
    id: 'nodejs',
    name: 'Node.js LTS',
    packageId: 'OpenJS.NodeJS.LTS',
    manager: 'winget',
    category: 'Runtimes',
    icon: '🟢',
    description: 'Asynchronous event-driven JavaScript runtime with npm',
    steps: [
      'Fetch latest LTS Node.js distribution via Winget',
      'Install Node.js runtime and npm package manager',
      'Verify node -v and npm -v in PowerShell',
    ],
  },
  {
    id: '7zip',
    name: '7-Zip Archiver',
    packageId: '7zip.7zip',
    manager: 'winget',
    category: 'Media & Utilities',
    icon: '🗜️',
    description: 'High-ratio file archiver with 7z, ZIP, RAR, TAR, and GZ decompression',
    steps: [
      'Fetch 7-Zip package from Winget repository',
      'Perform silent installation with Windows Shell integration',
      'Verify 7z executable availability',
    ],
  },
  {
    id: 'docker',
    name: 'Docker Desktop',
    packageId: 'Docker.DockerDesktop',
    manager: 'winget',
    category: 'Dev Tools',
    icon: '🐳',
    description: 'Secure, fast way to build, share, and run containerized applications with WSL 2 backend',
    steps: [
      'Download Docker Desktop installer package',
      'Configure Windows Subsystem for Linux (WSL 2) integration',
      'Verify docker --version and daemon service status',
    ],
  },
  {
    id: 'vlc',
    name: 'VLC Media Player',
    packageId: 'VideoLAN.VLC',
    manager: 'winget',
    category: 'Media & Utilities',
    icon: '📻',
    description: 'Universal media player playing all codecs, discs, webcams, and network streams',
    steps: [
      'Fetch VideoLAN VLC installer via Winget',
      'Run silent setup with multimedia file associations',
      'Verify VLC player registration',
    ],
  },
];

/**
 * Fetch full Windows host diagnostics, RAM, CPU, and package manager statuses
 */
export async function fetchWindowsSystemInfo(): Promise<WindowsSystemInfoResponse> {
  const res = await fetch(getApiUrl('/api/system/windows/info'));
  if (!res.ok) {
    throw new Error(`Failed to fetch Windows system info (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Execute an arbitrary Windows PowerShell or CMD command
 */
export async function executeWindowsCommand(
  command: string,
  shell: 'powershell' | 'cmd' = 'powershell',
  timeoutMs = 120000,
  workingDir?: string
): Promise<WindowsSystemExecutionResult> {
  const res = await fetch(getApiUrl('/api/system/windows/execute'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, shell, timeoutMs, workingDir }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Command execution failed with HTTP ${res.status}`);
  }

  return data;
}

/**
 * Perform guided installation of a software package via Winget, Chocolatey, NPM, or Pip
 */
export async function installWindowsPackage(
  packageId: string,
  manager: 'winget' | 'choco' | 'npm' | 'pip' = 'winget',
  packageName?: string,
  args: string[] = []
): Promise<WindowsSystemExecutionResult & { verified: boolean; message: string }> {
  const res = await fetch(getApiUrl('/api/system/windows/install'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageId, manager, packageName, args }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Package installation failed with HTTP ${res.status}`);
  }

  return data;
}

/**
 * Physically launch a real Windows PowerShell window on the user's desktop
 */
export async function openWindowsTerminalWindow(
  command = '',
  runAsAdmin = false
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(getApiUrl('/api/system/windows/open-terminal'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, runAsAdmin }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Failed to open PowerShell window (HTTP ${res.status})`);
  }

  return data;
}

/**
 * Check if a CLI application or binary exists in Windows PATH
 */
export async function checkWindowsApp(appName: string): Promise<{ installed: boolean; path: string | null }> {
  const res = await fetch(getApiUrl(`/api/system/windows/check-app?app=${encodeURIComponent(appName)}`));
  if (!res.ok) {
    return { installed: false, path: null };
  }
  const data = await res.json().catch(() => ({ installed: false, path: null }));
  return { installed: Boolean(data.installed), path: data.path || null };
}

