import { useState, useEffect } from 'react';
import {
  generateShareUrl,
  generateQRCode,
  canShare,
  shareUrl,
  type ShareableConfig,
} from '../services/sharing';

interface ShareModalProps {
  config: ShareableConfig;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ config, isOpen, onClose }: ShareModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [shareUrlText, setShareUrlText] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen && config.sheetUrl) {
      setIsGenerating(true);
      const url = generateShareUrl(config);
      setShareUrlText(url);

      generateQRCode(url)
        .then((dataUrl) => {
          setQrCodeUrl(dataUrl);
        })
        .catch((err) => {
          console.error('Failed to generate QR code:', err);
        })
        .finally(() => {
          setIsGenerating(false);
        });
    }
  }, [isOpen, config]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrlText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrlText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    await shareUrl(shareUrlText, config.name ? `Join ${config.name}` : undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
            />
          </svg>
          Share Database
        </h3>

        <p className="text-sm text-base-content/70 mt-2">
          Let others join your watchlist by scanning this QR code or clicking the link.
        </p>

        {/* Warning about write access */}
        {config.writeUrl && (
          <div className="alert alert-warning mt-3 py-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="stroke-current shrink-0 w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-xs">
              Anyone with this link can add and edit plates in your database.
              Only share with people you trust.
            </span>
          </div>
        )}

        {/* QR Code */}
        <div className="flex justify-center my-6">
          {isGenerating ? (
            <div className="w-64 h-64 flex items-center justify-center bg-base-200 rounded-lg">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : qrCodeUrl ? (
            <img
              src={qrCodeUrl}
              alt="Share QR Code"
              className="w-64 h-64 rounded-lg shadow-md bg-white p-2"
            />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center bg-base-200 rounded-lg text-base-content/50">
              Failed to generate QR code
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleCopyLink}
            className={`btn w-full ${copied ? 'btn-success' : 'btn-outline'}`}
          >
            {copied ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
                Link Copied!
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
                  />
                </svg>
                Copy Link
              </>
            )}
          </button>

          {canShare() && (
            <button onClick={handleShare} className="btn btn-primary w-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
                />
              </svg>
              Share via...
            </button>
          )}
        </div>

        {/* URL Preview (truncated) */}
        <div className="mt-4 p-2 bg-base-200 rounded-lg">
          <p className="text-xs text-base-content/50 font-mono truncate">
            {shareUrlText}
          </p>
        </div>

        <div className="modal-action">
          <button onClick={onClose} className="btn">
            Close
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
