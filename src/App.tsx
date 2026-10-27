/**
 * FaceMatch: Client-side Biometric Face Recognition & Detection Single Page App
 * Powered by 128-D Face Embeddings, 68-Point Facial Landmarks, and IndexedDB.
 */

import React, { useState, useEffect } from 'react';
import { Header, ActiveTab } from './components/Header';
import { PrivacyBanner } from './components/PrivacyBanner';
import { EnrollTab } from './components/EnrollTab';
import { RecognizeTab } from './components/RecognizeTab';
import { LiveWebcamTab } from './components/LiveWebcamTab';
import { SettingsModal } from './components/SettingsModal';
import { HowItWorksModal } from './components/HowItWorksModal';
import {
  EnrolledPerson,
  DetectionSettings,
  ModelLoadStatus,
} from './types';
import {
  getAllPeople,
  addPerson,
  deletePerson,
  clearAllPeople,
} from './services/db';
import { loadFaceModels } from './services/faceDetection';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('recognize');
  const [enrolledPeople, setEnrolledPeople] = useState<EnrolledPerson[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(true);

  // Dark mode state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('facematch_dark_mode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Settings state
  const [settings, setSettings] = useState<DetectionSettings>(() => {
    const defaultSettings: DetectionSettings = {
      detector: 'tiny',
      threshold: 0.5,
      inputSize: 416,
      minConfidence: 0.45,
      drawLandmarks: false,
      flipWebcam: true,
      targetFps: 5,
    };
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('facematch_settings');
        if (saved) return { ...defaultSettings, ...JSON.parse(saved) };
      } catch {
        // fallback
      }
    }
    return defaultSettings;
  });

  // Model loading state
  const [modelStatus, setModelStatus] = useState<ModelLoadStatus>({
    loaded: false,
    loading: true,
    error: null,
    detectorName: settings.detector,
    progressMessage: 'Initializing neural network weights...',
  });

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

  // Sync dark mode class with DOM
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('facematch_dark_mode', String(darkMode));
  }, [darkMode]);

  // Load enrolled people from IndexedDB on startup
  useEffect(() => {
    async function fetchEnrolled() {
      try {
        const people = await getAllPeople();
        setEnrolledPeople(people);
      } catch (err) {
        console.error('Failed to load from IndexedDB:', err);
      } finally {
        setIsDbLoading(false);
      }
    }
    fetchEnrolled();
  }, []);

  // Pre-load facial models on startup or when detector changes
  useEffect(() => {
    let isCancelled = false;

    async function initModels() {
      setModelStatus((prev) => ({
        ...prev,
        loading: true,
        error: null,
        detectorName: settings.detector,
        progressMessage: `Loading ${settings.detector === 'tiny' ? 'TinyFace' : 'SSD MobileNet'} & 128-D models...`,
      }));

      try {
        await loadFaceModels(settings.detector, (msg) => {
          if (!isCancelled) {
            setModelStatus((prev) => ({ ...prev, progressMessage: msg }));
          }
        });

        if (!isCancelled) {
          setModelStatus((prev) => ({
            ...prev,
            loaded: true,
            loading: false,
            error: null,
          }));
        }
      } catch (err: any) {
        console.error('Failed to load face models:', err);
        if (!isCancelled) {
          setModelStatus((prev) => ({
            ...prev,
            loaded: false,
            loading: false,
            error: err.message || 'Failed to download facial models.',
          }));
        }
      }
    }

    initModels();

    return () => {
      isCancelled = true;
    };
  }, [settings.detector]);

  // Database handlers
  const handleEnrollPerson = async (newPersonData: Omit<EnrolledPerson, 'id' | 'createdAt'>) => {
    const saved = await addPerson(newPersonData);
    setEnrolledPeople((prev) => [saved, ...prev]);
  };

  const handleDeletePerson = async (id: string) => {
    await deletePerson(id);
    setEnrolledPeople((prev) => prev.filter((p) => p.id !== id));
  };

  const handleClearAllData = async () => {
    await clearAllPeople();
    setEnrolledPeople([]);
  };

  const handleUpdateSettings = (newSettings: DetectionSettings) => {
    setSettings(newSettings);
    localStorage.setItem('facematch_settings', JSON.stringify(newSettings));
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors selection:bg-neutral-900 selection:text-white dark:selection:bg-white dark:selection:text-neutral-900">
      
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        enrolledCount={enrolledPeople.length}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        modelsLoaded={modelStatus.loaded}
        modelDetector={settings.detector}
      />

      {/* Local Processing Privacy Notice */}
      <PrivacyBanner />

      {/* Model Loading State Banner (if active) */}
      {modelStatus.loading && (
        <div className="bg-neutral-900 text-white px-4 py-2 text-xs flex items-center justify-center gap-2 border-b border-neutral-800">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          <span>{modelStatus.progressMessage}</span>
        </div>
      )}

      {/* Model Load Error Banner (if any) */}
      {modelStatus.error && (
        <div className="bg-red-500 text-white px-4 py-2.5 text-xs flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Error loading models: {modelStatus.error}</span>
          <button
            type="button"
            onClick={() => loadFaceModels(settings.detector)}
            className="underline ml-2 font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="flex-1">
        {activeTab === 'enroll' && (
          <EnrollTab
            enrolledPeople={enrolledPeople}
            onEnrollPerson={handleEnrollPerson}
            onDeletePerson={handleDeletePerson}
            detector={settings.detector}
            isModelReady={modelStatus.loaded}
          />
        )}

        {activeTab === 'recognize' && (
          <RecognizeTab
            enrolledPeople={enrolledPeople}
            settings={settings}
            onOpenSettings={() => setIsSettingsOpen(true)}
            isModelReady={modelStatus.loaded}
          />
        )}

        {activeTab === 'live' && (
          <LiveWebcamTab
            enrolledPeople={enrolledPeople}
            settings={settings}
            onOpenSettings={() => setIsSettingsOpen(true)}
            isModelReady={modelStatus.loaded}
          />
        )}
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClearAllData={handleClearAllData}
        enrolledCount={enrolledPeople.length}
      />

      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
      />

      {/* Minimal Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800/80 py-4 px-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>FaceMatch</span>
            <span aria-hidden="true">·</span>
            <span>Client-side 128-D Biometric Recognition</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Local IndexedDB</span>
          </div>
          <div>
            <span>Threshold: {settings.threshold.toFixed(2)}</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setIsHowItWorksOpen(true)}
              className="hover:text-neutral-700 dark:hover:text-neutral-300 underline underline-offset-2"
            >
              How It Works
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
