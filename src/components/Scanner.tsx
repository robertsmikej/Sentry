import { useState } from 'react';
import { Camera } from './Camera';
import { ImageUpload } from './ImageUpload';
import { ImageCropper } from './ImageCropper';
import { PerspectiveCropper } from './PerspectiveCropper';
import { ResultCard } from './ResultCard';
import { PlateEditor } from './PlateEditor';
import { useOCR } from '../hooks/useOCR';
import { useLookup } from '../hooks/useLookup';
import { useHistory } from '../hooks/useHistory';
import { useVibration } from '../hooks/useVibration';
import type { LookupEntry } from '../types';
import type { Corners } from '../services/perspective';

// Set to true to show the preprocessed OCR image below results for debugging
const SHOW_DEBUG_PREPROCESSED_IMAGE = true;

// Default input mode: 'camera' or 'upload'
const DEFAULT_INPUT_MODE: InputMode = 'upload';

// Whether to auto-start the camera when camera mode is active
// Set to false to require user to manually start camera (saves battery/privacy)
const CAMERA_AUTO_START = false;

type InputMode = 'camera' | 'upload';
type ScanState = 'idle' | 'cropping' | 'perspective' | 'processing' | 'result' | 'editing';

interface ScanResult {
  extractedText: string;
  normalizedText: string;
  confidence: number;
  matched: boolean;
  matchedEntry?: LookupEntry;
}

