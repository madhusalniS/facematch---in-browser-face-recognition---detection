/**
 * SettingsModal:
 * - Match threshold slider (0.30 - 0.70)
 * - Detector selector: TinyFaceDetector (fast) vs SSD MobileNet (accurate)
 * - 68-point landmarks toggle
 * - Live webcam target FPS
 * - "Clear all data" button with confirmation prompt
 */

import React, { useState } from 'react';
import {
  X,
  Sliders,
  Cpu,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Check,
} from 'lucide-react';
import { DetectionSettings, DetectorType } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: DetectionSettings;
  onUpdateSettings: (newSettings: DetectionSettings) => void;
  onClearAllData: () => Promise<void>;
  enrolledCount: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearAllData,
  enrolledCount,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  if (!isOpen) return null;

  const handleDetectorChange = (detector: DetectorType) => {
    onUpdateSettings({
      ...settings,
      detector,
    });
  };

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSettings({
      ...settings,
      threshold: parseFloat(e.target.value),
    });
  };

  const handleResetDefaults = () => {
    onUpdateSettings({
      detector: 'tiny',
      threshold: 0.5,
      inputSize: 416,
      minConfidence: 0.5,
      drawLandmarks: false,
      flipWebcam: true,
      targetFps: 5,
    });
  };

  const handleExecuteClear = async () => {
    setIsClearing(true);
    try {
      await onClearAllData();
      setConfirmClear(false);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">
              Detection & Matching Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Setting 1: Match Threshold Slider */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold text-neutral-900 dark:text-white">
                  Match Threshold (Euclidean Distance)
                </label>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Faces with Euclidean distance ≤ threshold are classified as <strong>KNOWN</strong>.
                </p>
              </div>
              <span className="text-sm font-bold font-mono tabular-nums text-neutral-900 dark:text-white px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">
                {settings.threshold.toFixed(2)}
              </span>
            </div>

            <input
              type="range"
              min="0.30"
              max="0.70"
              step="0.02"
              value={settings.threshold}
              onChange={handleThresholdChange}
              className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-neutral-900 dark:accent-neutral-100"
            />

            <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
              <span>0.30 (Strict / High Security)</span>
              <span>0.50 (Recommended)</span>
              <span>0.70 (Permissive)</span>
            </div>
          </div>

          {/* Setting 2: Neural Detector Choice */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-neutral-900 dark:text-white">
              Face Detector Architecture
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleDetectorChange('tiny')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  settings.detector === 'tiny'
                    ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-50 dark:bg-neutral-800'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-neutral-900 dark:text-white">TinyFaceDetector</span>
                  {settings.detector === 'tiny' && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-tight">
                  Fast & lightweight (190KB). Ideal for real-time webcam and smooth 60fps UI.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleDetectorChange('ssd')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  settings.detector === 'ssd'
                    ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-50 dark:bg-neutral-800'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-neutral-900 dark:text-white">SSD MobileNet v1</span>
                  {settings.detector === 'ssd' && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-tight">
                  High accuracy (5.6MB). Superior for small, distant faces in group photos.
                </p>
              </button>
            </div>
          </div>

          {/* Setting 3: Landmark Overlays */}
          <div className="flex items-center justify-between py-2 border-t border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <span className="text-xs font-semibold text-neutral-900 dark:text-white block">
                68-Point Facial Landmarks
              </span>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Overlay facial mesh points (jawline, eyes, nose, lips).
              </span>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, drawLandmarks: !settings.drawLandmarks })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                settings.drawLandmarks ? 'bg-neutral-900 dark:bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.drawLandmarks ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Setting 4: Live Target Sampling Rate */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-neutral-900 dark:text-white">
                Live Webcam Throttle (~FPS)
              </label>
              <span className="text-xs font-mono text-neutral-500">
                {settings.targetFps || 5} FPS
              </span>
            </div>
            <div className="flex gap-2">
              {[3, 5, 8, 12].map((fps) => (
                <button
                  key={fps}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, targetFps: fps })}
                  className={`flex-1 py-1.5 text-xs font-mono font-medium rounded-lg border transition-colors ${
                    (settings.targetFps || 5) === fps
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-transparent'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {fps} fps
                </button>
              ))}
            </div>
          </div>

          {/* Danger Zone: Clear All Data */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-red-600 dark:text-red-400 block">
                  Enrolled Biometric Storage
                </span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Currently {enrolledCount} {enrolledCount === 1 ? 'person' : 'people'} saved in IndexedDB.
                </span>
              </div>

              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  disabled={enrolledCount === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Data</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2.5 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteClear}
                    disabled={isClearing}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs"
                  >
                    <span>Confirm Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
