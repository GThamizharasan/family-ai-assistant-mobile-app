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
  onNumPagesLoaded?: (numPages: number) => void;
  fallbackView?: React.ReactNode;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  pdfSource,
  currentPage,
  zoom = 1.0,
  bookTitle = 'PDF Document',
  onNumPagesLoaded,
  fallbackView,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 600, height: 800 });

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

  // 2. Render target page whenever currentPage, zoom, or pdfDoc changes
  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        // Cancel any pending render task first to avoid collisions
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // Ignore
          }
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

        // Calculate responsive scale based on viewport width
        const containerWidth = containerRef.current?.clientWidth || 750;
        const fitScale = Math.min(1.8, Math.max(0.6, (containerWidth - 32) / baseViewport.width));
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
        } catch {
          // Ignore
        }
      }
    };
  }, [currentPage, zoom, isLoading]);

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
          <span className="text-xs font-mono font-medium">Loading PDF Page {currentPage}...</span>
        </div>
      )}

      {/* Actual Rendered PDF Canvas */}
      <div className="bg-white rounded-md shadow-2xl p-1 sm:p-2 border border-slate-300 max-w-full overflow-hidden flex justify-center items-center transition-all">
        <canvas
          ref={canvasRef}
          className="rounded-sm block max-w-full h-auto select-none"
          title={`${bookTitle} - Page ${currentPage}`}
        />
      </div>
    </div>
  );
};
