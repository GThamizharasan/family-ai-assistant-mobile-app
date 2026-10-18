export interface Chapter {
  id: string;
  title: string;
  readingTimeMinutes: number;
  content: string[];
}

export interface Highlight {
  id: string;
  bookId: string;
  chapterId: string;
  text: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
  note?: string;
  createdAt: string;
}

export interface Bookmark {
  id: string;
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  pageNumber: number;
  snippet: string;
  createdAt: string;
}

export type BookGenre =
  | 'PDF & Documents'
  | 'Venture & Tech'
  | 'Robotics & STEM'
  | 'Philosophy & Classics'
  | 'Dynasty & History'
  | 'Behavior & Habits'
  | 'AI & Fiction'
  | string;

export interface Book {
  id: string;
  title: string;
  author: string;
  subtitle?: string;
  coverGradient: string;
  accentColor: string;
  genre: BookGenre;
  rating: number;
  reviewCount: number;
  totalPages: number;
  currentPage: number;
  currentChapterId: string;
  progressPercent: number;
  isAudiobook?: boolean;
  audioDurationMinutes?: number;
  isFinished?: boolean;
  wantToRead?: boolean;
  isFavorite?: boolean;
  addedAt: string;
  lastReadAt?: string;
  description: string;
  chapters: Chapter[];
  highlights?: Highlight[];
  bookmarks?: Bookmark[];

  // PDF Book specific attributes
  isPdf?: boolean;
  pdfUrl?: string; // Blob URL, base64 data URL, or web link
  pdfFileName?: string;
  pdfFileSize?: string;
  pdfPageCount?: number;

  // Google Drive & Local Storage attributes
  driveFileId?: string;
  driveFolderId?: string;
  driveFolderPath?: string; // e.g. "Family Circle / Apple Books / Finance & Investing"
  driveCategory?: string;
  driveWebViewLink?: string;
  isLocalCached?: boolean;
  cachedAt?: string;
  lastAccessedAt?: string;
}

export type ReaderTheme = 'white' | 'sepia' | 'charcoal' | 'oled';
export type ReaderFont = 'sans' | 'serif' | 'palatino' | 'charter' | 'mono';
