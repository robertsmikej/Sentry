import { useState, useCallback } from 'react';
import { recognizeText, normalizeOCRText } from '../services/ocr';

interface UseOCRReturn {
  isProcessing: boolean;
  progress: number;
  error: string | null;
  processImage: (image: HTMLCanvasElement | string) => Promise<{ raw: string; normalized: string; confidence: number; preprocessedImageUrl?: string } | null>;
}

export function useOCR(): UseOCRReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const processImage = useCallback(
    async (image: HTMLCanvasElement | string) => {
      setIsProcessing(true);
      setProgress(0);
      setError(null);

      try {
        const result = await recognizeText(image, setProgress);
        const normalized = normalizeOCRText(result.text);

        return {
          raw: result.text,
          normalized,
          confidence: result.confidence,
          preprocessedImageUrl: result.preprocessedImageUrl,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'OCR processing failed';
        setError(message);
        return null;
      } finally {
        setIsProcessing(false);
        setProgress(0);
      }
    },
    []
  );

  return {
    isProcessing,
    progress,
    error,
    processImage,
  };
}
