import { useState, useEffect, useCallback } from 'react';
import { Scanner } from './components/Scanner';
import { History } from './components/History';
import { Settings } from './components/Settings';
import { SyncStatus } from './components/SyncStatus';
import { useAutoSync } from './hooks/useAutoSync';

type Tab = 'scan' | 'history' | 'settings';

const THEME_STORAGE_KEY = 'plate-reader-theme';
const DRAWER_ID = 'main-drawer';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('scan');
  const [autoSyncMessage, setAutoSyncMessage] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark';
  });

  // Auto-sync callbacks
  const handleAutoSyncComplete = useCallback((count: number) => {
    setAutoSyncMessage(`Auto-synced ${count} plate${count !== 1 ? 's' : ''} to Google Sheets`);
    setTimeout(() => setAutoSyncMessage(null), 3000);
  }, []);

  const handleAutoSyncError = useCallback((error: string) => {
    console.error('Auto-sync error:', error);
  }, []);

  useAutoSync({
    onSyncComplete: handleAutoSyncComplete,
    onSyncError: handleAutoSyncError,
  });

  // Apply theme when it changes
  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [isDarkMode]);

  const closeDrawer = () => {
    const checkbox = document.getElementById(DRAWER_ID) as HTMLInputElement;
    if (checkbox) checkbox.checked = false;
  };

  const handleNavClick = (tab: Tab) => {
    setActiveTab(tab);
    closeDrawer();
  };

  return (
    <div className="drawer">
      <input id={DRAWER_ID} type="checkbox" className="drawer-toggle" />

      {/* Main Page Content */}
      <div className="drawer-content flex flex-col min-h-screen">
        {/* Header */}
        <header className="navbar bg-base-200 px-4 shadow-sm sticky top-0 z-40">
          <div className="flex-none">
            <label htmlFor={DRAWER_ID} className="btn btn-ghost btn-circle btn-sm drawer-button">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </label>
          </div>
          <div className="flex-1 ml-2">
            <h1 className="text-lg font-bold">Plate Reader</h1>
          </div>
          <div className="flex-none">
            <SyncStatus />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {activeTab === 'scan' && <Scanner />}
          {activeTab === 'history' && <History />}
          {activeTab === 'settings' && <Settings />}
        </main>

        {/* Auto-sync Toast */}
        {autoSyncMessage && (
          <div className="toast toast-top toast-center z-50">
            <div className="alert alert-success">
              <span>{autoSyncMessage}</span>
            </div>
          </div>
        )}
      </div>

      {/* Slide-out Drawer */}
      <div className="drawer-side z-50">
        <label htmlFor={DRAWER_ID} aria-label="close sidebar" className="drawer-overlay"></label>
        <div className="menu bg-base-200 min-h-full w-72 p-4">
          {/* Drawer Header */}
          <div className="flex items-center justify-between mb-6 px-2">
            <h2 className="text-xl font-bold">Menu</h2>
            <label htmlFor={DRAWER_ID} className="btn btn-ghost btn-circle btn-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </label>
          </div>

          {/* Navigation */}
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => handleNavClick('scan')}
                className={`flex items-center gap-3 w-full ${activeTab === 'scan' ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                Scan Plate
              </button>
            </li>
            <li>
              <button
                onClick={() => handleNavClick('history')}
                className={`flex items-center gap-3 w-full ${activeTab === 'history' ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                History
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
            <h3 className="text-sm font-semibold text-base-content/70 mb-3">Appearance</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setIsDarkMode(false)}
                className={`btn btn-sm justify-start gap-3 ${!isDarkMode ? 'btn-primary' : 'btn-ghost'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
                Light Mode
              </button>
              <button
                onClick={() => setIsDarkMode(true)}
                className={`btn btn-sm justify-start gap-3 ${isDarkMode ? 'btn-primary' : 'btn-ghost'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
                Dark Mode
              </button>
              <p className="text-xs text-base-content/50 mt-1 px-1">
                Tip: Dark mode saves battery on OLED screens
              </p>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Footer */}
          <div className="mt-auto pt-4 border-t border-base-300">
            <p className="text-xs text-base-content/50 text-center">
              Plate Reader PWA
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
