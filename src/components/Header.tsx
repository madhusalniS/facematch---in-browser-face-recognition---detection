/**
 * Top Navigation Header adhering to the 3-zone contract:
 * [Wordmark Brand] — [3 Tab Navigation] — [Action Controls]
 */

import React from 'react';
import { ScanFace, UserPlus, Image as ImageIcon, Video, Settings, HelpCircle, Moon, Sun } from 'lucide-react';

export type ActiveTab = 'enroll' | 'recognize' | 'live';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  enrolledCount: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenSettings: () => void;
  onOpenHowItWorks: () => void;
  modelsLoaded: boolean;
  modelDetector: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  enrolledCount,
  darkMode,
  onToggleDarkMode,
  onOpenSettings,
  onOpenHowItWorks,
  modelsLoaded,
  modelDetector,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 md:gap-8">
        
        {/* Zone 1: Wordmark Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center text-white dark:text-neutral-900">
            <ScanFace className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-neutral-900 dark:text-white leading-none">
              FaceMatch
            </span>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
              128-D Biometric Engine
            </span>
          </div>
        </div>

        {/* Zone 2: 3 Clean Tab Controls */}
        <nav className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-lg">
          <button
            type="button"
            onClick={() => onTabChange('enroll')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'enroll'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-semibold'
                : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Enroll People</span>
            {enrolledCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-mono rounded bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200">
                {enrolledCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('recognize')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'recognize'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-semibold'
                : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Recognize Image</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('live')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'live'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-semibold'
                : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Live Webcam</span>
          </button>
        </nav>

        {/* Zone 3: Primary Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenHowItWorks}
            title="How FaceMatch Works"
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="How it works"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            title="Detection Settings & Thresholds"
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-700" />}
          </button>
        </div>

      </div>
    </header>
  );
};
