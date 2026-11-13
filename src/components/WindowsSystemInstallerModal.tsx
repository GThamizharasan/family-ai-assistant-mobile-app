import React, { useState, useEffect } from 'react';
import {
  X,
  Terminal,
  Cpu,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Play,
  RefreshCw,
  Copy,
  Check,
  Download,
  ShieldCheck,
  PackageCheck,
  Sparkles,
  Layers,
  Activity,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import {
  fetchWindowsSystemInfo,
  executeWindowsCommand,
  installWindowsPackage,
  checkWindowsApp,
  openWindowsTerminalWindow,
  POPULAR_WINDOWS_SOFTWARE,
  WindowsSystemInfoResponse,
  SoftwareCatalogItem,
} from '../services/windowsSystemService';
import { WindowsSystemExecutionResult } from '../types';

interface WindowsSystemInstallerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPackageId?: string;
}

export const WindowsSystemInstallerModal: React.FC<WindowsSystemInstallerModalProps> = ({
  isOpen,
  onClose,
  initialPackageId,
}) => {
  const [activeTab, setActiveTab] = useState<'installer' | 'terminal' | 'diagnostics'>('installer');
  const [sysInfo, setSysInfo] = useState<WindowsSystemInfoResponse | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);

  // Installer state
  const [selectedSoftware, setSelectedSoftware] = useState<SoftwareCatalogItem | null>(null);
  const [installStep, setInstallStep] = useState<number>(0);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<WindowsSystemExecutionResult | null>(null);

  // Terminal state
  const [commandInput, setCommandInput] = useState('Get-Date');
  const [isExecutingCmd, setIsExecutingCmd] = useState(false);
  const [terminalHistory, setTerminalHistory] = useState<
    Array<{
      id: string;
      command: string;
      stdout: string;
      stderr: string;
      exitCode: number;
      durationMs: number;
      timestamp: string;
    }>
  >([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSystemInfo();
      if (initialPackageId) {
        const found = POPULAR_WINDOWS_SOFTWARE.find((s) => s.packageId === initialPackageId || s.id === initialPackageId);
        if (found) setSelectedSoftware(found);
      }
    }
  }, [isOpen, initialPackageId]);

  const loadSystemInfo = async () => {
    setIsLoadingInfo(true);
    try {
      const data = await fetchWindowsSystemInfo();
      setSysInfo(data);
    } catch (err) {
      console.warn('Failed to load Windows system info:', err);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleRunCommand = async (cmdToRun?: string) => {
    const cmd = (cmdToRun || commandInput).trim();
    if (!cmd) return;
    setIsExecutingCmd(true);

    try {
      const res = await executeWindowsCommand(cmd, 'powershell', 90000);
      setTerminalHistory((prev) => [
        {
          id: `hist_${Date.now()}`,
          command: cmd,
          stdout: res.stdout,
          stderr: res.stderr,
          exitCode: res.exitCode,
          durationMs: res.durationMs,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 20),
      ]);
    } catch (err: any) {
      setTerminalHistory((prev) => [
        {
          id: `hist_${Date.now()}`,
          command: cmd,
          stdout: '',
          stderr: err.message || 'Execution error',
          exitCode: 1,
          durationMs: 0,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 20),
      ]);
    } finally {
      setIsExecutingCmd(false);
    }
  };

  const handleStartGuidedInstall = async (software: SoftwareCatalogItem) => {
    setSelectedSoftware(software);
    setIsInstalling(true);
    setInstallResult(null);
    setInstallStep(1);

    try {
      // Step 1: Pre-installation check
      await new Promise((r) => setTimeout(r, 800));
      setInstallStep(2);

      // Step 2: Run installation command via Winget/Choco/NPM
      const res = await installWindowsPackage(software.packageId, software.manager, software.name);
      setInstallResult(res);

      setInstallStep(3);
      // Refresh system tools info after installation
      await loadSystemInfo();
    } catch (err: any) {
      setInstallResult({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: err.message || 'Installation encountered an error',
        durationMs: 0,
        command: `install ${software.packageId}`,
      });
      setInstallStep(3);
    } finally {
      setIsInstalling(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[92vh] rounded-3xl border border-slate-800 bg-slate-900/95 flex flex-col shadow-2xl relative overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:px-6 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-inner">
              <Terminal className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Auro Windows System Assistant & Installer
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                  LIVE HOST
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Direct programmatic access to local Windows 11 host, PowerShell terminal, and software package managers.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Host Summary Pill Strip */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-950/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>{sysInfo?.os.hostname || 'Windows PC'}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">{sysInfo?.os.username || 'User'}</span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1.5 text-slate-300 text-[11px]">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {sysInfo?.os.freeMemGb} GB free / {sysInfo?.os.totalMemGb} GB RAM
              </span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-[11px] text-slate-400 font-mono">
              {sysInfo?.os.cpuModel.slice(0, 32)}
            </span>
          </div>

          <button
            type="button"
            onClick={loadSystemInfo}
            disabled={isLoadingInfo}
            className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingInfo ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 sm:px-6 pt-3 flex items-center gap-2 border-b border-slate-800 bg-slate-900/60">
          <button
            type="button"
            onClick={() => setActiveTab('installer')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'installer'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Software Installer Catalog</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('terminal')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'terminal'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>PowerShell Terminal Console</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Package Managers & Tools</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: SOFTWARE INSTALLER CATALOG */}
          {activeTab === 'installer' && (
            <div className="space-y-4">
              {/* Guided Step Progress Card if active */}
              {selectedSoftware && isInstalling && (
                <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{selectedSoftware.icon}</span>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          Installing {selectedSoftware.name}
                        </h4>
                        <p className="text-[11px] text-cyan-300 font-mono">
                          Package: {selectedSoftware.packageId} via {selectedSoftware.manager.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30">
                      Step {installStep} of 3
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-cyan-400 h-full transition-all duration-500"
                      style={{ width: `${(installStep / 3) * 100}%` }}
                    />
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {selectedSoftware.steps.map((st, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 ${
                          installStep > i + 1
                            ? 'text-emerald-400 font-medium'
                            : installStep === i + 1
                            ? 'text-white font-bold'
                            : 'text-slate-500'
                        }`}
                      >
                        {installStep > i + 1 ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : installStep === i + 1 ? (
                          <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0 flex items-center justify-center text-[9px]">
                            {i + 1}
                          </div>
                        )}
                        <span>{st}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Install Result Banner */}
              {selectedSoftware && installResult && !isInstalling && (
                <div
                  className={`p-4 rounded-2xl border space-y-2 animate-in fade-in duration-200 ${
                    installResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {installResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                      )}
                      <span className="text-xs font-bold">
                        {installResult.success
                          ? `Successfully installed ${selectedSoftware.name}!`
                          : `Installation finished with exit code ${installResult.exitCode}`}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {installResult.durationMs}ms
                    </span>
                  </div>

                  {installResult.stdout && (
                    <div className="bg-slate-950/80 rounded-xl p-2.5 font-mono text-[11px] text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {installResult.stdout}
                    </div>
                  )}

                  {installResult.stderr && (
                    <div className="bg-rose-950/60 rounded-xl p-2.5 font-mono text-[11px] text-rose-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {installResult.stderr}
                    </div>
                  )}
                </div>
              )}

              {/* Catalog Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {POPULAR_WINDOWS_SOFTWARE.map((item) => {
                  const toolKey = item.id === 'nodejs' ? 'node' : item.id === 'vscode' ? 'code' : item.id;
                  const isInstalled = sysInfo?.tools?.[toolKey]?.installed;
                  const version = sysInfo?.tools?.[toolKey]?.version;

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <span className="text-2xl">{item.icon}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white">{item.name}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                {item.manager.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        {isInstalled && (
                          <span className="shrink-0 text-[10px] font-bold text-emerald-400 flex items-center gap-1 font-mono">
                            <Check className="w-3 h-3" />
                            Installed
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                        <span className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">
                          {version || item.packageId}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleStartGuidedInstall(item)}
                          disabled={isInstalling}
                          className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Download className="w-3 h-3" />
                          <span>{isInstalled ? 'Reinstall' : 'Install Step-by-Step'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE POWERSHELL TERMINAL */}
          {activeTab === 'terminal' && (
            <div className="space-y-3">
              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] text-slate-500 font-mono">Quick run:</span>
                {[
                  'Get-Date',
                  'winget list',
                  'Get-PSDrive -PSProvider FileSystem',
                  'python --version',
                  'node -v; npm -v',
                  'git status -s',
                  'ipconfig',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setCommandInput(preset);
                      handleRunCommand(preset);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] border border-slate-700 transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-cyan-400 font-mono text-xs">PS&gt;</span>
                  <input
                    type="text"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRunCommand();
                    }}
                    placeholder="Enter Windows PowerShell command..."
                    className="w-full pl-11 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono shadow-inner"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRunCommand()}
                  disabled={isExecutingCmd}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${isExecutingCmd ? 'animate-spin' : ''}`} />
                  <span>{isExecutingCmd ? 'Running...' : 'Run'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openWindowsTerminalWindow(commandInput, false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer shadow-sm"
                  title="Physically open this command in a real Windows PowerShell window on your desktop"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Open Window</span>
                </button>
              </div>

              {/* Terminal Logs Output */}
              <div className="space-y-2">
                {terminalHistory.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 font-mono text-xs bg-slate-950/60 rounded-2xl border border-slate-800">
                    Windows PowerShell Terminal is ready. Enter any command above or choose a quick preset.
                  </div>
                ) : (
                  terminalHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1.5 font-mono text-xs shadow-md"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/60 pb-1">
                        <span className="text-cyan-400 font-bold">PS&gt; {item.command}</span>
                        <div className="flex items-center gap-2">
                          <span className={item.exitCode === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            Exit: {item.exitCode} ({item.durationMs}ms)
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.stdout || item.stderr, item.id)}
                            className="p-1 hover:text-white transition-colors cursor-pointer"
                            title="Copy output"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      {item.stdout && (
                        <pre className="text-slate-200 text-[11px] whitespace-pre-wrap overflow-x-auto max-h-48 leading-relaxed">
                          {item.stdout}
                        </pre>
                      )}

                      {item.stderr && (
                        <pre className="text-rose-300 text-[11px] whitespace-pre-wrap overflow-x-auto max-h-48 leading-relaxed">
                          {item.stderr}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PACKAGE MANAGERS & TOOLS DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sysInfo?.tools &&
                  Object.values(sysInfo.tools).map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">{t.name}</span>
                          {t.installed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-slate-800 text-slate-400">
                              Not Found
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                          {t.installed ? t.version || 'Active' : 'Run winget to install'}
                        </div>
                      </div>

                      {t.path && (
                        <span className="text-[9px] text-slate-600 font-mono truncate max-w-[120px]" title={t.path}>
                          {t.path.split('\\').pop()}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sovereign Local Host Execution Enabled</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

