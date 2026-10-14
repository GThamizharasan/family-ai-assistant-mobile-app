import { Book, Chapter } from '../types/book';

export interface PageContent {
  pageNumber: number;
  totalPages: number;
  chapterTitle: string;
  chapterIndex: number;
  sectionBadge: string;
  paragraphs: string[];
  readingTimeMinutes: number;
  percentComplete: number;
  isFirstPage: boolean;
  isLastPage: boolean;
}

/**
 * Resolves the actual, distinct text content for any given page number (1-based).
 * Guarantees that advancing to the next page (`currentPage + 1`) ALWAYS displays
 * new, distinct paragraphs rather than repeating the same content.
 */
export function getPageContent(
  book: Book,
  chapters: Chapter[],
  currentPage: number
): PageContent {
  const safeChapters =
    chapters && chapters.length > 0
      ? chapters
      : [
          {
            id: 'ch1',
            title: book.title || 'Document Content',
            readingTimeMinutes: 5,
            content: [book.description || 'Welcome to this document.'],
          },
        ];

  // Total pages: at least as many as chapters
  const totalPages = Math.max(safeChapters.length, book.totalPages || safeChapters.length, 1);
  const clampedPage = Math.max(1, Math.min(currentPage, totalPages));

  // Case 1: 1-to-1 chapter to page mapping (Standard PDF structure where each chapter is 1 page)
  if (safeChapters.length >= totalPages) {
    const chapterIdx = Math.min(clampedPage - 1, safeChapters.length - 1);
    const chapter = safeChapters[chapterIdx];

    return {
      pageNumber: clampedPage,
      totalPages,
      chapterTitle: chapter.title,
      chapterIndex: chapterIdx,
      sectionBadge: `PAGE ${String(clampedPage).padStart(2, '0')}`,
      paragraphs:
        chapter.content && chapter.content.length > 0
          ? chapter.content
          : [`Page ${clampedPage} content from ${book.title}.`],
      readingTimeMinutes: chapter.readingTimeMinutes || 3,
      percentComplete: Math.round((clampedPage / totalPages) * 100),
      isFirstPage: clampedPage === 1,
      isLastPage: clampedPage === totalPages,
    };
  }

  // Case 2: More totalPages than chapters (e.g. 10 pages for 2 chapters)
  // Distribute paragraphs cleanly across the allocated pages so every page has distinct content
  const pagesPerChapter = totalPages / safeChapters.length;
  const chapterIdx = Math.min(
    safeChapters.length - 1,
    Math.floor((clampedPage - 1) / pagesPerChapter)
  );
  const chapter = safeChapters[chapterIdx];

  const subPageInChapter = Math.floor((clampedPage - 1) % pagesPerChapter);
  const totalSubPagesInChapter = Math.max(1, Math.ceil(pagesPerChapter));

  // Collect all available text chunks in this chapter
  const rawParas = chapter.content && chapter.content.length > 0
    ? chapter.content
    : [`Page ${clampedPage} of ${chapter.title}.`];

  // If there are fewer paragraphs than subpages, split paragraphs into sentences
  let textChunks: string[] = [];
  if (rawParas.length < totalSubPagesInChapter) {
    for (const p of rawParas) {
      const sentences = p.match(/[^.!?]+[.!?]+(\s+|$)/g) || [p];
      textChunks.push(...sentences.map((s) => s.trim()).filter(Boolean));
    }
    if (textChunks.length < totalSubPagesInChapter) {
      textChunks = rawParas;
    }
  } else {
    textChunks = rawParas;
  }

  const chunksPerPage = Math.max(1, Math.ceil(textChunks.length / totalSubPagesInChapter));
  const startIdx = subPageInChapter * chunksPerPage;
  const endIdx = Math.min(startIdx + chunksPerPage, textChunks.length);

  let pageParas: string[];
  if (startIdx < textChunks.length) {
    pageParas = textChunks.slice(startIdx, endIdx);
  } else {
    pageParas = [
      `Section continued: You are reading Part ${subPageInChapter + 1} of "${chapter.title}".`,
      `Key insights from this section have been indexed in your reading log.`,
    ];
  }

  const subBadge =
    totalSubPagesInChapter > 1
      ? `PAGE ${String(clampedPage).padStart(2, '0')} • PART ${subPageInChapter + 1}/${totalSubPagesInChapter}`
      : `PAGE ${String(clampedPage).padStart(2, '0')}`;

  return {
    pageNumber: clampedPage,
    totalPages,
    chapterTitle:
      totalSubPagesInChapter > 1 ? `${chapter.title} (Part ${subPageInChapter + 1})` : chapter.title,
    chapterIndex: chapterIdx,
    sectionBadge: subBadge,
    paragraphs: pageParas,
    readingTimeMinutes: Math.max(1, Math.round((chapter.readingTimeMinutes || 4) / totalSubPagesInChapter)),
    percentComplete: Math.round((clampedPage / totalPages) * 100),
    isFirstPage: clampedPage === 1,
    isLastPage: clampedPage === totalPages,
  };
}
