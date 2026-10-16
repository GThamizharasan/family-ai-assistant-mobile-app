import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Server, AlertCircle, Trash2 } from 'lucide-react';
import { getApiBaseUrl, setApiBaseUrl } from '../services/api';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  backendUrlInput: string;
  savedNotice: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      backendUrlInput: typeof window !== 'undefined' ? getApiBaseUrl() : '',
      savedNotice: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AuraFamily ErrorBoundary caught unhandled error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleSaveBackendUrl = () => {
    const trimmed = this.state.backendUrlInput.trim();
    setApiBaseUrl(trimmed);
    this.setState({ savedNotice: 'Backend URL updated successfully! Reloading...' });
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  handleClearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-indigo-500/30">
          <div className="w-full max-w-lg bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
            {/* Header */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide">AuraFamily Recovery Enclave</h1>
                <p className="text-xs text-slate-400">Application encountered an unhandled startup state</p>
              </div>
            </div>

            {/* Error Message */}
            <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-900/40 text-xs font-mono text-rose-300 break-all space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-rose-400 uppercase tracking-wider text-[10px]">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Diagnostics</span>
              </div>
              <p>{this.state.error?.message || 'Unknown runtime error'}</p>
            </div>

            {/* Backend URL Configuration */}
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-indigo-300">
                <Server className="w-4 h-4" />
                <span>Configure Backend Server URL (Cloud Run or Local)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                If connecting to your hosted Google Cloud Run backend, paste your HTTPS service URL below:
              </p>
              <div className="space-y-2">
                <input
                  type="url"
                  placeholder="https://aura-family-hub-xxxx.a.run.app"
                  value={this.state.backendUrlInput}
                  onChange={(e) => this.setState({ backendUrlInput: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <button
                  type="button"
                  onClick={this.handleSaveBackendUrl}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30 active:scale-98"
                >
                  <Server className="w-4 h-4" />
                  <span>Save URL & Reconnect</span>
                </button>
              </div>
              {this.state.savedNotice && (
                <p className="text-xs text-emerald-400 text-center font-medium animate-pulse">
                  {this.state.savedNotice}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition flex items-center justify-center space-x-2 border border-slate-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload App</span>
              </button>
              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                className="py-2.5 px-3 rounded-xl bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 text-xs font-semibold transition flex items-center space-x-1.5 border border-rose-900/50"
                title="Clear local storage cache and restart"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Storage</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