export function Scanner() {
  const [inputMode, setInputMode] = useState<InputMode>(DEFAULT_INPUT_MODE);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [preprocessedImage, setPreprocessedImage] = useState<string | null>(null);
  // Store the cropped image before perspective transform so user can re-adjust
  const [prePerspectiveImage, setPrePerspectiveImage] = useState<string | null>(null);
  // Store the last used corner positions for re-adjustment
  const [lastUsedCorners, setLastUsedCorners] = useState<Corners | null>(null);

  const { isProcessing, progress, processImage } = useOCR();
  const { lookup, upsertPlate, incrementSeen } = useLookup();
  const { addEntry } = useHistory();
  const { vibrateSuccess, vibrateError, vibrate } = useVibration();

  // Called when camera captures or image is uploaded - go to perspective mode by default
  const handleImageCaptured = (canvas: HTMLCanvasElement) => {
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageDataUrl);
    setPrePerspectiveImage(imageDataUrl); // Store original for re-adjustment
    setScanState('perspective');
  };

  // Called when user confirms crop - process the cropped image
  const handleCropComplete = async (canvas: HTMLCanvasElement) => {
    setScanState('processing');
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageDataUrl); // Update to cropped version

    const ocrResult = await processImage(canvas);

    if (ocrResult) {
      // Store preprocessed image for debugging
      if (ocrResult.preprocessedImageUrl) {
        setPreprocessedImage(ocrResult.preprocessedImageUrl);
      }

      let matchedEntry = await lookup(ocrResult.normalized);
      const matched = !!matchedEntry;

      // Auto-increment seen count for known plates
      if (matched && matchedEntry) {
        matchedEntry = await incrementSeen(matchedEntry.code) || matchedEntry;
      }

      const scanResult: ScanResult = {
        extractedText: ocrResult.raw,
        normalizedText: ocrResult.normalized,
        confidence: ocrResult.confidence,
        matched,
        matchedEntry,
      };

      setResult(scanResult);
      setScanState('result');

      // Haptic feedback based on experience
      if (matched) {
        if (matchedEntry?.experience === 'bad') {
          vibrate([100, 50, 100, 50, 100]); // Warning pattern
        } else {
          vibrateSuccess();
        }
      } else {
        vibrateError();
      }

      // Save to history
      await addEntry({
        extractedText: ocrResult.raw,
        normalizedText: ocrResult.normalized,
        matched,
        matchedEntry,
        imageDataUrl,
      });
    } else {
      setScanState('idle');
    }
  };

  const handleScanAgain = () => {
    setScanState('idle');
    setResult(null);
    setCapturedImage(null);
    setPreprocessedImage(null);
    setPrePerspectiveImage(null);
    setLastUsedCorners(null);
  };

  const handleEditPlate = () => {
    setScanState('editing');
  };

  const handleSavePlate = async (entry: LookupEntry) => {
    await upsertPlate(entry);

    // Update result with new entry data
    if (result) {
      setResult({
        ...result,
        matched: true,
        matchedEntry: entry,
      });
    }

    vibrateSuccess();
    setScanState('result');
  };

  const handleCancelEdit = () => {
    setScanState('result');
  };

  const handleCropCancel = () => {
    setScanState('idle');
    setCapturedImage(null);
    setPreprocessedImage(null);
  };

  // Go to perspective correction mode with current cropped image
  const handlePerspectiveMode = (canvas: HTMLCanvasElement) => {
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageDataUrl);
    setPrePerspectiveImage(imageDataUrl); // Store for re-adjustment
    setScanState('perspective');
  };

  // Go back to perspective mode to re-adjust (from result screen)
  const handleAdjustPerspective = () => {
    if (prePerspectiveImage) {
      setCapturedImage(prePerspectiveImage);
      setScanState('perspective');
    }
  };

  // Called when perspective correction is complete
  const handlePerspectiveComplete = async (canvas: HTMLCanvasElement, corners: Corners) => {
    // Store the corners used so we can restore them on re-adjustment
    setLastUsedCorners(corners);
    setScanState('processing');
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageDataUrl);

    const ocrResult = await processImage(canvas);

    if (ocrResult) {
      if (ocrResult.preprocessedImageUrl) {
        setPreprocessedImage(ocrResult.preprocessedImageUrl);
      }

      let matchedEntry = await lookup(ocrResult.normalized);
      const matched = !!matchedEntry;

      if (matched && matchedEntry) {
        matchedEntry = await incrementSeen(matchedEntry.code) || matchedEntry;
      }

      const scanResult: ScanResult = {
        extractedText: ocrResult.raw,
        normalizedText: ocrResult.normalized,
        confidence: ocrResult.confidence,
        matched,
        matchedEntry,
      };

      setResult(scanResult);
      setScanState('result');

      if (matched) {
        if (matchedEntry?.experience === 'bad') {
          vibrate([100, 50, 100, 50, 100]);
        } else {
          vibrateSuccess();
        }
      } else {
        vibrateError();
      }

      await addEntry({
        extractedText: ocrResult.raw,
        normalizedText: ocrResult.normalized,
        matched,
        matchedEntry,
        imageDataUrl,
      });
    } else {
      setScanState('idle');
    }
  };

  const handlePerspectiveCancel = () => {
    // Go back to idle state
    setScanState('idle');
    setCapturedImage(null);
    setPrePerspectiveImage(null);
  };

  // Switch from perspective mode to simple crop mode
  const handleSwitchToSimpleCrop = () => {
    setScanState('cropping');
  };

  const handlePlateChange = async (newPlate: string) => {
    if (result) {
      // Check database for match with the new plate number
      const matchedEntry = await lookup(newPlate);
      const matched = !!matchedEntry;

      setResult({
        ...result,
        normalizedText: newPlate,
        matched,
        matchedEntry,
      });
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      {scanState === 'idle' && (
        <>
          <div className="tabs tabs-boxed">
            <button
              className={`tab ${inputMode === 'camera' ? 'tab-active' : ''}`}
              onClick={() => setInputMode('camera')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
              Camera
            </button>
            <button
              className={`tab ${inputMode === 'upload' ? 'tab-active' : ''}`}
              onClick={() => setInputMode('upload')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              Upload
            </button>
          </div>

          {inputMode === 'camera' ? (
            <Camera onCapture={handleImageCaptured} autoStart={CAMERA_AUTO_START} />
          ) : (
            <ImageUpload onImageSelected={handleImageCaptured} />
          )}
        </>
      )}

      {scanState === 'cropping' && capturedImage && (
        <ImageCropper
          imageDataUrl={capturedImage}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          onPerspective={handlePerspectiveMode}
        />
      )}

      {scanState === 'perspective' && capturedImage && (
        <PerspectiveCropper
          imageDataUrl={capturedImage}
          onComplete={handlePerspectiveComplete}
          onCancel={handlePerspectiveCancel}
          onSimpleCrop={handleSwitchToSimpleCrop}
          initialCorners={lastUsedCorners ?? undefined}
        />
      )}

      {scanState === 'processing' && (
        <div className="flex flex-col items-center gap-4 p-8">
          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full max-w-md rounded-lg opacity-50"
            />
          )}
          <div className="flex flex-col items-center gap-2">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="text-base-content/60">Processing image...</p>
            {isProcessing && progress > 0 && (
              <progress
                className="progress progress-primary w-56"
                value={progress * 100}
                max="100"
              ></progress>
            )}
          </div>
        </div>
      )}

      {scanState === 'result' && result && (
        <>
          <ResultCard
            normalizedText={result.normalizedText}
            matched={result.matched}
            matchedEntry={result.matchedEntry}
            onScanAgain={handleScanAgain}
            onEdit={handleEditPlate}
            onPlateChange={handlePlateChange}
            onAdjustPerspective={prePerspectiveImage ? handleAdjustPerspective : undefined}
          />

          {/* Debug images container */}
          {(capturedImage || (SHOW_DEBUG_PREPROCESSED_IMAGE && preprocessedImage)) && (
            <div className="w-full max-w-md bg-base-200 rounded-lg p-4 flex flex-col gap-4">
              {capturedImage && (
                <div>
                  <p className="text-xs text-base-content/40 mb-2 text-center">Cropped Image</p>
                  <img
                    src={capturedImage}
                    alt="Cropped plate"
                    className="w-full rounded-lg"
                  />
                </div>
              )}

              {SHOW_DEBUG_PREPROCESSED_IMAGE && preprocessedImage && (
                <div>
                  <p className="text-xs text-base-content/40 mb-2 text-center">
                    Preprocessed OCR Image (debug)
                  </p>
                  <img
                    src={preprocessedImage}
                    alt="Preprocessed for OCR"
                    className="w-full rounded-lg"
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {scanState === 'editing' && result && (
        <PlateEditor
          plate={result.matchedEntry}
          plateCode={result.normalizedText}
          onSave={handleSavePlate}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
}
