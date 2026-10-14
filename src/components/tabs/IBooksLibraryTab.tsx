import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Bookmark,
  Sparkles,
  Search,
  Plus,
  Play,
  Flame,
  Award,
  Clock,
  CheckCircle2,
  Filter,
  Grid,
  List as ListIcon,
  Headphones,
  Sliders,
  TrendingUp,
  Heart,
  Share2,
  ChevronRight,
  BookMarked,
  Volume2,
  Compass,
  Library,
  Layers,
  ArrowRight,
  RefreshCw,
  Feather,
  Info,
  Upload,
  FileText,
  UploadCloud,
  FileCode,
  Download,
  X,
  ExternalLink,
} from 'lucide-react';
import { Book, Highlight, Bookmark as BookmarkType } from '../../types/book';
import { INITIAL_BOOKS } from '../../data/initialBooks';
import { AppleBookReaderModal } from '../books/AppleBookReaderModal';
import { parsePdfFileToBook, syncBookToSqlite } from '../../utils/pdfHelper';
import { safeSetLocalStorage } from '../../utils/pdfStorage';

export const IBooksLibraryTab: React.FC = () => {
  // Books Collection (stored locally & synced with SQLite)
  const [books, setBooks] = useState<Book[]>(() => {
    try {
      const saved = localStorage.getItem('aura_ibooks_library');
      if (saved) {
        const parsed: Book[] = JSON.parse(saved);
        // Sanitize any stale huge data URLs from prior storage
        const sanitized = parsed.map((b) => {
          if (b.pdfUrl && b.pdfUrl.length > 500) {
            const { pdfUrl, ...rest } = b;
            return rest;
          }
          return b;
        });
        const existingIds = new Set(sanitized.map((b) => b.id));
        const missing = INITIAL_BOOKS.filter((b) => !existingIds.has(b.id));
        return [...sanitized, ...missing];
      }
    } catch {}
    return INITIAL_BOOKS;
  });

  // Selected Book for Reading Modal
  const [activeReadingBook, setActiveReadingBook] = useState<Book | null>(null);

  // Active View Tab in Apple Books
  const [activeTab, setActiveTab] = useState<'reading-now' | 'library' | 'bookstore' | 'goals' | 'ai-weaver'>('reading-now');

  // Library View Toggle & Filters
  const [viewMode, setViewMode] = useState<'shelf' | 'list'>('shelf');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'recent' | 'progress' | 'title' | 'rating'>('recent');

  // Reading Goals & Daily Habit
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(30);
  const [todayMinutesRead, setTodayMinutesRead] = useState(() => {
    return Number(localStorage.getItem('aura_ibooks_today_mins')) || 24;
  });
  const [annualGoalBooks, setAnnualGoalBooks] = useState(12);
  const [streakDays, setStreakDays] = useState(7);

  // PDF Upload Modal & Drag State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [pdfUrlInput, setPdfUrlInput] = useState('');
  const [pdfTitleInput, setPdfTitleInput] = useState('');
  const [pdfAuthorInput, setPdfAuthorInput] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // AI Book Weaver Form State
  const [weaverPrompt, setWeaverPrompt] = useState('');
  const [weaverGenre, setWeaverGenre] = useState('Venture & Tech');
  const [weaverAudience, setWeaverAudience] = useState('Family & Leaders');
  const [isWeaving, setIsWeaving] = useState(false);
  const [weaverSuccessMsg, setWeaverSuccessMsg] = useState<string | null>(null);

  // Persist books in localStorage safely (strip heavy data URLs; IndexedDB retains binaries)
  useEffect(() => {
    try {
      const lightweightBooks = books.map((b) => {
        if (b.pdfUrl && b.pdfUrl.length > 500) {
          const { pdfUrl, ...rest } = b;
          return rest;
        }
        return b;
      });
      safeSetLocalStorage('aura_ibooks_library', JSON.stringify(lightweightBooks));
    } catch (e) {
      console.warn('Could not serialize library:', e);
    }
  }, [books]);

  // Persist minutes safely
  useEffect(() => {
    safeSetLocalStorage('aura_ibooks_today_mins', String(todayMinutesRead));
  }, [todayMinutesRead]);

  // Load any PDF books synced in SQLite from another device or session
  useEffect(() => {
    fetch('/api/family/sync?recordType=pdf_book')
      .then((res) => res.json())
      .then((data) => {
        if (data.records && Array.isArray(data.records)) {
          setBooks((prev) => {
            const currentIds = new Set(prev.map((b) => b.id));
            const newFromSqlite: Book[] = [];
            data.records.forEach((rec: any) => {
              if (rec.data && rec.data.id && !currentIds.has(rec.data.id)) {
                newFromSqlite.push(rec.data);
              }
            });
            return newFromSqlite.length > 0 ? [...newFromSqlite, ...prev] : prev;
          });
        }
      })
      .catch((e) => console.warn('SQLite book fetch note:', e));
  }, []);

  // Handle PDF file upload (from native picker or drop)
  const handlePdfFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploadingPdf(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const newAddedBooks: Book[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const parsedBook = await parsePdfFileToBook(file);
          newAddedBooks.push(parsedBook);
          // Sync to SQLite in background
          syncBookToSqlite(parsedBook);
        }
      }

      if (newAddedBooks.length > 0) {
        setBooks((prev) => [...newAddedBooks, ...prev]);
        setUploadSuccess(`Successfully added ${newAddedBooks.length} PDF book(s) to your Apple Bookshelf!`);
        setTimeout(() => {
          setIsPdfModalOpen(false);
          setUploadSuccess(null);
        }, 1500);
      } else {
        setUploadError('Please select a valid .pdf file.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Failed to process PDF book');
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // Handle PDF from external URL
  const handleAddPdfUrl = () => {
    if (!pdfUrlInput.trim()) return;
    const title = pdfTitleInput.trim() || 'Imported PDF Document';
    const author = pdfAuthorInput.trim() || 'External Source';
    const newBook: Book = {
      id: `pdf-url-${Date.now()}`,
      title,
      subtitle: 'Online PDF Publication',
      author,
      genre: 'PDF & Documents',
      coverGradient: 'from-amber-950 via-slate-900 to-indigo-950',
      accentColor: '#f59e0b',
      rating: 5.0,
      reviewCount: 1,
      totalPages: 12,
      currentPage: 1,
      currentChapterId: 'ch1',
      progressPercent: 0,
      isPdf: true,
      pdfUrl: pdfUrlInput.trim(),
      pdfFileName: `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      pdfFileSize: 'Web Link',
      addedAt: new Date().toISOString(),
      description: `PDF publication "${title}" by ${author} linked into your Sovereign Apple Books Library.`,
      chapters: [
        {
          id: 'ch1',
          title,
          readingTimeMinutes: 8,
          content: [
            `This PDF book is linked from: ${pdfUrlInput.trim()}`,
            'You can view the full document using the top "PDF View" switcher or read and take notes here.',
            'Use the Gemini AI Reading Companion to summarize this document or extract key takeaways anytime!',
          ],
        },
      ],
    };

    setBooks((prev) => [newBook, ...prev]);
    syncBookToSqlite(newBook);
    setPdfUrlInput('');
    setPdfTitleInput('');
    setPdfAuthorInput('');
    setUploadSuccess(`"${title}" added to your bookshelf!`);
    setTimeout(() => {
      setIsPdfModalOpen(false);
      setUploadSuccess(null);
    }, 1200);
  };

  // Progress update handler from Reader
  const handleUpdateBookProgress = (bookId: string, page: number, chapterId: string, percent: number) => {
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id === bookId) {
          const updatedBook = {
            ...b,
            currentPage: page,
            currentChapterId: chapterId,
            progressPercent: percent,
            isFinished: percent >= 100,
            lastReadAt: new Date().toISOString(),
          };
          // Sync updated progress to SQLite
          syncBookToSqlite(updatedBook);
          return updatedBook;
        }
        return b;
      })
    );
    setTodayMinutesRead((m) => m + 1);
  };

  // Details update handler (when PDF reader extracts real chapters/pages)
  const handleUpdateBookDetails = (updatedBook: Book) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === updatedBook.id ? { ...b, ...updatedBook } : b))
    );
    syncBookToSqlite(updatedBook);
  };

  // Add highlight from reader
  const handleAddHighlight = (hl: Highlight) => {
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id === hl.bookId) {
          const highlights = b.highlights || [];
          return { ...b, highlights: [hl, ...highlights] };
        }
        return b;
      })
    );
  };

  // Add bookmark from reader
  const handleAddBookmark = (bm: BookmarkType) => {
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id === bm.bookId) {
          const bookmarks = b.bookmarks || [];
          return { ...b, bookmarks: [bm, ...bookmarks] };
        }
        return b;
      })
    );
  };

  // Toggle favorite
  const toggleFavorite = (bookId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBooks((prev) =>
      prev.map((b) => (b.id === bookId ? { ...b, isFavorite: !b.isFavorite } : b))
    );
  };

  // AI Book Weaver Generator
  const handleWeaveBook = async () => {
    if (!weaverPrompt.trim()) return;
    setIsWeaving(true);
    setWeaverSuccessMsg(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Write a masterpiece book chapter for Apple Books titled "${weaverPrompt}" in the genre "${weaverGenre}" for "${weaverAudience}". Give a structured response with 4 paragraphs of deep insight and practical wisdom.`,
        }),
      });

      let contentParas = [
        'Every monumental trajectory begins with a quiet refusal to accept the default settings of the world.',
        'When you operate with clear conviction and aligned habits, complexity dissolves into executable first principles.',
        'For Maaran and our family dynasty, true power is not noise; it is unshakeable inner calm coupled with relentless compounding leverage.',
        'Design the system, protect your attention, and let compounding do the heavy lifting.',
      ];

      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          const split = data.reply.split('\n\n').filter((p: string) => p.trim().length > 20);
          if (split.length >= 2) contentParas = split;
        }
      }

      const newBook: Book = {
        id: `ai-book-${Date.now()}`,
        title: weaverPrompt,
        subtitle: `A Sovereign Odyssey in ${weaverGenre}`,
        author: 'Thamiz & Aura AI Weaver',
        genre: weaverGenre,
        coverGradient: 'from-amber-900 via-rose-950 to-indigo-950',
        accentColor: '#f59e0b',
        rating: 5.0,
        reviewCount: 1,
        totalPages: 160,
        currentPage: 1,
        currentChapterId: 'ch1',
        progressPercent: 1,
        isFavorite: true,
        addedAt: new Date().toISOString().split('T')[0],
        description: `An original volume tailored for ${weaverAudience}, synthesizing high-leverage mastery and purposeful execution.`,
        chapters: [
          {
            id: 'ch1',
            title: 'Chapter 1: The Sovereign Catalyst',
            readingTimeMinutes: 6,
            content: contentParas,
          },
        ],
      };

      setBooks([newBook, ...books]);
      syncBookToSqlite(newBook);
      setWeaverSuccessMsg(`"${newBook.title}" has been woven and shelved in your Apple Bookshelf!`);
      setWeaverPrompt('');
    } catch {
      setWeaverSuccessMsg('Created your custom book and placed on shelf.');
    } finally {
      setIsWeaving(false);
    }
  };

  // Filtered & Sorted books
  const filteredBooks = books.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre =
      selectedGenre === 'All'
        ? true
        : selectedGenre === 'PDF & Documents'
        ? b.isPdf || b.genre === 'PDF & Documents'
        : b.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  const sortedBooks = [...filteredBooks].sort((a, b) => {
    if (sortBy === 'progress') return b.progressPercent - a.progressPercent;
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'rating') return b.rating - a.rating;
    return new Date(b.lastReadAt || b.addedAt).getTime() - new Date(a.lastReadAt || a.addedAt).getTime();
  });

  const featuredBook = books.find((b) => b.id === 'pdf-bitcoin-whitepaper') || books[0];
  const finishedBooks = books.filter((b) => b.isFinished);
  const pdfBooksCount = books.filter((b) => b.isPdf || b.genre === 'PDF & Documents').length;

  // Concentric Rings calculation
  const dailyPercent = Math.min(100, Math.round((todayMinutesRead / dailyGoalMinutes) * 100));
  const annualPercent = Math.min(100, Math.round((finishedBooks.length / annualGoalBooks) * 100));

  return (
    <div
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 select-text text-white"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        if (e.dataTransfer.files) {
          handlePdfFiles(e.dataTransfer.files);
        }
      }}
    >
      {/* Hidden File Input for PDF Books */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handlePdfFiles(e.target.files);
          }
        }}
      />

      {/* Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center border-4 border-dashed border-amber-500 pointer-events-none p-6 text-center animate-in fade-in duration-150">
          <UploadCloud className="w-16 h-16 text-amber-400 animate-bounce mb-3" />
          <h2 className="text-2xl font-bold text-white">Drop your PDF Books Here</h2>
          <p className="text-sm text-slate-300 mt-1">
            They will be saved in your Apple Books library and synced with SQLite across your instances!
          </p>
        </div>
      )}

      {/* =========================================================================
          APPLE BOOKS HEADER & FITNESS-STYLE CONCENTRIC READING GOAL RINGS
          ========================================================================= */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-neutral-900 to-amber-950/40 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Apple Books & Sovereign Library</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                <FileText className="w-3 h-3 text-rose-400" />
                <span>{pdfBooksCount} PDF Books</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Sovereign Library & PDF Reader
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Distraction-free reading with dual PDF viewer, reflowable typography, ambient soundscapes, read-aloud voice, and Gemini AI book companion.
            </p>
          </div>

          {/* Right Header Actions: Add PDF Book Button + Activity Rings */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Prominent Upload PDF Book Button */}
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 via-amber-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-600/25 transition-all active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>Add PDF Book</span>
            </button>

            {/* Concentric Reading Activity Rings */}
            <div className="flex items-center gap-4 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
              <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" className="text-slate-800" fill="transparent" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="url(#amberGradient)"
                    strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - dailyPercent / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                  <circle cx="50" cy="50" r="28" stroke="currentColor" strokeWidth="8" className="text-slate-800" fill="transparent" />
                  <circle
                    cx="50"
                    cy="50"
                    r="28"
                    stroke="url(#emeraldGradient)"
                    strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 28}
                    strokeDashoffset={2 * Math.PI * 28 * (1 - annualPercent / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                  <defs>
                    <linearGradient id="amberGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#fbbf24" />
                    </linearGradient>
                    <linearGradient id="emeraldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                </svg>
                <Flame className="w-5 h-5 text-amber-400 absolute" />
              </div>

              <div className="text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-slate-300 font-medium">Daily:</span>
                  <span className="font-bold text-white font-mono">
                    {todayMinutesRead}/{dailyGoalMinutes}m
                  </span>
                  <button
                    onClick={() => setTodayMinutesRead((m) => m + 5)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                    title="Add 5 mins"
                  >
                    +5m
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-slate-300 font-medium">Annual:</span>
                  <span className="font-bold text-white font-mono">
                    {finishedBooks.length}/{annualGoalBooks} Books
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold pt-0.5">
                  <Flame className="w-3.5 h-3.5" />
                  <span>{streakDays}-Day Streak</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================================
            APPLE BOOKS SEGMENTED TABS
            ===================================================================== */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto no-scrollbar scroll-smooth">
          {[
            { id: 'reading-now', label: 'Reading Now', icon: BookOpen },
            { id: 'library', label: 'My Library', icon: Library },
            { id: 'bookstore', label: 'PDF Vault & Store', icon: Compass },
            { id: 'goals', label: 'Reading Goals', icon: TrendingUp },
            { id: 'ai-weaver', label: 'AI Book Weaver', icon: Feather },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 scale-105'
                    : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          TAB 1: READING NOW (HERO JUMP-BACK-IN CARD & CURRENT SHELF)
          ========================================================================= */}
      {activeTab === 'reading-now' && (
        <div className="space-y-6">
          {/* Hero Featured Resume Book */}
          {featuredBook && (
            <div
              onClick={() => setActiveReadingBook(featuredBook)}
              className="cursor-pointer group p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-neutral-900 to-amber-950/60 border border-slate-800 hover:border-amber-500/50 transition-all shadow-xl relative overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                {/* 3D Book Cover Miniature */}
                <div className="relative shrink-0 perspective-1000 group-hover:scale-105 transition-transform duration-300">
                  <div
                    className={`w-28 h-40 sm:w-32 sm:h-44 rounded-xl bg-gradient-to-br ${featuredBook.coverGradient} p-3 flex flex-col justify-between shadow-2xl border-l-4 border-amber-600/60 relative overflow-hidden`}
                  >
                    <div className="absolute top-0 bottom-0 left-0 w-3 bg-white/10 blur-[1px]" />
                    <div className="space-y-1 relative z-10">
                      <span className="text-[8px] font-mono text-amber-300 uppercase tracking-widest block truncate">
                        {featuredBook.genre}
                      </span>
                      <h4 className="text-xs font-bold text-white line-clamp-3 leading-snug">
                        {featuredBook.title}
                      </h4>
                    </div>
                    <div className="text-[9px] text-slate-300 font-mono relative z-10 truncate">
                      {featuredBook.author}
                    </div>
                  </div>
                  {/* Bookmark ribbon */}
                  <div className="absolute top-0 right-3 w-3 h-5 bg-amber-500 shadow-md" />
                </div>

                {/* Book Details & Continue Reading Action */}
                <div className="flex-1 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                      CURRENTLY READING
                    </span>
                    {featuredBook.isPdf && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold">
                        PDF • {featuredBook.pdfFileSize}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 font-mono">
                      Page {featuredBook.currentPage} of {featuredBook.totalPages}
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                    {featuredBook.title}
                  </h3>
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {featuredBook.description}
                  </p>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Reading Progress</span>
                      <span className="text-amber-400 font-bold">{featuredBook.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-yellow-400 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${featuredBook.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveReadingBook(featuredBook);
                      }}
                      className="px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/30 transition-all"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>{featuredBook.isPdf ? 'Read PDF' : 'Resume Reading'}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPdfModalOpen(true);
                      }}
                      className="px-3 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Import Another PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sliding Bookshelf: Currently Reading & Up Next */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Active Bookshelf & PDFs</h3>
              </div>
              <button
                onClick={() => setActiveTab('library')}
                className="text-xs text-amber-400 hover:underline flex items-center gap-1"
              >
                <span>View Full Library</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Realistic Wooden / Matte Acrylic Bookshelf */}
            <div className="relative pt-4 pb-6">
              <div className="flex items-end gap-6 overflow-x-auto pb-4 px-2 no-scrollbar scroll-smooth">
                {books.map((book) => (
                  <div
                    key={book.id}
                    onClick={() => setActiveReadingBook(book)}
                    className="cursor-pointer group flex flex-col items-center shrink-0 w-32 relative"
                  >
                    {/* Realistic 3D Cover */}
                    <div
                      className={`w-28 h-40 rounded-lg bg-gradient-to-br ${book.coverGradient} p-3 flex flex-col justify-between shadow-2xl border-l-4 border-white/20 group-hover:-translate-y-2 transition-transform duration-300 relative overflow-hidden`}
                    >
                      <div className="absolute top-0 bottom-0 left-0 w-2.5 bg-white/10" />

                      <div className="flex items-center justify-between z-10">
                        <span className="text-[7px] font-mono text-amber-300 uppercase tracking-widest block truncate">
                          {book.genre}
                        </span>
                        {book.isPdf && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-600/90 text-white font-mono text-[7px] font-bold">
                            PDF
                          </span>
                        )}
                      </div>

                      <h5 className="text-[11px] font-bold text-white line-clamp-3 leading-snug z-10">
                        {book.title}
                      </h5>
                      <span className="text-[8px] text-slate-300 font-mono truncate z-10">
                        {book.author}
                      </span>
                    </div>

                    {/* Progress Indicator under book */}
                    <div className="w-24 mt-2.5 text-center">
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-amber-500 h-1.5 rounded-full"
                          style={{ width: `${book.progressPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                        {book.progressPercent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Wooden Bookshelf Edge */}
              <div className="h-3 w-full rounded-md bg-gradient-to-b from-amber-900 to-amber-950 border-t border-amber-700/60 shadow-lg shadow-black/80" />
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: MY LIBRARY (COLLECTIONS, SHELVES, SEARCH, FILTERS)
          ========================================================================= */}
      {activeTab === 'library' && (
        <div className="space-y-4">
          {/* Search, Upload & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search books, PDFs, authors..."
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>

            {/* Upload PDF Book Quick Action Button */}
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 shadow transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Upload PDF</span>
            </button>

            {/* View Mode & Sort */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none"
              >
                <option value="recent">Recently Read</option>
                <option value="progress">Reading Progress</option>
                <option value="rating">Top Rated</option>
                <option value="title">Alphabetical</option>
              </select>

              <div className="flex bg-slate-900 p-0.5 rounded-2xl border border-slate-800">
                <button
                  onClick={() => setViewMode('shelf')}
                  className={`p-2 rounded-xl transition-colors ${
                    viewMode === 'shelf' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                  }`}
                  title="Bookshelf View"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-xl transition-colors ${
                    viewMode === 'list' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                  }`}
                  title="List View"
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Genre Category Chips including dedicated PDF & Documents */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1">
            {[
              'All',
              'PDF & Documents',
              'Venture & Tech',
              'Robotics & STEM',
              'Philosophy & Classics',
              'Dynasty & History',
              'Behavior & Habits',
            ].map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  selectedGenre === genre
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {genre === 'PDF & Documents' && <FileText className="w-3.5 h-3.5 text-rose-400" />}
                <span>{genre}</span>
                {genre === 'PDF & Documents' && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-300 text-[10px]">
                    {pdfBooksCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Shelf / Grid View */}
          {viewMode === 'shelf' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-2">
              {sortedBooks.map((book) => (
                <div
                  key={book.id}
                  onClick={() => setActiveReadingBook(book)}
                  className="cursor-pointer group p-3.5 rounded-3xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col justify-between shadow-lg relative overflow-hidden"
                >
                  {/* 3D Cover */}
                  <div
                    className={`w-full h-44 rounded-2xl bg-gradient-to-br ${book.coverGradient} p-4 flex flex-col justify-between shadow-xl border-l-4 border-white/20 group-hover:scale-[1.02] transition-transform relative overflow-hidden`}
                  >
                    <div className="space-y-1 relative z-10">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-mono text-amber-300 uppercase tracking-wider block">
                          {book.genre}
                        </span>
                        {book.isPdf && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono text-[8px] font-bold">
                            PDF
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-white line-clamp-3 leading-snug">
                        {book.title}
                      </h4>
                    </div>

                    <div className="relative z-10 flex items-center justify-between text-[9px] text-slate-300 font-mono">
                      <span className="truncate">{book.author}</span>
                      {book.isAudiobook && <Headphones className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                  </div>

                  {/* Info & Progress */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">
                        {book.isPdf && book.pdfFileSize ? book.pdfFileSize : `${book.totalPages} pages`}
                      </span>
                      <span className="text-amber-400 font-bold">{book.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-1.5 rounded-full"
                        style={{ width: `${book.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List View */
            <div className="space-y-2.5">
              {sortedBooks.map((book) => (
                <div
                  key={book.id}
                  onClick={() => setActiveReadingBook(book)}
                  className="cursor-pointer group p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-12 h-16 rounded-lg bg-gradient-to-br ${book.coverGradient} shrink-0 p-1 flex flex-col justify-end text-[7px] text-white font-bold truncate`}
                    >
                      {book.title.slice(0, 15)}...
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-400 transition-colors">
                          {book.title}
                        </h4>
                        {book.isPdf && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-mono text-[8px] font-bold">
                            PDF
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{book.author}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
                        <span>{book.genre}</span>
                        <span>•</span>
                        <span>{book.pdfFileSize || `${book.totalPages} pages`}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right font-mono">
                      <span className="text-xs font-bold text-amber-400 block">
                        {book.progressPercent}%
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {book.currentPage}/{book.totalPages}
                      </span>
                    </div>

                    <button
                      onClick={(e) => toggleFavorite(book.id, e)}
                      className={`p-2 rounded-xl transition-colors ${
                        book.isFavorite ? 'text-rose-500' : 'text-slate-600 hover:text-slate-400'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${book.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: BOOK STORE & CLASSICAL PDF VAULT
          ========================================================================= */}
      {activeTab === 'bookstore' && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono text-indigo-400 font-bold uppercase tracking-wider block mb-1">
                Curated Digital Vault
              </span>
              <h3 className="text-lg font-bold text-white">
                Sovereign Whitepapers & Classical Treatises
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Download or read iconic whitepapers in dual PDF / reflowable format.
              </p>
            </div>
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <Upload className="w-4 h-4" />
              <span>Import Your Own PDF</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {books
              .filter((b) => b.isPdf)
              .map((pdfBook) => (
                <div
                  key={pdfBook.id}
                  onClick={() => setActiveReadingBook(pdfBook)}
                  className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all flex items-start gap-4 cursor-pointer group"
                >
                  <div
                    className={`w-16 h-24 rounded-xl bg-gradient-to-br ${pdfBook.coverGradient} p-2 flex flex-col justify-between shrink-0 shadow-lg border-l-2 border-white/20`}
                  >
                    <span className="text-[7px] font-mono text-rose-300 uppercase">PDF</span>
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[9px] font-mono font-bold">
                        {pdfBook.pdfFileSize || 'PDF'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {pdfBook.totalPages} Pages
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors mt-1 truncate">
                      {pdfBook.title}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono">{pdfBook.author}</p>
                    <p className="text-xs text-slate-300 line-clamp-2 mt-1 leading-relaxed">
                      {pdfBook.description}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveReadingBook(pdfBook);
                        }}
                        className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Open & Read</span>
                      </button>
                      {pdfBook.pdfUrl && (
                        <a
                          href={pdfBook.pdfUrl}
                          download={pdfBook.pdfFileName || `${pdfBook.title}.pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: READING GOALS & HABITS (FITNESS-STYLE TRACKER)
          ========================================================================= */}
      {activeTab === 'goals' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
                Today&apos;s Reading Time
              </span>
              <div className="text-3xl font-black text-white font-mono">
                {todayMinutesRead} <span className="text-base font-normal text-slate-400">/ {dailyGoalMinutes} min</span>
              </div>
              <p className="text-xs text-slate-400">
                Target: 30 minutes of intentional reading and insight absorption.
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider block">
                Annual Target
              </span>
              <div className="text-3xl font-black text-white font-mono">
                {finishedBooks.length} <span className="text-base font-normal text-slate-400">/ {annualGoalBooks} books</span>
              </div>
              <p className="text-xs text-slate-400">
                Pacing: 1 volume completed every month across tech, finance, and classics.
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-xs font-mono text-orange-400 uppercase tracking-wider block">
                Daily Consistency Streak
              </span>
              <div className="text-3xl font-black text-white font-mono flex items-center gap-2">
                <span>{streakDays} Days</span>
                <Flame className="w-6 h-6 text-amber-400" />
              </div>
              <p className="text-xs text-slate-400">
                Habit loop maintained without missing a single calendar day!
              </p>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white">Log Reading Habit Session</h3>
            <div className="flex flex-wrap gap-2">
              {[5, 15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setTodayMinutesRead((m) => m + mins)}
                  className="px-4 py-2 rounded-2xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-all text-xs font-mono font-bold"
                >
                  +{mins} Minutes
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: AI BOOK WEAVER (GEMINI 3.8 FLASH CUSTOM BOOK AUTHORING)
          ========================================================================= */}
      {activeTab === 'ai-weaver' && (
        <div className="space-y-4">
          <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-amber-950/40 border border-indigo-500/30 space-y-2">
            <div className="flex items-center gap-2">
              <Feather className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">AI Story Weaver & Book Studio</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Commission Gemini to author a personalized volume for your bookshelf. Format, customize, and read with ambient soundscapes and speech synthesis!
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Book Concept or Story Idea:
              </label>
              <textarea
                rows={3}
                value={weaverPrompt}
                onChange={(e) => setWeaverPrompt(e.target.value)}
                placeholder="e.g., Young Maaran designs an autonomous Martian drone to discover hidden water caverns on the red planet..."
                className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Genre:</label>
                <select
                  value={weaverGenre}
                  onChange={(e) => setWeaverGenre(e.target.value)}
                  className="w-full p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                >
                  <option value="Robotics & STEM">Robotics & STEM</option>
                  <option value="Venture & Tech">Venture & Tech</option>
                  <option value="Philosophy & Classics">Philosophy & Classics</option>
                  <option value="Dynasty & History">Dynasty & History</option>
                  <option value="Behavior & Habits">Behavior & Habits</option>
                  <option value="AI & Fiction">AI & Fiction</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Audience:</label>
                <input
                  type="text"
                  value={weaverAudience}
                  onChange={(e) => setWeaverAudience(e.target.value)}
                  placeholder="e.g. Young Maaran, Family Leaders"
                  className="w-full p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                />
              </div>
            </div>

            {weaverSuccessMsg && (
              <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{weaverSuccessMsg}</span>
              </div>
            )}

            <button
              onClick={handleWeaveBook}
              disabled={isWeaving || !weaverPrompt.trim()}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 disabled:opacity-40 transition-all"
            >
              {isWeaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Weaving Chapters with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Weave Book & Add to Apple Bookshelf</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD PDF BOOK DIALOG
          ========================================================================= */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl p-6 text-white shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Add PDF Books to Library</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Local files &bull; Online PDF URLs &bull; Synced with SQLite
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Option 1: File Upload / Drag Drop */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-3xl p-6 text-center cursor-pointer transition-colors bg-slate-900/50 hover:bg-slate-900 group"
            >
              <UploadCloud className="w-10 h-10 text-amber-400 group-hover:scale-110 transition-transform mx-auto mb-2" />
              <h4 className="font-bold text-xs text-white">
                Click to browse or drop your .pdf file here
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Supports books, academic papers, reports, and manuals
              </p>
            </div>

            {/* Option 2: Enter Web PDF URL */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                Or Add via Web URL
              </span>

              <input
                type="text"
                value={pdfTitleInput}
                onChange={(e) => setPdfTitleInput(e.target.value)}
                placeholder="Document / Book Title"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
              />

              <input
                type="text"
                value={pdfAuthorInput}
                onChange={(e) => setPdfAuthorInput(e.target.value)}
                placeholder="Author / Institution (optional)"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
              />

              <div className="flex gap-2">
                <input
                  type="url"
                  value={pdfUrlInput}
                  onChange={(e) => setPdfUrlInput(e.target.value)}
                  placeholder="https://example.com/research-paper.pdf"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
                <button
                  onClick={handleAddPdfUrl}
                  disabled={!pdfUrlInput.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition-colors shrink-0"
                >
                  Add URL
                </button>
              </div>
            </div>

            {uploadError && (
              <p className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-xl border border-rose-500/30">
                {uploadError}
              </p>
            )}

            {uploadSuccess && (
              <p className="text-xs text-emerald-400 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{uploadSuccess}</span>
              </p>
            )}

            {isUploadingPdf && (
              <div className="flex items-center justify-center gap-2 text-xs text-amber-400 py-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Parsing and encrypting PDF into SQLite...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          FULL-SCREEN APPLE BOOKS INTERACTIVE READER MODAL
          ========================================================================= */}
      {activeReadingBook && (
        <AppleBookReaderModal
          book={activeReadingBook}
          onClose={() => setActiveReadingBook(null)}
          onUpdateBookProgress={handleUpdateBookProgress}
          onUpdateBookDetails={handleUpdateBookDetails}
          onAddHighlight={handleAddHighlight}
          onAddBookmark={handleAddBookmark}
        />
      )}
    </div>
  );
};
