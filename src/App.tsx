import { useState, useEffect, useCallback, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { Scanner } from './components/Scanner';
import { Settings } from './components/Settings';
import { EncounterList } from './components/EncounterList';
import { PlateList } from './components/PlateList';
import { SyncStatus } from './components/SyncStatus';
import { JoinModal } from './components/JoinModal';
import { useAutoSync } from './hooks/useAutoSync';
import { useOfflinePrep } from './hooks/useOfflinePrep';
import { getJoinConfigFromUrl, type ShareableConfig } from './services/sharing';
import { APP_NAME, APP_TAGLINE } from './constants/app';

type Tab = 'home' | 'scan' | 'plates' | 'encounters' | 'settings';

const THEME_STORAGE_KEY = 'plate-reader-theme';
const BANNER_DISMISSED_KEY = 'plate-reader-banner-dismissed';
const DRAWER_ID = 'main-drawer';
const VALID_TABS: Tab[] = ['home', 'scan', 'plates', 'encounters', 'settings'];
const GITHUB_URL = 'https://github.com/robertsmikej/Sentry';

// Get initial tab from URL hash
function getInitialTab(): Tab {
  const hash = window.location.hash.slice(1); // Remove the '#'
  if (VALID_TABS.includes(hash as Tab)) {
    return hash as Tab;
  }
  return 'home';
}

// Detect if device likely has a camera (mobile/tablet)
function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches);
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab);
  const [autoSyncMessage, setAutoSyncMessage] = useState<string | null>(null);
  const [startWithManualEntry, setStartWithManualEntry] = useState(false);
  const [startWithCamera, setStartWithCamera] = useState(false);
  const [startWithUpload, setStartWithUpload] = useState(false);
  const [isMobile] = useState(() => isMobileDevice());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark';
  });
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    return localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
  });

  const dismissBanner = () => {
    setBannerDismissed(true);
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
  };

  // Join modal state (for shared database links)
  const [joinConfig, setJoinConfig] = useState<ShareableConfig | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Check for join URL on mount
  useEffect(() => {
    const config = getJoinConfigFromUrl();
    if (config) {
      setJoinConfig(config);
      setShowJoinModal(true);
    }
  }, []);

  const handleJoinComplete = useCallback(() => {
    setShowJoinModal(false);
    setJoinConfig(null);
    setAutoSyncMessage('Successfully joined shared database!');
    setTimeout(() => setAutoSyncMessage(null), 3000);
  }, []);

  // Auto-sync callbacks
  const handleAutoSyncComplete = useCallback((count: number) => {
    setAutoSyncMessage(`Auto-synced ${count} plate${count !== 1 ? 's' : ''} to Google Sheets`);
    setTimeout(() => setAutoSyncMessage(null), 3000);
  }, []);

  const handleAutoSyncError = useCallback((error: string) => {
    console.error('Auto-sync error:', error);
  }, []);

  const handleInitialSyncComplete = useCallback(() => {
    setAutoSyncMessage('Data synced from Google Sheets');
    setTimeout(() => setAutoSyncMessage(null), 3000);
  }, []);

  const handleInitialSyncError = useCallback((error: string) => {
    console.error('Initial sync error:', error);
  }, []);

  useAutoSync({
    onSyncComplete: handleAutoSyncComplete,
    onSyncError: handleAutoSyncError,
    onInitialSyncComplete: handleInitialSyncComplete,
    onInitialSyncError: handleInitialSyncError,
  });

  // Auto-download Tesseract.js files for offline use on first load
  useOfflinePrep();

  // Apply theme when it changes
  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [isDarkMode]);

  const mainContentRef = useRef<HTMLElement>(null);

  // History API navigation for native back/forward support (including iOS edge swipe)
  const isHistoryNavigation = useRef(false);

  // Push to history when tab changes (unless it's from popstate)
  useEffect(() => {
    if (isHistoryNavigation.current) {
      isHistoryNavigation.current = false;
      return;
    }
    // Push new state to history - keep URL clean for home tab
    const url = activeTab === 'home' ? window.location.pathname : `#${activeTab}`;
    window.history.pushState({ tab: activeTab }, '', url);
  }, [activeTab]);

  // Listen for popstate (back/forward navigation)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.tab) {
        isHistoryNavigation.current = true;
        setActiveTab(event.state.tab as Tab);
        mainContentRef.current?.scrollTo({ top: 0 });
      }
    };

    // Initialize history state on mount - keep URL clean for home tab
    const initialUrl = activeTab === 'home' ? window.location.pathname : `#${activeTab}`;
    window.history.replaceState({ tab: activeTab }, '', initialUrl);

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const closeDrawer = () => {
    const checkbox = document.getElementById(DRAWER_ID) as HTMLInputElement;
    if (checkbox) checkbox.checked = false;
  };

  const scrollToTop = () => {
    mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavClick = (tab: Tab) => {
    setActiveTab(tab);
    closeDrawer();
    scrollToTop();
  };

  return (
    <div className="drawer">
      <input id={DRAWER_ID} type="checkbox" className="drawer-toggle" />

      {/* Main Page Content */}
      <div className="drawer-content flex flex-col min-h-screen">
        {/* Self-host Banner */}
        {!bannerDismissed && (
          <div className="text-white text-xs py-1 px-3 flex items-center justify-between" style={{ backgroundColor: '#132F45' }}>
            <span className="flex-1 text-center">
              Self-host this app free —{' '}
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-white/80">
                GitHub
              </a>
            </span>
            <button onClick={dismissBanner} className="btn btn-ghost btn-xs btn-circle p-0 min-h-0 h-5 w-5 text-white hover:bg-white/20" aria-label="Dismiss">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Header */}
        <header className="navbar px-3 shadow-md sticky top-0 z-40 text-white border-b border-[#0099cc]" style={{backgroundColor: '#01B2F0'}}>
          <div className="flex-none">
            <label htmlFor={DRAWER_ID} className="btn btn-ghost btn-circle btn-sm drawer-button text-white hover:bg-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </label>
          </div>
          <div className="flex-1 ml-2 flex items-center">
            <button
              onClick={() => { setActiveTab('home'); scrollToTop(); }}
              className="hover:opacity-80 transition-opacity"
              aria-label="Go to home"
            >
              <img
                src="/logos/sentry_text_tight_padding.png"
                alt={APP_NAME}
                className="h-6 w-auto"
              />
            </button>
          </div>
          <div className="flex-none flex items-center gap-1">
            <SyncStatus />
            {/* Quick camera access - always visible */}
            <button
              onClick={() => {
                if (isMobile) {
                  setStartWithCamera(true);
                  setActiveTab('scan');
                } else {
                  setActiveTab('scan');
                }
                scrollToTop();
              }}
              className="btn btn-ghost btn-circle btn-sm text-white hover:bg-white/20"
              aria-label="Scan plate"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Breadcrumb Bar */}
        <div className="bg-base-200 border-b border-base-300 px-4 py-2">
          <div className="text-sm breadcrumbs">
            <ul>
              <li>
                <button onClick={() => { setActiveTab('home'); scrollToTop(); }} className="flex items-center hover:text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                  </svg>
                </button>
              </li>
              <li>
                <span className="font-medium">
                  {activeTab === 'home' && 'Home'}
                  {activeTab === 'scan' && 'Scan Plate'}
                  {activeTab === 'plates' && 'Plates'}
                  {activeTab === 'encounters' && 'Encounters'}
                  {activeTab === 'settings' && 'Settings'}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Main Content */}
        <main
          ref={mainContentRef}
          className="flex-1 overflow-auto"
        >
          {activeTab === 'home' && (
            <Dashboard
              onNavigate={(tab) => {
                setActiveTab(tab);
                setStartWithManualEntry(false);
                setStartWithCamera(false);
                setStartWithUpload(false);
                scrollToTop();
              }}
              onManualEntry={() => {
                setStartWithManualEntry(true);
                setActiveTab('scan');
                scrollToTop();
              }}
              onScanWithCamera={() => {
                setStartWithCamera(true);
                setActiveTab('scan');
                scrollToTop();
              }}
              onUploadPhoto={() => {
                setStartWithUpload(true);
                setActiveTab('scan');
                scrollToTop();
              }}
            />
          )}
          {activeTab === 'scan' && (
            <Scanner
              startWithManualEntry={startWithManualEntry}
              onManualEntryHandled={() => setStartWithManualEntry(false)}
              startWithCamera={startWithCamera}
              onCameraHandled={() => setStartWithCamera(false)}
              startWithUpload={startWithUpload}
              onUploadHandled={() => setStartWithUpload(false)}
            />
          )}
          {activeTab === 'plates' && <PlateList />}
          {activeTab === 'encounters' && <EncounterList />}
          {activeTab === 'settings' && <Settings />}
        </main>

        {/* Auto-sync Toast */}
        {autoSyncMessage && (
          <div className="toast toast-bottom toast-center z-50">
            <div className="alert alert-success">
              <span>{autoSyncMessage}</span>
            </div>
          </div>
        )}

        {/* Join Modal (for shared database links) */}
        {joinConfig && (
          <JoinModal
            config={joinConfig}
            isOpen={showJoinModal}
            onClose={() => {
              setShowJoinModal(false);
              setJoinConfig(null);
            }}
            onJoined={handleJoinComplete}
          />
        )}
      </div>

      {/* Slide-out Drawer */}
      <div className="drawer-side z-50">
        <label htmlFor={DRAWER_ID} aria-label="close sidebar" className="drawer-overlay"></label>
        <div className="menu bg-base-200 min-h-full w-72 p-0">
          {/* Drawer Header */}
          <div className="p-4 text-white border-b border-[#0a1f2e]" style={{backgroundColor: '#132F45'}}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src="/logos/sentry_logo_tight_padding.png"
                  alt=""
                  className="w-8 h-8"
                />
                <h2 className="text-xl font-bold tracking-wide">{APP_NAME}</h2>
              </div>
              <label htmlFor={DRAWER_ID} className="btn btn-ghost btn-circle btn-sm text-white hover:bg-white/20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </label>
            </div>
            <p className="text-sm text-white/70 mt-1">{APP_TAGLINE}</p>
          </div>

          <div className="p-4">

          {/* Navigation */}
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => handleNavClick('home')}
                className={`flex items-center gap-3 w-full ${activeTab === 'home' ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
                Home
              </button>
            </li>
            <li>
              <button
                onClick={() => handleNavClick('scan')}
                className={`flex items-center gap-3 w-full ${activeTab === 'scan' ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                Scan
              </button>
            </li>
            <li>
              <button
                onClick={() => handleNavClick('plates')}
                className={`flex items-center gap-3 w-full ${activeTab === 'plates' ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                </svg>
                Plates
              </button>
            </li>
            <li>
              <button
                onClick={() => handleNavClick('encounters')}
                className={`flex items-center gap-3 w-full ${activeTab === 'encounters' ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                Encounters
              </button>
            </li>
            <li>
              <button
                onClick={() => handleNavClick('settings')}
                className={`flex items-center gap-3 w-full ${activeTab === 'settings' ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                Settings
              </button>
            </li>
          </ul>

          {/* Divider */}
          <div className="divider my-4"></div>

          {/* Theme Toggle */}
          <div className="px-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-base-content/70">Theme</span>
              <div className="flex bg-base-300 rounded-lg p-1">
                <button
                  onClick={() => setIsDarkMode(false)}
                  className={`btn btn-xs btn-circle ${!isDarkMode ? 'btn-primary' : 'btn-ghost'}`}
                  aria-label="Light mode"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                  </svg>
                </button>
                <button
                  onClick={() => setIsDarkMode(true)}
                  className={`btn btn-xs btn-circle ${isDarkMode ? 'btn-primary' : 'btn-ghost'}`}
                  aria-label="Dark mode"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Footer */}
          <div className="mt-auto pt-4 border-t border-base-300">
            <p className="text-xs text-base-content/50 text-center">
              {APP_NAME}
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
