import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, AlertCircle } from 'lucide-react';
import { dataUrlToUint8Array } from '../../utils/pdfHelper';

// Configure worker
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    }
  } catch (e) {
    console.warn('PDF.js worker notice:', e);
  }
}

interface PdfCanvasViewerProps {
  pdfSource: string; // Blob URL, data:application/pdf URL, or web URL
  currentPage: number;
  zoom?: number;
  bookTitle?: string;
  scrollMode?: 'page' | 'continuous';
  onPageChange?: (page: number) => void;
  onNumPagesLoaded?: (numPages: number) => void;
  fallbackView?: React.ReactNode;
}

// Single Page Renderer in Continuous Scroll View with IntersectionObserver
const ContinuousPageItem: React.FC<{
  doc: any;
  pageNum: number;
  zoom: number;
  containerWidth: number;
  bookTitle: string;
  onVisible: () => void;
}> = ({ doc, pageNum, zoom, containerWidth, bookTitle, onVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1.414); // Standard A4 ratio fallback

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsRendered(true);
            if (entry.intersectionRatio >= 0.5) {
              onVisible();
            }
          }
        });
      },
      { rootMargin: '350px 0px 350px 0px', threshold: [0.1, 0.5] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible]);

  useEffect(() => {
    if (!isRendered || !doc || !canvasRef.current) return;
    let isCancelled = false;
    let renderTask: any = null;

    const render = async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (isCancelled) return;

        const baseViewport = page.getViewport({ scale: 1.0 });
        if (baseViewport.width > 0 && baseViewport.height > 0) {
          setAspectRatio(baseViewport.height / baseViewport.width);
        }

        const effectiveWidth = Math.max(300, containerWidth - 32);
        const fitScale = Math.min(2.0, Math.max(0.6, effectiveWidth / baseViewport.width));
        const effectiveZoom = zoom * fitScale;
        const pixelRatio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: effectiveZoom * pixelRatio });

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / pixelRatio}px`;
        canvas.style.height = `${viewport.height / pixelRatio}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`Continuous PDF page ${pageNum} render notice:`, err);
        }
      }
    };

    render();
    return () => {
      isCancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {}
      }
    };
  }, [isRendered, doc, pageNum, zoom, containerWidth]);

  return (
    <div
      ref={wrapperRef}
      id={`continuous-pdf-page-${pageNum}`}
      className="bg-white rounded-md shadow-2xl p-1 sm:p-2 border border-slate-300 max-w-full overflow-hidden flex flex-col items-center justify-center relative transition-all my-3"
      style={{ minHeight: `${Math.round(Math.max(300, containerWidth - 32) * aspectRatio)}px` }}
    >
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-500 px-2 py-1 border-b border-slate-100 mb-1 select-none">
        <span className="truncate max-w-[200px]">{bookTitle}</span>
        <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Page {pageNum}</span>
      </div>
      <canvas
        ref={canvasRef}
        className="rounded-sm block max-w-full h-auto select-none"
        title={`${bookTitle} - Page ${pageNum}`}
      />
      {!isRendered && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/60 text-slate-400 text-xs font-mono">
          <Loader2 className="w-5 h-5 text-amber-500 animate-spin mb-1" />
          <span>Loading Page {pageNum}...</span>
        </div>
      )}
    </div>
  );
};

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  pdfSource,
  currentPage,
  zoom = 1.0,
  bookTitle = 'PDF Document',
  scrollMode = 'page',
  onPageChange,
  onNumPagesLoaded,
  fallbackView,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(750);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 600, height: 800 });

  // Measure container width responsively
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth || 750);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // 1. Load document when pdfSource changes
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setRenderError(null);

    const loadDoc = async () => {
      try {
        let loadingTask;
        if (pdfSource.startsWith('data:application/pdf')) {
          const bytes = dataUrlToUint8Array(pdfSource);
          loadingTask = pdfjsLib.getDocument({ data: bytes });
        } else {
          loadingTask = pdfjsLib.getDocument({ url: pdfSource });
        }

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        if (onNumPagesLoaded) {
          onNumPagesLoaded(doc.numPages);
        }
        setIsLoading(false);
      } catch (err: any) {
        if (isCancelled) return;
        console.warn('Could not load PDF in vector canvas mode:', err);
        setRenderError(err?.message || 'Failed to initialize PDF renderer');
        setIsLoading(false);
      }
    };

    if (pdfSource) {
      loadDoc();
    } else {
      setIsLoading(false);
    }

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancellation errors
        }
      }
    };
  }, [pdfSource]);

  // 2. Render target page in single-page mode whenever currentPage, zoom, or pdfDoc changes
  useEffect(() => {
    if (scrollMode === 'continuous' || !pdfDocRef.current || !canvasRef.current) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
          renderTaskRef.current = null;
        }

        const doc = pdfDocRef.current;
        const pageNum = Math.max(1, Math.min(currentPage, doc.numPages));
        const page = await doc.getPage(pageNum);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const pixelRatio = window.devicePixelRatio || 1;
        const baseViewport = page.getViewport({ scale: 1.0 });

        const effectiveWidth = Math.max(300, (containerRef.current?.clientWidth || containerWidth) - 32);
        const fitScale = Math.min(2.0, Math.max(0.6, effectiveWidth / baseViewport.width));
        const effectiveZoom = zoom * fitScale;

        const viewport = page.getViewport({ scale: effectiveZoom * pixelRatio });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / pixelRatio}px`;
        canvas.style.height = `${viewport.height / pixelRatio}px`;

        setPageSize({
          width: viewport.width / pixelRatio,
          height: viewport.height / pixelRatio,
        });

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        renderTaskRef.current = null;
      } catch (err: any) {
        if (err?.name === 'RenderingCancelledException') {
          return;
        }
        console.warn('Page rendering notice:', err);
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [currentPage, zoom, isLoading, scrollMode, containerWidth]);

  // If error occurred (e.g. data URL unsupported or non-PDF binary), render fallback
  if (renderError && fallbackView) {
    return <>{fallbackView}</>;
  }

  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col items-center justify-center relative min-h-[500px]"
    >
      {/* Loading state indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm rounded-2xl z-10 text-slate-300">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
          <span className="text-xs font-mono font-medium">Loading PDF Document...</span>
        </div>
      )}

      {/* CONTINUOUS SCROLL MODE: Stack of all pages with lazy rendering */}
      {scrollMode === 'continuous' && pdfDocRef.current ? (
        <div className="w-full flex flex-col items-center py-2">
          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
            <ContinuousPageItem
              key={pageNum}
              doc={pdfDocRef.current}
              pageNum={pageNum}
              zoom={zoom}
              containerWidth={containerWidth}
              bookTitle={bookTitle}
              onVisible={() => {
                if (onPageChange && pageNum !== currentPage) {
                  onPageChange(pageNum);
                }
              }}
            />
          ))}
        </div>
      ) : (
        /* SINGLE PAGE FLIP MODE: Single High-Definition Canvas */
        <div className="bg-white rounded-md shadow-2xl p-1 sm:p-2 border border-slate-300 max-w-full overflow-hidden flex justify-center items-center transition-all animate-in fade-in duration-150">
          <canvas
            ref={canvasRef}
            className="rounded-sm block max-w-full h-auto select-none"
            title={`${bookTitle} - Page ${currentPage}`}
          />
        </div>
      )}
    </div>
  );
};
