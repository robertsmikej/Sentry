import { useState, useCallback } from 'react';
import { recognizeText, normalizeOCRText, getRecognitionSettings } from '../services/ocr';
import { recognizeWithGemini } from '../services/gemini';

interface UseOCRReturn {
  isProcessing: boolean;
  progress: number;
  error: string | null;
  usedFallback: boolean; // True if Gemini was preferred but fell back to OCR (e.g., offline)
  processImage: (image: HTMLCanvasElement | string) => Promise<{ raw: string; normalized: string; confidence: number; preprocessedImageUrl?: string } | null>;
}

export function useOCR(): UseOCRReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  const processImage = useCallback(
    async (image: HTMLCanvasElement | string) => {
      setIsProcessing(true);
      setProgress(0);
      setError(null);
      setUsedFallback(false);

      try {
        const recognitionSettings = getRecognitionSettings();

        // Check if Gemini is preferred but we need to fall back
        const geminiPreferred =
          recognitionSettings.method === 'gemini' &&
          recognitionSettings.geminiApiKey;
        const shouldFallback = geminiPreferred && !navigator.onLine;

        // Use Gemini if configured and online
        if (geminiPreferred && navigator.onLine) {
          // Show indeterminate progress for Gemini (no progress callback)
          setProgress(0.5);

          const result = await recognizeWithGemini(image, recognitionSettings.geminiApiKey, recognitionSettings.geminiMaxImageSize);
          const normalized = normalizeOCRText(result.text);

          return {
            raw: result.text,
            normalized,
            confidence: result.confidence,
            preprocessedImageUrl: undefined, // Gemini doesn't use preprocessing
          };
        }

        // Fall back to local OCR
        if (shouldFallback) {
          setUsedFallback(true);
        }

        const result = await recognizeText(image, setProgress);
        const normalized = normalizeOCRText(result.text);

        return {
          raw: result.text,
          normalized,
          confidence: result.confidence,
          preprocessedImageUrl: result.preprocessedImageUrl,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Recognition failed';
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
    usedFallback,
    processImage,
  };
}
