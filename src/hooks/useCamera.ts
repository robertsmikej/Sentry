import { useState, useRef, useCallback, useEffect } from 'react';

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStreaming: boolean;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureImage: () => HTMLCanvasElement | null;
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Don't call play() manually - the video element has autoPlay attribute
        // Just wait for the video to be ready
        videoRef.current.onloadedmetadata = () => {
          setIsStreaming(true);
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access camera';
      setError(message);
      setIsStreaming(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  const captureImage = useCallback((): HTMLCanvasElement | null => {
    if (!videoRef.current || !isStreaming) {
      return null;
    }

    const video = videoRef.current;

    // Ensure video has valid dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Video dimensions are 0');
      return null;
    }

    // Resize directly from video to avoid large canvas memory issues
    // Max 1200px wide, preserving aspect ratio
    const maxWidth = 1200;
    let destWidth = video.videoWidth;
    let destHeight = video.videoHeight;

    if (destWidth > maxWidth) {
      const scale = maxWidth / destWidth;
      destWidth = maxWidth;
      destHeight = Math.round(video.videoHeight * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = destWidth;
    canvas.height = destHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw directly from video at target size using explicit source/destination rectangles
      ctx.drawImage(
        video,
        0, 0, video.videoWidth, video.videoHeight,  // source: entire video frame
        0, 0, destWidth, destHeight                  // destination: scaled to canvas
      );
    }

    return canvas;
  }, [isStreaming]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    isStreaming,
    error,
    startCamera,
    stopCamera,
    captureImage,
  };
}
