/**
 * LiveWebcamTab: Real-time client-side face recognition over live webcam video feed (~5 fps).
 * Overlays real-time bounding boxes (Green for Known, Red for Unknown) with live telemetry.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Camera,
  Play,
  Square,
  AlertCircle,
  Users,
  Sliders,
  FlipHorizontal,
  Layers,
  HelpCircle,
} from 'lucide-react';
import {
  EnrolledPerson,
  DetectionSettings,
  RecognitionSummary,
} from '../types';
import {
  detectAndRecognizeAllFaces,
  drawOverlay,
} from '../services/faceDetection';

interface LiveWebcamTabProps {
  enrolledPeople: EnrolledPerson[];
  settings: DetectionSettings;
  onOpenSettings: () => void;
  isModelReady: boolean;
}

export const LiveWebcamTab: React.FC<LiveWebcamTabProps> = ({
  enrolledPeople,
  settings,
  onOpenSettings,
  isModelReady,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveSummary, setLiveSummary] = useState<RecognitionSummary | null>(null);
  const [currentFps, setCurrentFps] = useState<number>(0);
  const [mirror, setMirror] = useState<boolean>(true);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isLoopRunningRef = useRef<boolean>(false);
  const lastFrameTimeRef = useRef<number>(0);

  // Enumerate camera devices
  useEffect(() => {
    async function getCameras() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setAvailableDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      } catch (err) {
        console.warn('Failed to enumerate media devices:', err);
      }
    }
    getCameras();
  }, [selectedDeviceId]);

  // Start webcam stream
  const startCamera = async () => {
    setError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: selectedDeviceId ? undefined : 'user',
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);
      setIsPaused(false);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError(
        err.message || 'Camera permission denied or camera device is in use by another app.'
      );
      setIsActive(false);
    }
  };

  // Stop webcam stream completely
  const stopCamera = useCallback(() => {
    isLoopRunningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    setIsActive(false);
    setIsPaused(false);
    setLiveSummary(null);
    setCurrentFps(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Main real-time inference loop throttled to target FPS
  useEffect(() => {
    if (!isActive || isPaused) {
      isLoopRunningRef.current = false;
      return;
    }

    let isMounted = true;
    isLoopRunningRef.current = true;
    let isProcessingFrame = false;
    let fpsCounter = 0;
    let lastFpsUpdateTime = performance.now();

    const targetIntervalMs = 1000 / (settings.targetFps || 5); // default ~5 fps (200ms)

    const processLoop = async (timestamp: number) => {
      if (!isLoopRunningRef.current || !isMounted) return;

      const elapsed = timestamp - lastFrameTimeRef.current;

      if (elapsed >= targetIntervalMs && !isProcessingFrame) {
        lastFrameTimeRef.current = timestamp;

        if (
          videoRef.current &&
          videoRef.current.readyState >= 2 &&
          videoRef.current.videoWidth > 0
        ) {
          isProcessingFrame = true;

          try {
            const summary = await detectAndRecognizeAllFaces(
              videoRef.current,
              enrolledPeople,
              settings
            );

            if (isMounted && canvasRef.current && videoRef.current) {
              setLiveSummary(summary);

              drawOverlay(
                canvasRef.current,
                {
                  width: videoRef.current.clientWidth,
                  height: videoRef.current.clientHeight,
                },
                summary,
                {
                  drawLandmarks: settings.drawLandmarks,
                  showScores: true,
                }
              );

              // FPS calculation
              fpsCounter++;
              const now = performance.now();
              if (now - lastFpsUpdateTime >= 1000) {
                setCurrentFps(Math.round((fpsCounter * 1000) / (now - lastFpsUpdateTime)));
                fpsCounter = 0;
                lastFpsUpdateTime = now;
              }
            }
          } catch (loopErr) {
            console.warn('Live frame detection error:', loopErr);
          } finally {
            isProcessingFrame = false;
          }
        }
      }

      if (isLoopRunningRef.current && isMounted) {
        animationFrameRef.current = requestAnimationFrame(processLoop);
      }
    };

    animationFrameRef.current = requestAnimationFrame(processLoop);

    return () => {
      isMounted = false;
      isLoopRunningRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, isPaused, enrolledPeople, settings]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Live Webcam Recognition
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Real-time biometric classification (~5 fps). Runs entirely on your local GPU/WASM pipeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Camera Selection */}
          {availableDevices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value);
                if (isActive) {
                  stopCamera();
                  setTimeout(startCamera, 200);
                }
              }}
              className="px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 font-medium"
            >
              {availableDevices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          )}

          {/* Mirror Flip Toggle */}
          <button
            type="button"
            onClick={() => setMirror(!mirror)}
            className={`p-2 rounded-lg border transition-colors ${
              mirror
                ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white'
                : 'text-neutral-500 border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
            title="Mirror Camera Feed"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>

          {/* Toggle Camera Stream Button */}
          {!isActive ? (
            <button
              type="button"
              onClick={startCamera}
              disabled={!isModelReady}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              <Video className="w-4 h-4" />
              <span>Start Webcam Feed</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs"
            >
              <VideoOff className="w-4 h-4" />
              <span>Stop Feed</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Stream & Realtime Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Live Video Viewport (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 sm:p-6 space-y-4">
            
            {/* Viewport Card */}
            <div className="relative rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-950 aspect-video flex items-center justify-center">
              {/* HTML5 Video Feed */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`w-full h-full object-cover ${mirror ? 'transform -scale-x-100' : ''}`}
              />

              {/* Real-time Canvas Annotation Overlay */}
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 pointer-events-none w-full h-full ${
                  mirror ? 'transform -scale-x-100' : ''
                }`}
              />

              {/* Inactive State Screen */}
              {!isActive && (
                <div className="absolute inset-0 bg-neutral-900 flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400">
                    <Camera className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-white">
                      Live Camera is Offline
                    </h3>
                    <p className="text-xs text-neutral-400 max-w-sm">
                      Click the button below to start real-time face detection and matching against your enrolled directory.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={!isModelReady}
                    className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-neutral-900 bg-white hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Launch Live Camera</span>
                  </button>
                </div>
              )}

              {/* Live Status HUD Header inside feed */}
              {isActive && (
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                  <div className="flex items-center gap-2 bg-neutral-900/85 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-mono text-white border border-neutral-700/60">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>LIVE</span>
                    <span aria-hidden="true">·</span>
                    <span>{currentFps} FPS</span>
                  </div>

                  <div className="bg-neutral-900/85 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-mono text-neutral-300 border border-neutral-700/60">
                    Thresh: {settings.threshold.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-800 dark:text-red-300">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Detection Tally & Target Directory (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Live In-Frame Counter */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              In-Frame Live Tally
            </h2>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800">
                <span className="block text-xl font-bold font-mono tabular-nums text-neutral-900 dark:text-white">
                  {liveSummary ? liveSummary.totalFaces : 0}
                </span>
                <span className="text-[10px] text-neutral-500 font-medium">Faces</span>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60">
                <span className="block text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {liveSummary ? liveSummary.knownFaces : 0}
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">Known</span>
              </div>

              <div className="p-2.5 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60">
                <span className="block text-xl font-bold font-mono tabular-nums text-red-600 dark:text-red-400">
                  {liveSummary ? liveSummary.unknownFaces : 0}
                </span>
                <span className="text-[10px] text-red-700 dark:text-red-300 font-medium">Unknown</span>
              </div>
            </div>

            {/* Currently Detected Names list */}
            {liveSummary && liveSummary.results.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Visible Targets:
                </span>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                  {liveSummary.results.map((r, i) => (
                    <div
                      key={r.id || i}
                      className="flex items-center justify-between text-xs p-1.5 rounded-md bg-neutral-50 dark:bg-neutral-800/60 font-mono"
                    >
                      <span
                        className={
                          r.label === 'KNOWN'
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'text-red-600 dark:text-red-400 font-semibold'
                        }
                      >
                        {r.label === 'KNOWN' ? r.name : 'Unknown'}
                      </span>
                      <span className="text-neutral-500 tabular-nums">
                        d: {r.distance.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Settings Card */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Engine Parameters
              </h3>
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                Configure
              </button>
            </div>

            <div className="space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
              <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800 font-mono">
                <span>Detector</span>
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {settings.detector === 'tiny' ? 'TinyFace (Real-time)' : 'SSD MobileNet'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800 font-mono">
                <span>Match Threshold</span>
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {settings.threshold.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800 font-mono">
                <span>Target Sampling</span>
                <span className="font-semibold text-neutral-900 dark:text-white">
                  ~{settings.targetFps || 5} fps
                </span>
              </div>
              <div className="flex justify-between py-1 font-mono">
                <span>Landmarks Overlay</span>
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {settings.drawLandmarks ? 'Active (68-pt)' : 'Off'}
                </span>
              </div>
            </div>

            {enrolledPeople.length === 0 && (
              <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-600 dark:text-neutral-400">
                0 enrolled people. Switch to the <strong>Enroll</strong> tab to register known identities.
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
