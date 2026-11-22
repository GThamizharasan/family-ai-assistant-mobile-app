import React, { useEffect, useRef, useState } from 'react';
import { Search, X, ArrowRight, Sparkles, Loader2, CornerDownLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TabKey } from './BottomNav';
import {
  getDefaultQuickSearchItems,
  runGlobalUniversalSearch,
  UniversalSearchResultItem,
} from '../services/universalSearchService';

interface GlobalUniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: TabKey, subTab?: any) => void;
  onOpenSmartDocModal: (docType: 'receipt_warranty' | 'prescription_lab') => void;
}

const QUICK_CHIPS = ['Receipt', 'Prescription', 'Tamil', 'Math', 'Reminder', 'Drive', 'Clock'];

export const GlobalUniversalSearchModal: React.FC<GlobalUniversalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenSmartDocModal,
}) => {
  const { user, tasks, transactions, familyMembers } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UniversalSearchResultItem[]>(() =>
    getDefaultQuickSearchItems()
  );
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setResults(getDefaultQuickSearchItems());
    setActiveIndex(0);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const hits = await runGlobalUniversalSearch({
          query,
          userEmail: user?.email,
          tasks,
          transactions,
          familyMembers,
        });
        setResults(hits);
        setActiveIndex(0);
      } finally {
        setIsSearching(false);
      }
    }, 160);
    return () => clearTimeout(timer);
  }, [query, isOpen, user?.email, tasks, transactions, familyMembers]);

  if (!isOpen) return null;

  const handleSelectResult = (item: UniversalSearchResultItem) => {
    onClose();
    if (item.targetTab === 'smart-doc-modal') {
      onOpenSmartDocModal(item.deepLink?.docType || 'receipt_warranty');
      return;
    }

    if (item.targetTab === 'language-tutor' && item.deepLink) {
      try {
        sessionStorage.setItem('aura_language_tutor_launch', JSON.stringify(item.deepLink));
        window.dispatchEvent(new CustomEvent('aura_language_tutor_launch', { detail: item.deepLink }));
      } catch {}
    } else if (item.targetTab === 'adaptive-learning' && item.deepLink) {
      try {
        sessionStorage.setItem('aura_adaptive_launch', JSON.stringify(item.deepLink));
        window.dispatchEvent(new CustomEvent('aura_adaptive_learning_launch', { detail: item.deepLink }));
      } catch {}
    }

    if (item.targetTab === 'media-library' && item.deepLink) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('aura-open-media-library', { detail: item.deepLink }));
      }, 220);
    }

    onNavigateTab(item.targetTab, item.deepLink?.subTab);
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-md flex items-start justify-center pt-10 sm:pt-16 px-3 sm:px-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-cyan-400/35 shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Header */}
        <div className="p-3.5 sm:p-4 border-b border-white/10 flex items-center gap-3 bg-slate-950/70">
          {isSearching ? (
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-cyan-400 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(results.length - 1, i + 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(0, i - 1));
              }
              if (e.key === 'Enter' && results[activeIndex]) {
                e.preventDefault();
                handleSelectResult(results[activeIndex]);
              }
            }}
            placeholder="Search apps, Tamil/English courses, whiteboard visuals, receipts, prescriptions, reminders, Drive..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 outline-none"
          />
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-800 text-[10px] font-mono text-slate-400 border border-white/10">
            ESC
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Filter Chips */}
        <div className="px-4 py-2 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto bg-slate-950/40">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setQuery(chip)}
              className="px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-cyan-500/20 text-[11px] font-bold text-slate-200 hover:text-cyan-200 border border-white/10 cursor-pointer shrink-0 transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Federated Results List */}
        <div className="p-2.5 overflow-y-auto space-y-1 flex-1">
          {results.length === 0 ? (
            <div className="py-10 text-center space-y-1">
              <p className="text-sm font-bold text-white">No matches for “{query}”</p>
              <p className="text-xs text-slate-400">
                Try searching for a module name, saved course, receipt, prescription, reminder, or Drive file.
              </p>
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelectResult(item)}
                  className={`w-full p-3 rounded-2xl text-left flex items-center justify-between gap-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/25 border border-cyan-400/40'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">{item.iconEmoji}</span>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{item.subtitle}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-950/80 text-[9px] font-mono uppercase text-slate-400 border border-white/10">
                      {item.category.replace('_', ' ')}
                    </span>
                    {isSelected ? (
                      <CornerDownLeft className="w-3.5 h-3.5 text-cyan-300" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-950/80 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>Universal SQLite + Local + Apps Search</span>
          <span>Press Ctrl+K / ⌘K anywhere</span>
        </div>
      </div>
    </div>
  );
};
