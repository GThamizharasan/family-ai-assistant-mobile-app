import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Headphones,
  Sparkles,
  Search,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  Play,
  Pause,
  Highlighter,
  MessageSquare,
  FileText,
  CheckCircle2,
  List,
  Flame,
  Send,
  Loader2,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { Book, Chapter, Highlight, Bookmark as BookmarkType, ReaderTheme, ReaderFont } from '../../types/book';
import { ambientAudio, SoundscapeType } from '../../services/ambientAudio';
import { getPdfFromStorage, safeSetLocalStorage } from '../../utils/pdfStorage';
import { generateReadablePdfDocumentUrl, extractPdfChaptersAndPages } from '../../utils/pdfHelper';
import { getPageContent, PageContent } from '../../utils/paginationHelper';
import { PdfCanvasViewer } from './PdfCanvasViewer';
import { safeFetchJson } from '../../services/api';

interface AppleBookReaderModalProps {
  book: Book;
  onClose: () => void;
  onUpdateBookProgress: (bookId: string, page: number, chapterId: string, percent: number) => void;
  onUpdateBookDetails?: (updatedBook: Book) => void;
  onAddHighlight?: (highlight: Highlight) => void;
  onAddBookmark?: (bookmark: BookmarkType) => void;
}

export const AppleBookReaderModal: React.FC<AppleBookReaderModalProps> = ({
  book,
  onClose,
  onUpdateBookProgress,
  onUpdateBookDetails,
  onAddHighlight,
  onAddBookmark,
}) => {
  // Safe Book fallback to ensure no null crashes ever occur
  const safeBook: Book = book || {
    id: 'unknown-doc',
    title: 'Untitled Document',
    author: 'Personal Library',
    coverGradient: 'from-amber-600 to-amber-900',
    accentColor: '#f59e0b',
    genre: 'PDF & Documents',
    rating: 5,
    reviewCount: 1,
    totalPages: 10,
    currentPage: 1,
    currentChapterId: 'ch1',
    progressPercent: 0,
    addedAt: new Date().toISOString(),
    description: '',
    chapters: [
      {
        id: 'ch1',
        title: 'Document Content',
        readingTimeMinutes: 5,
        content: ['Reading document...'],
      },
    ],
  };

  // Dynamic chapters state allows runtime extraction of newly uploaded or stored PDFs
  const [dynamicChapters, setDynamicChapters] = useState<Chapter[]>(() => {
    return safeBook.chapters && safeBook.chapters.length > 0
      ? safeBook.chapters
      : [
          {
            id: 'ch1',
            title: safeBook.title || 'Document Content',
            readingTimeMinutes: 5,
            content: [safeBook.description || 'Welcome to this document.'],
          },
        ];
  });

  // Dynamic total pages based on actual PDF pages or chapters count
  const [dynamicTotalPages, setDynamicTotalPages] = useState<number>(() => {
    return Math.max(1, safeBook.totalPages || (safeBook.chapters ? safeBook.chapters.length : 1));
  });

  const chapters: Chapter[] = dynamicChapters;

  // Current page state (1-indexed)
  const [currentPage, setCurrentPage] = useState(safeBook.currentPage || 1);

  // Derive exact page content dynamically
  const pageData: PageContent = getPageContent(
    { ...safeBook, totalPages: dynamicTotalPages },
    chapters,
    currentPage
  );
  const totalPages = Math.max(pageData.totalPages, dynamicTotalPages);

  // Active Reading State
  const [currentChapterIndex, setCurrentChapterIndex] = useState(pageData.chapterIndex);

  // PDF vs Flow Reader View Mode
  const [readerMode, setReaderMode] = useState<'pdf' | 'flow'>(() =>
    safeBook.isPdf || safeBook.pdfUrl ? 'pdf' : 'flow'
  );

  // PDF View Mode: 'canvas' (Vector PDF) or 'sheet' (Apple Books Document Sheet)
  const [pdfViewMode, setPdfViewMode] = useState<'canvas' | 'sheet'>('canvas');

  // PDF Zoom
  const [pdfZoom, setPdfZoom] = useState<number>(1.0);

  // Dynamic PDF URL resolution (loads from IndexedDB or generates on-demand)
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(safeBook.pdfUrl || null);

  useEffect(() => {
    let isCancelled = false;

    if (safeBook.pdfUrl) {
      setActivePdfUrl(safeBook.pdfUrl);

      // Check if chapters need re-extraction (e.g. from previously uploaded dummy book)
      if (
        chapters.length <= 1 ||
        (chapters[0]?.content && chapters[0].content[0]?.includes('You have opened'))
      ) {
        extractPdfChaptersAndPages(safeBook.pdfUrl)
          .then((extracted) => {
            if (isCancelled) return;
            if (extracted.chapters.length > 0) {
              setDynamicChapters(extracted.chapters);
              setDynamicTotalPages(extracted.totalPages);
              if (onUpdateBookDetails) {
                onUpdateBookDetails({
                  ...safeBook,
                  chapters: extracted.chapters,
                  totalPages: extracted.totalPages,
                });
              }
            }
          })
          .catch((e) => console.warn('Could not extract chapters from pdfUrl:', e));
      }
      return;
    }

    if (safeBook.isPdf) {
      // Check IndexedDB first for uploaded PDF files
      getPdfFromStorage(safeBook.id).then(async (stored) => {
        if (isCancelled) return;
        if (stored) {
          setActivePdfUrl(stored);
          if (
            chapters.length <= 1 ||
            (chapters[0]?.content && chapters[0].content[0]?.includes('You have opened'))
          ) {
            try {
              const extracted = await extractPdfChaptersAndPages(stored);
              if (isCancelled) return;
              if (extracted.chapters.length > 0) {
                setDynamicChapters(extracted.chapters);
                setDynamicTotalPages(extracted.totalPages);
                if (onUpdateBookDetails) {
                  onUpdateBookDetails({
                    ...safeBook,
                    chapters: extracted.chapters,
                    totalPages: extracted.totalPages,
                  });
                }
              }
            } catch (e) {
              console.warn('Could not extract chapters from stored PDF:', e);
            }
          }
        } else {
          // Generate on-demand viewable PDF layout
          const gen = generateReadablePdfDocumentUrl(
            safeBook.title,
            safeBook.author,
            safeBook.subtitle || '',
            chapters
          );
          setActivePdfUrl(gen);
        }
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [safeBook.id, safeBook.pdfUrl, safeBook.isPdf]);

  // Reader Preferences (Apple Books defaults)
  const [theme, setTheme] = useState<ReaderTheme>(() => {
    return (localStorage.getItem('aura_ibooks_theme') as ReaderTheme) || 'sepia';
  });
  const [font, setFont] = useState<ReaderFont>(() => {
    return (localStorage.getItem('aura_ibooks_font') as ReaderFont) || 'serif';
  });
  const [fontSize, setFontSize] = useState<number>(() => {
    return Number(localStorage.getItem('aura_ibooks_font_size')) || 18;
  });

  // UI Panels
  const [showAppearanceMenu, setShowAppearanceMenu] = useState(false);
  const [showTocDrawer, setShowTocDrawer] = useState(false);
  const [showBookmarksDrawer, setShowBookmarksDrawer] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAiCompanion, setShowAiCompanion] = useState(false);
  const [showAudioControls, setShowAudioControls] = useState(false);

  // Soundscape
  const [soundscape, setSoundscape] = useState<SoundscapeType>('off');
  const [soundscapeVolume, setSoundscapeVolume] = useState(0.35);

  // In-Book Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ chapterIndex: number; text: string; paraIndex: number }[]>([]);

  // Narration (TTS)
  const [isNarrating, setIsNarrating] = useState(false);
  const [narrationSpeed, setNarrationSpeed] = useState<number>(1.0);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Bookmarks & Highlights
  const [localBookmarks, setLocalBookmarks] = useState<BookmarkType[]>(safeBook.bookmarks || []);
  const [localHighlights, setLocalHighlights] = useState<Highlight[]>(safeBook.highlights || []);
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<{ x: number; y: number } | null>(null);
  const [highlightNote, setHighlightNote] = useState('');

  // AI Companion
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswers, setAiAnswers] = useState<{ q: string; a: string }[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const activeChapter = {
    id: chapters[pageData.chapterIndex]?.id || 'ch1',
    title: pageData.chapterTitle,
    readingTimeMinutes: pageData.readingTimeMinutes,
    content: pageData.paragraphs,
  };

  // Save preferences
  useEffect(() => {
    safeSetLocalStorage('aura_ibooks_theme', theme);
  }, [theme]);

  useEffect(() => {
    safeSetLocalStorage('aura_ibooks_font', font);
  }, [font]);

  useEffect(() => {
    safeSetLocalStorage('aura_ibooks_font_size', String(fontSize));
  }, [fontSize]);

  // Clean up audio on unmount or close
  useEffect(() => {
    return () => {
      ambientAudio.stop();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Keyboard navigation (Left/Right arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSearchModal || showAiCompanion) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        goToNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        goToPrevPage();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, showSearchModal, showAiCompanion]);

  // Handle Progress update
  const updateProgress = (newPage: number, chapterIdx: number) => {
    setCurrentPage(newPage);
    const percent = Math.min(100, Math.round((newPage / totalPages) * 100));
    const chId = chapters[chapterIdx]?.id || chapters[0]?.id || 'ch1';
    onUpdateBookProgress(safeBook.id, newPage, chId, percent);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      const nextP = currentPage + 1;
      const nextData = getPageContent({ ...safeBook, totalPages }, chapters, nextP);
      setCurrentChapterIndex(nextData.chapterIndex);
      updateProgress(nextP, nextData.chapterIndex);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      const prevP = currentPage - 1;
      const prevData = getPageContent({ ...safeBook, totalPages }, chapters, prevP);
      setCurrentChapterIndex(prevData.chapterIndex);
      updateProgress(prevP, prevData.chapterIndex);
    }
  };

  // Soundscape toggle
  const handleSoundscapeChange = (type: SoundscapeType) => {
    setSoundscape(type);
    ambientAudio.play(type);
  };

  // Narration (Web Speech Synthesis)
  const toggleNarration = () => {
    if (!('speechSynthesis' in window)) {
      return;
    }

    if (isNarrating) {
      window.speechSynthesis.cancel();
      setIsNarrating(false);
    } else {
      window.speechSynthesis.cancel();
      const textToRead = `${pageData.chapterTitle}. ${pageData.paragraphs.join(' ')}`;
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.rate = narrationSpeed;

      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find(
          (v) =>
            v.name.includes('Samantha') ||
            v.name.includes('Daniel') ||
            v.name.includes('Google UK English Female') ||
            v.lang.startsWith('en')
        ) || voices[0];
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => setIsNarrating(false);
      utterance.onerror = () => setIsNarrating(false);

      speechUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsNarrating(true);
    }
  };

  const setSpeed = (spd: number) => {
    setNarrationSpeed(spd);
    if (isNarrating && speechUtteranceRef.current) {
      toggleNarration();
      setTimeout(toggleNarration, 100);
    }
  };

  // Bookmark toggle
  const isCurrentPageBookmarked = localBookmarks.some(
    (b) => b.bookId === safeBook.id && b.pageNumber === currentPage
  );

  const toggleBookmark = () => {
    if (isCurrentPageBookmarked) {
      const updated = localBookmarks.filter(
        (b) => !(b.bookId === safeBook.id && b.pageNumber === currentPage)
      );
      setLocalBookmarks(updated);
    } else {
      const newBm: BookmarkType = {
        id: `bm-${Date.now()}`,
        bookId: safeBook.id,
        chapterId: activeChapter.id,
        chapterTitle: `${pageData.chapterTitle} (Page ${currentPage})`,
        pageNumber: currentPage,
        snippet: (pageData.paragraphs[0] || '').slice(0, 80) + '...',
        createdAt: new Date().toLocaleDateString(),
      };
      const updated = [newBm, ...localBookmarks];
      setLocalBookmarks(updated);
      onAddBookmark?.(newBm);
    }
  };

  // Highlight selection
  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 2) {
      const text = selection.toString().trim();
      setSelectedText(text);
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionRange({ x: rect.left + rect.width / 2, y: rect.top - 10 });
      } catch {
        setSelectionRange(null);
      }
    } else {
      setSelectionRange(null);
    }
  };

  const addHighlight = (color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple') => {
    if (!selectedText) return;
    const newHl: Highlight = {
      id: `hl-${Date.now()}`,
      bookId: safeBook.id,
      chapterId: activeChapter.id,
      text: selectedText,
      color,
      note: highlightNote.trim() || undefined,
      createdAt: new Date().toLocaleDateString(),
    };
    const updated = [newHl, ...localHighlights];
    setLocalHighlights(updated);
    onAddHighlight?.(newHl);
    setSelectedText('');
    setSelectionRange(null);
    setHighlightNote('');
    window.getSelection()?.removeAllRanges();
  };

  // In-book Search
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    const results: { chapterIndex: number; text: string; paraIndex: number }[] = [];
    chapters.forEach((chap, cIdx) => {
      chap.content.forEach((para, pIdx) => {
        if (para.toLowerCase().includes(q.toLowerCase())) {
          results.push({ chapterIndex: cIdx, text: para, paraIndex: pIdx });
        }
      });
    });
    setSearchResults(results);
  };

  // Ask AI Companion
  const handleAskAi = async () => {
    if (!aiQuestion.trim()) return;
    const q = aiQuestion;
    setAiQuestion('');
    setIsAiLoading(true);

    try {
      const context = `Book: "${safeBook.title}" by ${safeBook.author}. Current Page ${currentPage}: "${pageData.chapterTitle}". Text: ${pageData.paragraphs.join(' ')}`;
      const data = await safeFetchJson('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `In the context of the book "${safeBook.title}" (${context}), please answer: ${q}`,
          currentMood: 'scholarly & insightful',
        }),
      });
      const reply = data.reply || 'Here is an insightful perspective based on this page.';
      setAiAnswers((prev) => [{ q, a: reply }, ...prev]);
    } catch {
      setAiAnswers((prev) => [
        {
          q,
          a: `In "${safeBook.title}", page ${currentPage} highlights the compounding importance of sovereign discipline and clarity. Focus on deliberate execution.`,
        },
        ...prev,
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Apple Books Theme Classes
  const getThemeStyles = () => {
    switch (theme) {
      case 'white':
        return {
          bg: 'bg-white text-slate-900',
          paper: 'bg-white',
          header: 'bg-white/90 border-slate-200 text-slate-800',
          footer: 'bg-white/95 border-slate-200 text-slate-600',
          card: 'bg-slate-100 border-slate-200',
        };
      case 'sepia':
        return {
          bg: 'bg-[#F9F4E8] text-[#3D2E1E]',
          paper: 'bg-[#F9F4E8]',
          header: 'bg-[#F9F4E8]/90 border-[#E8DDCE] text-[#3D2E1E]',
          footer: 'bg-[#F9F4E8]/95 border-[#E8DDCE] text-[#69533B]',
          card: 'bg-[#EFE6D5] border-[#E0D2C0]',
        };
      case 'charcoal':
        return {
          bg: 'bg-[#1C1F26] text-[#D8DEE9]',
          paper: 'bg-[#1C1F26]',
          header: 'bg-[#1C1F26]/90 border-slate-700/80 text-slate-200',
          footer: 'bg-[#1C1F26]/95 border-slate-700/80 text-slate-400',
          card: 'bg-slate-800/90 border-slate-700',
        };
      case 'oled':
      default:
        return {
          bg: 'bg-black text-[#E5E7EB]',
          paper: 'bg-black',
          header: 'bg-black/90 border-neutral-900 text-neutral-200',
          footer: 'bg-black/95 border-neutral-900 text-neutral-400',
          card: 'bg-neutral-950 border-neutral-800',
        };
    }
  };

  const themeStyle = getThemeStyles();

  const getFontFamily = () => {
    switch (font) {
      case 'serif':
        return 'font-serif';
      case 'palatino':
        return 'font-serif tracking-normal';
      case 'charter':
        return 'font-serif tracking-wide';
      case 'mono':
        return 'font-mono text-sm';
      case 'sans':
      default:
        return 'font-sans';
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${themeStyle.bg} transition-colors duration-200 select-text overflow-hidden`}
      onMouseUp={handleTextSelect}
      onTouchEnd={handleTextSelect}
    >
      {/* =========================================================================
          TOP APPLE BOOKS NAVIGATION BAR
          ========================================================================= */}
      <header
        className={`h-14 px-3 sm:px-6 flex items-center justify-between border-b backdrop-blur-md ${themeStyle.header} z-30 transition-colors`}
      >
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Close Reader */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Exit Reader (Esc)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Table of Contents */}
          <button
            onClick={() => setShowTocDrawer(!showTocDrawer)}
            className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Table of Contents & Pages"
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Contents</span>
          </button>

          {/* Bookmarks & Highlights */}
          <button
            onClick={() => setShowBookmarksDrawer(!showBookmarksDrawer)}
            className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center gap-1 text-xs font-medium"
            title="Bookmarks & Highlights"
          >
            <Bookmark className="w-4 h-4" />
            {localBookmarks.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            )}
          </button>

          {/* PDF vs Flow Mode Switcher (For PDF books) */}
          {(safeBook.isPdf || !!activePdfUrl) && (
            <div className="flex items-center bg-black/10 dark:bg-white/10 rounded-xl p-0.5 text-xs font-semibold ml-1">
              <button
                onClick={() => setReaderMode('pdf')}
                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  readerMode === 'pdf'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'opacity-70 hover:opacity-100'
                }`}
                title="View authentic PDF layout"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF Sheet</span>
              </button>
              <button
                onClick={() => setReaderMode('flow')}
                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  readerMode === 'flow'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'opacity-70 hover:opacity-100'
                }`}
                title="View reflowable Apple Books typography mode"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Flow Mode</span>
              </button>
            </div>
          )}
        </div>

        {/* Center Title & Current Page indicator */}
        <div className="text-center max-w-[180px] sm:max-w-md truncate px-2">
          <h2 className="text-xs font-bold truncate opacity-90">{safeBook.title}</h2>
          <p className="text-[10px] opacity-70 truncate font-mono">
            Page {currentPage} of {totalPages} &bull; {pageData.chapterTitle}
          </p>
        </div>

        {/* Right Tools: Appearance, Audio, AI, Bookmark, Search */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Download Original PDF (if available) */}
          {activePdfUrl && (
            <a
              href={activePdfUrl}
              download={safeBook.pdfFileName || `${safeBook.title}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors hidden sm:flex items-center gap-1 text-xs text-amber-500"
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
            </a>
          )}

          {/* In-Book Search */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Search inside book"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Soundscapes & Narration */}
          <button
            onClick={() => setShowAudioControls(!showAudioControls)}
            className={`p-2 rounded-xl transition-colors relative ${
              isNarrating || soundscape !== 'off'
                ? 'bg-amber-500/20 text-amber-500'
                : 'hover:bg-black/10 dark:hover:bg-white/10'
            }`}
            title="Audiobook Narration & Ambient Soundscapes"
          >
            <Headphones className="w-4 h-4" />
            {(isNarrating || soundscape !== 'off') && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          {/* AI Book Companion */}
          <button
            onClick={() => setShowAiCompanion(!showAiCompanion)}
            className={`p-2 rounded-xl transition-colors relative ${
              showAiCompanion ? 'bg-amber-500 text-white' : 'hover:bg-black/10 dark:hover:bg-white/10'
            }`}
            title="Gemini AI Reading Companion"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
          </button>

          {/* Apple Appearance / Themes */}
          <button
            onClick={() => setShowAppearanceMenu(!showAppearanceMenu)}
            className={`p-2 rounded-xl transition-colors ${
              showAppearanceMenu ? 'bg-black/15 dark:bg-white/15' : 'hover:bg-black/10 dark:hover:bg-white/10'
            }`}
            title="Reader Themes & Typography"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Ribbon Bookmark */}
          <button
            onClick={toggleBookmark}
            className={`p-2 rounded-xl transition-colors ${
              isCurrentPageBookmarked
                ? 'text-amber-500 bg-amber-500/10'
                : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
            }`}
            title={isCurrentPageBookmarked ? 'Remove Bookmark' : 'Bookmark this Page'}
          >
            {isCurrentPageBookmarked ? (
              <BookmarkCheck className="w-4 h-4 text-amber-500 fill-amber-500" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* =========================================================================
          APPEARANCE & THEMES POPOVER (APPLE BOOKS STYLE)
          ========================================================================= */}
      {showAppearanceMenu && (
        <div
          className={`absolute top-16 right-4 sm:right-8 z-40 w-72 rounded-3xl p-4 shadow-2xl border backdrop-blur-xl ${themeStyle.card} text-sm space-y-4`}
        >
          {/* Apple Color Themes */}
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider opacity-60 block mb-2">
              Apple Themes
            </span>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'white', label: 'White', bg: 'bg-white', border: 'border-slate-300' },
                { id: 'sepia', label: 'Sepia', bg: 'bg-[#F9F4E8]', border: 'border-[#D9CDB8]' },
                { id: 'charcoal', label: 'Charcoal', bg: 'bg-[#1C1F26]', border: 'border-slate-700' },
                { id: 'oled', label: 'OLED', bg: 'bg-black', border: 'border-neutral-800' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id as ReaderTheme)}
                  className={`h-9 rounded-2xl flex items-center justify-center font-medium text-xs border ${t.bg} ${t.border} transition-all ${
                    theme === t.id ? 'ring-2 ring-amber-500 scale-105 shadow-md' : 'opacity-80'
                  }`}
                >
                  <span
                    className={
                      t.id === 'white' || t.id === 'sepia' ? 'text-slate-800 font-bold' : 'text-slate-100 font-bold'
                    }
                  >
                    Aa
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5 opacity-80">
              <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">Font Size</span>
              <span className="font-mono text-xs">{fontSize}px</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setFontSize((s) => Math.max(14, s - 1))}
                className="w-8 h-8 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center text-xs font-bold"
              >
                A-
              </button>
              <input
                type="range"
                min="14"
                max="28"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="flex-1 accent-amber-500 h-1.5 bg-black/10 dark:bg-white/20 rounded-lg cursor-pointer"
              />
              <button
                onClick={() => setFontSize((s) => Math.min(28, s + 1))}
                className="w-8 h-8 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center text-sm font-bold"
              >
                A+
              </button>
            </div>
          </div>

          {/* Typography Families */}
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider opacity-60 block mb-2">
              Typography
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {[
                { id: 'sans', label: 'San Francisco' },
                { id: 'serif', label: 'New York (Serif)' },
                { id: 'charter', label: 'Charter' },
                { id: 'mono', label: 'Mono Code' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFont(f.id as ReaderFont)}
                  className={`p-2 rounded-xl text-left border transition-all ${
                    font === f.id
                      ? 'bg-amber-500 text-white font-bold border-amber-600'
                      : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          AUDIO & SOUNDSCAPES POPOVER
          ========================================================================= */}
      {showAudioControls && (
        <div
          className={`absolute top-16 right-4 sm:right-24 z-40 w-80 rounded-3xl p-4 shadow-2xl border backdrop-blur-xl ${themeStyle.card} text-sm space-y-4`}
        >
          {/* Read Aloud Narration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-amber-500" />
                <span>Text-to-Speech Voice</span>
              </span>
              <span className="text-[10px] font-mono text-amber-500 uppercase">
                {isNarrating ? 'Speaking...' : 'Ready'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleNarration}
                className={`flex-1 py-2 px-3 rounded-2xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
                  isNarrating
                    ? 'bg-rose-600 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20'
                }`}
              >
                {isNarrating ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause Narration</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Read Aloud</span>
                  </>
                )}
              </button>

              <div className="flex bg-black/5 dark:bg-white/10 rounded-2xl p-0.5 text-xs font-mono">
                {[0.8, 1.0, 1.25, 1.5].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setSpeed(spd)}
                    className={`px-2 py-1 rounded-xl transition-colors ${
                      narrationSpeed === spd ? 'bg-amber-500 text-white font-bold' : 'opacity-70'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ambient Soundscapes */}
          <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Ambient Reading Soundscape</span>
              <span className="text-[10px] font-mono text-emerald-500 font-bold uppercase">
                {soundscape}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {[
                { id: 'off', label: 'Off', icon: VolumeX },
                { id: 'rain', label: 'Rain', icon: Volume2 },
                { id: 'fireplace', label: 'Fireplace', icon: Flame },
                { id: 'waves', label: 'Waves', icon: Volume2 },
                { id: 'library', label: 'Library', icon: BookOpen },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSoundscapeChange(s.id as SoundscapeType)}
                  className={`p-2 rounded-2xl text-xs flex flex-col items-center justify-center gap-1 transition-all ${
                    soundscape === s.id
                      ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30'
                      : 'bg-black/5 dark:bg-white/5 opacity-80 hover:opacity-100'
                  }`}
                >
                  <s.icon className="w-3.5 h-3.5" />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>

            {soundscape !== 'off' && (
              <div className="flex items-center gap-2 pt-1">
                <VolumeX className="w-3.5 h-3.5 opacity-60" />
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  value={soundscapeVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSoundscapeVolume(v);
                    ambientAudio.setVolume(v);
                  }}
                  className="flex-1 accent-emerald-500 h-1 bg-black/10 dark:bg-white/20 rounded-lg cursor-pointer"
                />
                <Volume2 className="w-3.5 h-3.5 opacity-60" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          QUICK HIGHLIGHT POPUP TOOLBAR (APPLE PASTEL COLORS)
          ========================================================================= */}
      {selectionRange && selectedText && (
        <div
          style={{
            left: `${Math.min(window.innerWidth - 180, Math.max(20, selectionRange.x - 90))}px`,
            top: `${Math.max(60, selectionRange.y - 50)}px`,
          }}
          className="fixed z-50 flex items-center gap-1.5 p-1.5 rounded-full bg-slate-900 border border-slate-700 shadow-2xl text-white"
        >
          <button
            onClick={() => addHighlight('yellow')}
            className="w-6 h-6 rounded-full bg-amber-400 hover:scale-110 transition-transform shadow"
            title="Yellow Highlight"
          />
          <button
            onClick={() => addHighlight('green')}
            className="w-6 h-6 rounded-full bg-emerald-400 hover:scale-110 transition-transform shadow"
            title="Green Highlight"
          />
          <button
            onClick={() => addHighlight('blue')}
            className="w-6 h-6 rounded-full bg-sky-400 hover:scale-110 transition-transform shadow"
            title="Blue Highlight"
          />
          <button
            onClick={() => addHighlight('pink')}
            className="w-6 h-6 rounded-full bg-rose-400 hover:scale-110 transition-transform shadow"
            title="Pink Highlight"
          />
          <button
            onClick={() => addHighlight('purple')}
            className="w-6 h-6 rounded-full bg-purple-400 hover:scale-110 transition-transform shadow"
            title="Purple Highlight"
          />
        </div>
      )}

      {/* =========================================================================
          MAIN READING AREA (DUAL PDF VIEWER OR APPLE BOOKS FLOW)
          ========================================================================= */}
      {readerMode === 'pdf' ? (
        <main className="flex-1 overflow-y-auto flex flex-col items-center bg-slate-950 p-2 sm:p-6 select-text">
          {/* Top PDF Controls Toolbar */}
          <div className="w-full max-w-4xl flex items-center justify-between px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-300 mb-4 shadow-lg shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>PDF Document Pane</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-amber-300 font-mono font-bold">
                Page {currentPage} of {totalPages}
              </span>
              {safeBook.pdfFileSize && (
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 font-mono hidden sm:inline">
                  {safeBook.pdfFileSize}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="hidden sm:flex items-center bg-slate-950 px-2 py-1 rounded-xl border border-slate-800 text-xs font-mono gap-1.5">
                <button
                  onClick={() => setPdfZoom((z) => Math.max(0.75, Number((z - 0.1).toFixed(1))))}
                  className="px-1.5 py-0.5 hover:text-white"
                  title="Zoom Out"
                >
                  -
                </button>
                <span>{Math.round(pdfZoom * 100)}%</span>
                <button
                  onClick={() => setPdfZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(1))))}
                  className="px-1.5 py-0.5 hover:text-white"
                  title="Zoom In"
                >
                  +
                </button>
              </div>

              {/* View Switcher: Vector PDF Canvas vs Text Sheet */}
              <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-xs font-medium">
                <button
                  onClick={() => setPdfViewMode('canvas')}
                  className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                    pdfViewMode === 'canvas'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Authentic PDF Vector View (Renders exact layout, tables and diagrams)"
                >
                  <span>Vector PDF</span>
                </button>
                <button
                  onClick={() => setPdfViewMode('sheet')}
                  className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                    pdfViewMode === 'sheet'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Clean Apple Books Typography Sheet"
                >
                  <span>Text Sheet</span>
                </button>
              </div>

              {activePdfUrl && (
                <a
                  href={activePdfUrl}
                  download={safeBook.pdfFileName || `${safeBook.title}.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-medium flex items-center gap-1.5 transition-colors"
                  title="Download or open original PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
              )}

              <button
                onClick={() => setReaderMode('flow')}
                className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors font-medium"
                title="Switch to Apple Books Flow View for ambient sounds and voice read aloud"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Flow View</span>
              </button>
            </div>
          </div>

          {/* Actual PDF Page Rendering */}
          {activePdfUrl && pdfViewMode === 'canvas' ? (
            <div className="w-full max-w-4xl flex-1 flex flex-col items-center">
              <PdfCanvasViewer
                pdfSource={activePdfUrl}
                currentPage={currentPage}
                zoom={pdfZoom}
                bookTitle={safeBook.title}
                onNumPagesLoaded={(num) => {
                  if (num && num !== dynamicTotalPages) {
                    setDynamicTotalPages(num);
                  }
                }}
                fallbackView={
                  /* Apple Books High-Definition PDF Document Sheet */
                  <div
                    className="w-full max-w-3xl bg-white text-slate-900 rounded-sm shadow-2xl p-8 sm:p-14 border border-slate-300 transition-all font-serif min-h-[750px] flex flex-col justify-between"
                    style={{
                      transform: `scale(${pdfZoom})`,
                      transformOrigin: 'top center',
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6 text-[11px] font-sans text-slate-500 uppercase tracking-widest">
                        <span className="truncate max-w-xs">{safeBook.title}</span>
                        <span className="font-mono text-amber-700 font-bold">
                          Page {currentPage} of {totalPages}
                        </span>
                      </div>

                      <div className="mb-6">
                        <span className="inline-block px-2.5 py-1 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold tracking-wider mb-2">
                          {pageData.sectionBadge}
                        </span>
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
                          {pageData.chapterTitle}
                        </h1>
                        <p className="text-xs text-slate-500 font-sans mt-1 italic">
                          {safeBook.author} &bull; ~{pageData.readingTimeMinutes} mins reading time
                        </p>
                      </div>

                      <div className="space-y-5 text-justify leading-relaxed text-slate-800 text-base sm:text-lg">
                        {pageData.paragraphs.map((para, idx) => {
                          const matchingHighlights = localHighlights.filter(
                            (h) => para.includes(h.text)
                          );

                          return (
                            <p key={idx} className="relative">
                              {idx === 0 && currentPage === 1 ? (
                                <span className="float-left text-5xl leading-none font-bold text-amber-700 mr-2 font-serif">
                                  {para.charAt(0)}
                                </span>
                              ) : null}
                              {matchingHighlights.length > 0 ? (
                                <span className="bg-amber-300/40 text-inherit px-1 rounded">
                                  {idx === 0 && currentPage === 1 ? para.slice(1) : para}
                                </span>
                              ) : (
                                idx === 0 && currentPage === 1 ? para.slice(1) : para
                              )}
                            </p>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-8 border-t border-slate-100 flex items-center justify-between text-[11px] font-sans text-slate-400 mt-10">
                      <span>Aura Apple Books & Sovereign Library Edition</span>
                      <span className="font-mono font-bold text-slate-600">
                        {currentPage} / {totalPages}
                      </span>
                    </div>
                  </div>
                }
              />
            </div>
          ) : (
            /* Apple Books High-Definition PDF Document Sheet */
            <div
              className="w-full max-w-3xl bg-white text-slate-900 rounded-sm shadow-2xl p-8 sm:p-14 border border-slate-300 transition-all font-serif min-h-[750px] flex flex-col justify-between"
              style={{
                transform: `scale(${pdfZoom})`,
                transformOrigin: 'top center',
              }}
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6 text-[11px] font-sans text-slate-500 uppercase tracking-widest">
                  <span className="truncate max-w-xs">{safeBook.title}</span>
                  <span className="font-mono text-amber-700 font-bold">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>

                <div className="mb-6">
                  <span className="inline-block px-2.5 py-1 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold tracking-wider mb-2">
                    {pageData.sectionBadge}
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
                    {pageData.chapterTitle}
                  </h1>
                  <p className="text-xs text-slate-500 font-sans mt-1 italic">
                    {safeBook.author} &bull; ~{pageData.readingTimeMinutes} mins reading time
                  </p>
                </div>

                <div className="space-y-5 text-justify leading-relaxed text-slate-800 text-base sm:text-lg">
                  {pageData.paragraphs.map((para, idx) => {
                    const matchingHighlights = localHighlights.filter(
                      (h) => para.includes(h.text)
                    );

                    return (
                      <p key={idx} className="relative">
                        {idx === 0 && currentPage === 1 ? (
                          <span className="float-left text-5xl leading-none font-bold text-amber-700 mr-2 font-serif">
                            {para.charAt(0)}
                          </span>
                        ) : null}
                        {matchingHighlights.length > 0 ? (
                          <span className="bg-amber-300/40 text-inherit px-1 rounded">
                            {idx === 0 && currentPage === 1 ? para.slice(1) : para}
                          </span>
                        ) : (
                          idx === 0 && currentPage === 1 ? para.slice(1) : para
                        )}
                      </p>
                    );
                  })}
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100 flex items-center justify-between text-[11px] font-sans text-slate-400 mt-10">
                <span>Aura Apple Books & Sovereign Library Edition</span>
                <span className="font-mono font-bold text-slate-600">
                  {currentPage} / {totalPages}
                </span>
              </div>
            </div>
          )}
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto px-4 sm:px-12 md:px-24 py-8 flex justify-center">
          <article
            className={`max-w-2xl w-full space-y-6 ${getFontFamily()} transition-all`}
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
          >
            {/* Chapter Heading */}
            <header className="border-b border-black/10 dark:border-white/10 pb-4 mb-6">
              <span className="text-[11px] font-mono uppercase tracking-widest opacity-60 block">
                {safeBook.title} &bull; {safeBook.author}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight leading-snug">
                {pageData.chapterTitle}
              </h1>
              <div className="flex items-center gap-2 mt-2 text-xs opacity-60 font-mono">
                <span>{pageData.readingTimeMinutes} mins read</span>
                <span>&bull;</span>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                {safeBook.isPdf && (
                  <>
                    <span>&bull;</span>
                    <span className="text-amber-500 font-semibold">PDF Source Document</span>
                  </>
                )}
              </div>
            </header>

            {/* Chapter Paragraphs for this specific page */}
            <div className="space-y-6 text-justify">
              {pageData.paragraphs.map((paragraph, idx) => {
                const matchingHighlights = localHighlights.filter(
                  (h) => paragraph.includes(h.text)
                );

                return (
                  <p key={idx} className="relative transition-opacity">
                    {matchingHighlights.length > 0 ? (
                      <span className="bg-amber-400/20 text-inherit px-1 rounded">
                        {paragraph}
                      </span>
                    ) : (
                      paragraph
                    )}
                  </p>
                );
              })}
            </div>

            {/* Page Turn Footnote */}
            <div className="pt-10 flex items-center justify-between border-t border-black/10 dark:border-white/10 text-xs opacity-60 font-mono">
              <span>{safeBook.genre}</span>
              <span>{pageData.percentComplete}% Completed</span>
            </div>
          </article>
        </main>
      )}

      {/* =========================================================================
          BOTTOM SLIDER CONTROLS BAR (APPLE IBOOKS EXPERIENCE)
          ========================================================================= */}
      <footer
        className={`h-16 px-4 sm:px-8 flex items-center justify-between border-t backdrop-blur-md ${themeStyle.footer} z-30 transition-colors`}
      >
        {/* Previous Page */}
        <button
          onClick={goToPrevPage}
          disabled={currentPage <= 1}
          className="p-2 rounded-2xl hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-all flex items-center gap-1 text-xs font-semibold"
          title="Previous Page (Left Arrow)"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        {/* Interactive Scrubbing Slider */}
        <div className="flex-1 max-w-lg mx-4 flex flex-col items-center gap-1">
          <input
            type="range"
            min="1"
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              const val = Number(e.target.value);
              const targetData = getPageContent(safeBook, chapters, val);
              setCurrentChapterIndex(targetData.chapterIndex);
              updateProgress(val, targetData.chapterIndex);
            }}
            className="w-full accent-amber-500 h-1.5 bg-black/15 dark:bg-white/20 rounded-lg cursor-pointer"
          />
          <div className="flex items-center justify-between w-full text-[11px] font-mono opacity-80">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <span className="text-amber-500 font-semibold">
              ~{Math.max(1, Math.round((totalPages - currentPage) * 1.2))} mins left in book
            </span>
          </div>
        </div>

        {/* Next Page */}
        <button
          onClick={goToNextPage}
          disabled={currentPage >= totalPages}
          className="p-2 rounded-2xl hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-all flex items-center gap-1 text-xs font-semibold"
          title="Next Page (Right Arrow)"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </footer>

      {/* =========================================================================
          TABLE OF CONTENTS DRAWER
          ========================================================================= */}
      {showTocDrawer && (
        <div className="fixed inset-y-0 left-0 z-50 w-80 sm:w-96 bg-slate-950/95 border-r border-slate-800 shadow-2xl p-5 flex flex-col text-white backdrop-blur-xl animate-in slide-in-from-left duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <List className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-sm">Table of Contents</h3>
            </div>
            <button
              onClick={() => setShowTocDrawer(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {chapters.map((chap, idx) => {
              const targetPage = idx + 1;
              const isCurrent = currentPage === targetPage || currentChapterIndex === idx;
              return (
                <button
                  key={chap.id}
                  onClick={() => {
                    setCurrentChapterIndex(idx);
                    updateProgress(targetPage, idx);
                    setShowTocDrawer(false);
                  }}
                  className={`w-full text-left p-3 rounded-2xl transition-all flex items-start justify-between gap-2 ${
                    isCurrent
                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                      : 'hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <div className="flex-1 truncate">
                    <span className="text-xs block truncate">{chap.title}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Page {targetPage} &bull; {chap.readingTimeMinutes} mins read
                    </span>
                  </div>
                  {isCurrent && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          BOOKMARKS & HIGHLIGHTS DRAWER
          ========================================================================= */}
      {showBookmarksDrawer && (
        <div className="fixed inset-y-0 left-0 z-50 w-80 sm:w-96 bg-slate-950/95 border-r border-slate-800 shadow-2xl p-5 flex flex-col text-white backdrop-blur-xl animate-in slide-in-from-left duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-sm">Bookmarks & Highlights</h3>
            </div>
            <button
              onClick={() => setShowBookmarksDrawer(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            <div>
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2">
                Bookmarks ({localBookmarks.length})
              </span>
              {localBookmarks.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-3 bg-slate-900/50 rounded-2xl">
                  No bookmarks saved yet. Click the ribbon icon to save pages.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {localBookmarks.map((bm) => (
                    <button
                      key={bm.id}
                      onClick={() => {
                        const targetData = getPageContent(safeBook, chapters, bm.pageNumber);
                        setCurrentChapterIndex(targetData.chapterIndex);
                        updateProgress(bm.pageNumber, targetData.chapterIndex);
                        setShowBookmarksDrawer(false);
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800/80 transition-all text-xs flex items-center justify-between"
                    >
                      <div className="truncate flex-1">
                        <span className="font-semibold block truncate text-amber-300">
                          Page {bm.pageNumber} &bull; {bm.chapterTitle}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate block opacity-80">
                          {bm.snippet}
                        </span>
                      </div>
                      <Bookmark className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2">
                Highlights ({localHighlights.length})
              </span>
              {localHighlights.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-3 bg-slate-900/50 rounded-2xl">
                  No highlights yet. Select text to highlight passages.
                </p>
              ) : (
                <div className="space-y-2">
                  {localHighlights.map((hl) => (
                    <div
                      key={hl.id}
                      className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs space-y-1"
                    >
                      <p className="italic text-slate-200 border-l-2 border-amber-500 pl-2">
                        &quot;{hl.text}&quot;
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {hl.createdAt}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          GEMINI AI READING COMPANION SLIDE-OVER
          ========================================================================= */}
      {showAiCompanion && (
        <div className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-slate-950/95 border-l border-slate-800 shadow-2xl p-5 flex flex-col text-white backdrop-blur-xl animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="font-bold text-sm">Gemini AI Book Companion</h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  Page {currentPage}: &quot;{pageData.chapterTitle}&quot;
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowAiCompanion(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Prompts */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3">
            {[
              'Summarize this page',
              'Explain key argument',
              'Generate 3 flashcards',
              'Action items from page',
            ].map((qp) => (
              <button
                key={qp}
                onClick={() => {
                  setAiQuestion(qp);
                }}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-900 hover:bg-amber-500/20 hover:text-amber-300 text-[11px] font-medium transition-colors border border-slate-800"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Chat QA thread */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {aiAnswers.length === 0 ? (
              <div className="text-center p-6 text-slate-400 space-y-2">
                <Sparkles className="w-8 h-8 text-amber-400/40 mx-auto" />
                <p className="text-xs">
                  Ask any question about Page {currentPage}, request conceptual explanations, or generate actionable takeaways.
                </p>
              </div>
            ) : (
              aiAnswers.map((item, idx) => (
                <div key={idx} className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
                    <span className="font-semibold block text-[10px] uppercase text-amber-400 font-mono mb-0.5">
                      You Asked
                    </span>
                    {item.q}
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 leading-relaxed">
                    <span className="font-semibold block text-[10px] uppercase text-slate-400 font-mono mb-1">
                      Gemini Companion
                    </span>
                    {item.a}
                  </div>
                </div>
              ))
            )}
            {isAiLoading && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-900 text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Gemini is reading Page {currentPage} and formulating insights...</span>
              </div>
            )}
          </div>

          {/* Input Box */}
          <div className="pt-3 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
              placeholder="Ask about Page "
              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleAskAi}
              disabled={isAiLoading || !aiQuestion.trim()}
              className="p-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          IN-BOOK SEARCH MODAL
          ========================================================================= */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm">Search in &quot;{safeBook.title}&quot;</h3>
              </div>
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Type word or phrase..."
              autoFocus
              className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
            />

            <div className="max-h-64 overflow-y-auto space-y-2">
              {searchResults.length === 0 && searchQuery.trim() && (
                <p className="text-xs text-slate-500 italic p-4 text-center">
                  No matching occurrences found.
                </p>
              )}
              {searchResults.map((res, idx) => {
                const targetPage = res.chapterIndex + 1;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentChapterIndex(res.chapterIndex);
                      updateProgress(targetPage, res.chapterIndex);
                      setShowSearchModal(false);
                    }}
                    className="w-full text-left p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs transition-colors block"
                  >
                    <span className="font-semibold text-amber-400 block mb-0.5">
                      Page {targetPage} &bull; {chapters[res.chapterIndex]?.title}
                    </span>
                    <p className="text-slate-300 line-clamp-2">{res.text}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
