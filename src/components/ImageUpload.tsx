import { useRef, useState } from 'react';

interface ImageUploadProps {
  onImageSelected: (canvas: HTMLCanvasElement) => void;
  onError?: (error: string) => void;
}

export function ImageUpload({ onImageSelected, onError }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      onError?.('Please select an image file');
      return;
    }

    setIsLoading(true);

    try {
      const imageDataUrl = await readFileAsDataURL(file);
      setPreview(imageDataUrl);

      const canvas = await imageToCanvas(imageDataUrl);
      onImageSelected(canvas);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process image';
      onError?.(message);
    } finally {
      setIsLoading(false);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onError?.('Please drop an image file');
      return;
    }

    setIsLoading(true);

    try {
      const imageDataUrl = await readFileAsDataURL(file);
      setPreview(imageDataUrl);

      const canvas = await imageToCanvas(imageDataUrl);
      onImageSelected(canvas);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process image';
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="w-full aspect-[4/3] bg-base-300 rounded-lg border-2 border-dashed border-base-content/20 hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 overflow-hidden"
      >
        {isLoading ? (
          <span className="loading loading-spinner loading-lg"></span>
        ) : preview ? (
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-contain"
          />
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-12 h-12 text-base-content/40"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
              />
            </svg>
            <div className="text-center px-4">
              <p className="text-base-content/60">
                Tap to select an image
              </p>
              <p className="text-sm text-base-content/40">
                or drag and drop
              </p>
            </div>
          </>
        )}
      </div>

      <button
        onClick={handleClick}
        disabled={isLoading}
        className="btn btn-primary btn-lg"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
          />
        </svg>
        Select Image
      </button>
    </div>
  );
}

/**
 * Read a file as a data URL
 */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert an image data URL to a canvas
 */
function imageToCanvas(imageDataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to create canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageDataUrl;
  });
}
