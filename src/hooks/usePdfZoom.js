import { useCallback, useEffect, useState } from 'react';
import {
  PDF_ZOOM_FACTOR_MAX,
  PDF_ZOOM_FACTOR_MIN,
  stepPdfZoomFactor,
  zoomFactorFromPercent,
  zoomPercentFromFactor,
} from '../lib/pdfService.js';

/**
 * @param {import('pdfjs-dist').PDFDocumentProxy | null} pdf
 */
export function usePdfZoom(pdf) {
  const [zoomFactor, setZoomFactor] = useState(1);

  useEffect(() => {
    setZoomFactor(1);
  }, [pdf]);

  const zoomIn = useCallback(() => {
    setZoomFactor((z) => stepPdfZoomFactor(z, 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomFactor((z) => stepPdfZoomFactor(z, -1));
  }, []);

  const zoomFit = useCallback(() => {
    setZoomFactor(1);
  }, []);

  const stepZoom = useCallback((direction) => {
    setZoomFactor((z) => stepPdfZoomFactor(z, direction));
  }, []);

  const zoomPercent = zoomPercentFromFactor(zoomFactor);
  const atFitZoom = zoomFactor === 1;
  const canZoomOut = zoomFactor > PDF_ZOOM_FACTOR_MIN;
  const canZoomIn = zoomFactor < PDF_ZOOM_FACTOR_MAX;

  const setZoomFromPercent = useCallback((percent) => {
    const factor = zoomFactorFromPercent(percent);
    if (factor == null) return;
    setZoomFactor(factor);
  }, []);

  return {
    zoomFactor,
    setZoomFactor,
    zoomPercent,
    atFitZoom,
    canZoomOut,
    canZoomIn,
    zoomIn,
    zoomOut,
    zoomFit,
    stepZoom,
    setZoomFromPercent,
  };
}
