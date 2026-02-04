import { useState } from 'react'
import { DEFAULT_SHEET_URL, DEFAULT_WRITE_URL } from '../constants/app'

interface SetupModalProps {
  isOpen: boolean
  onClose: () => void
  onUseSharedDatabase: () => void
  onGoToSettings: () => void
}

export function SetupModal({ isOpen, onClose, onUseSharedDatabase, onGoToSettings }: SetupModalProps) {
  const [step, setStep] = useState<'welcome' | 'database' | 'ai'>('welcome')

  if (!isOpen) return null

  const handleUseShared = () => {
    onUseSharedDatabase()
    setStep('ai')
  }

  const handleSetupOwn = () => {
    onGoToSettings()
    onClose()
  }

  const handleSkipAI = () => {
    onClose()
  }

  const handleSetupAI = () => {
    onGoToSettings()
    onClose()
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md">
        {step === 'welcome' && (
          <>
            <h3 className="font-bold text-xl mb-2">Welcome to Sentry!</h3>
            <p className="text-base-content/70 mb-4">
              Sentry helps you scan and track license plates. Before you start, let's get you set up.
            </p>

            <div className="bg-base-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold mb-2">What you'll need:</h4>
              <ul className="text-sm space-y-2 text-base-content/70">
                <li className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-primary mt-0.5 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span><strong>Database connection</strong> - Store your plate data in Google Sheets (required)</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-base-content/40 mt-0.5 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span><strong>Gemini AI key</strong> - For better plate recognition (optional)</span>
                </li>
              </ul>
            </div>

            <div className="modal-action">
              <button onClick={() => setStep('database')} className="btn btn-primary w-full">
                Let's Get Started
              </button>
            </div>
          </>
        )}

        {step === 'database' && (
          <>
            <h3 className="font-bold text-xl mb-2">Choose Your Database</h3>
            <p className="text-base-content/70 mb-4">
              Your scanned plates need somewhere to be stored. Choose an option:
            </p>

            {/* Option 1: Shared Database */}
            {DEFAULT_SHEET_URL && DEFAULT_WRITE_URL && (
              <div className="card bg-primary/10 border-2 border-primary mb-3">
                <div className="card-body p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-primary/20">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-primary">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">Use Shared Community Database</h4>
                      <p className="text-sm text-base-content/60 mt-1">
                        Join a shared database with other users. Your scans contribute to a community watchlist. Great for neighborhoods!
                      </p>
                      <span className="badge badge-primary badge-sm mt-2">Recommended for quick start</span>
                    </div>
                  </div>
                  <button onClick={handleUseShared} className="btn btn-primary btn-sm mt-3">
                    Use Shared Database
                  </button>
                </div>
              </div>
            )}

            {/* Option 2: Own Database */}
            <div className="card bg-base-200 border border-base-300">
              <div className="card-body p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-base-300">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Set Up Your Own Database</h4>
                    <p className="text-sm text-base-content/60 mt-1">
                      Create your own private Google Sheet. You control your data completely.
                    </p>
                  </div>
                </div>
                <button onClick={handleSetupOwn} className="btn btn-ghost btn-sm mt-3">
                  Go to Settings
                </button>
              </div>
            </div>

            <div className="modal-action mt-4">
              <button onClick={() => setStep('welcome')} className="btn btn-ghost btn-sm">
                Back
              </button>
            </div>
          </>
        )}

        {step === 'ai' && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-success">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <h3 className="font-bold text-xl">Database Connected!</h3>
            </div>
            <p className="text-base-content/70 mb-4">
              You're connected to the shared community database. Now let's talk about plate recognition.
            </p>

            <div className="bg-base-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold mb-2">Recognition Options</h4>

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-mono bg-base-300 px-2 py-0.5 rounded text-xs">Default</span>
                  <div>
                    <strong>Local OCR</strong>
                    <p className="text-base-content/60">Works offline, good for clear plates. No setup needed.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="font-mono bg-primary/20 text-primary px-2 py-0.5 rounded text-xs">Better</span>
                  <div>
                    <strong>Gemini AI</strong>
                    <p className="text-base-content/60">Much better accuracy, especially for angled or blurry plates. Requires free API key from Google.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="alert alert-info text-sm mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>You can set up Gemini AI later in Settings if you want better recognition.</span>
            </div>

            <div className="modal-action flex-col gap-2">
              <button onClick={handleSetupAI} className="btn btn-primary w-full">
                Set Up Gemini AI Now
              </button>
              <button onClick={handleSkipAI} className="btn btn-ghost w-full">
                Skip for Now - Use Local OCR
              </button>
            </div>
          </>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  )
}
