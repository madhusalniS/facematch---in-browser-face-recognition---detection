/**
 * RecognizeTab: Upload/drag-drop image, detect ALL faces, identify KNOWN vs UNKNOWN,
 * draw bounding boxes & labels on canvas overlay, display summary panel & detailed results table,
 * and provide PNG & CSV exports.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  Sliders,
  Layers,
} from 'lucide-react';
import {
  EnrolledPerson,
  DetectionSettings,
  RecognitionSummary,
  FaceMatchResult,
} from '../types';
import { detectAndRecognizeAllFaces, drawOverlay } from '../services/faceDetection';
import { downloadAnnotatedImage, downloadResultsCSV } from '../services/export';
import { SAMPLE_TEST_IMAGES } from '../services/sampleData';

interface RecognizeTabProps {
  enrolledPeople: EnrolledPerson[];
  settings: DetectionSettings;
  onOpenSettings: () => void;
  isModelReady: boolean;
}

export const RecognizeTab: React.FC<RecognizeTabProps> = ({
  enrolledPeople,
  settings,
  onOpenSettings,
  isModelReady,
}) => {
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>('test-image.jpg');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RecognitionSummary | null>(null);
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-run recognition when an image is loaded or settings change
  const runRecognition = async (src: string) => {
    setIsProcessing(true);
    setError(null);
    setSummary(null);
    setSelectedFaceId(null);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error('Failed to load selected image.'));
      });

      const resultSummary = await detectAndRecognizeAllFaces(img, enrolledPeople, settings);
      setSummary(resultSummary);
    } catch (err: any) {
      console.error('Recognition error:', err);
      setError(err.message || 'Failed to analyze faces in image.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Sync canvas overlay with image dimensions whenever summary or display changes
  useEffect(() => {
    if (!summary || !imageRef.current || !canvasRef.current) return;

    const img = imageRef.current;
    const canvas = canvasRef.current;

    const render = () => {
      if (!img.clientWidth || !img.clientHeight) return;
      drawOverlay(
        canvas,
        { width: img.clientWidth, height: img.clientHeight },
        summary,
        {
          drawLandmarks: settings.drawLandmarks,
          showScores: true,
        }
      );
    };

    // Render immediately and on window resize
    render();
    window.addEventListener('resize', render);
    return () => window.removeEventListener('resize', render);
  }, [summary, settings.drawLandmarks]);

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const url = URL.createObjectURL(file);
    setSelectedImageName(file.name);
    setSelectedImageSrc(url);
    runRecognition(url);
  };

  const handleSelectSample = (sample: typeof SAMPLE_TEST_IMAGES[0]) => {
    setSelectedImageName(sample.name);
    setSelectedImageSrc(sample.imageSrc);
    runRecognition(sample.imageSrc);
  };

  const handleExportPNG = async () => {
    if (!imageRef.current || !canvasRef.current) return;
    try {
      await downloadAnnotatedImage(
        imageRef.current,
        canvasRef.current,
        `facematch-${selectedImageName.replace(/\.[^/.]+$/, '')}-annotated.png`
      );
    } catch (err: any) {
      setError('PNG export failed: ' + err.message);
    }
  };

  const handleExportCSV = () => {
    if (!summary) return;
    downloadResultsCSV(
      summary,
      `facematch-${selectedImageName.replace(/\.[^/.]+$/, '')}-results.csv`
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Tab Header & Quick Presets */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Recognize Faces in Image
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Detect all faces in an image, compute 128-D descriptors, and match against enrolled identities using Euclidean distance.
          </p>
        </div>

        {/* Current matching params info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <span>Threshold: <strong>{settings.threshold.toFixed(2)}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Detector: <strong>{settings.detector.toUpperCase()}</strong></span>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Adjust Settings</span>
          </button>
        </div>
      </div>

      {/* Preset Sample Bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-neutral-500 dark:text-neutral-400 font-medium">Quick Test Photos:</span>
        {SAMPLE_TEST_IMAGES.map((sample) => (
          <button
            key={sample.name}
            type="button"
            onClick={() => handleSelectSample(sample)}
            disabled={isProcessing}
            className="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors font-medium text-xs disabled:opacity-50"
          >
            {sample.name}
          </button>
        ))}
      </div>

      {/* Main Image Viewport & Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Image Canvas & Upload Dropzone (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 sm:p-6 space-y-4">
            
            {/* Upload Toolbar */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                {selectedImageSrc ? selectedImageName : 'Upload Image for Recognition'}
              </span>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Image</span>
                </button>
                {selectedImageSrc && (
                  <button
                    type="button"
                    onClick={() => runRecognition(selectedImageSrc)}
                    disabled={isProcessing}
                    title="Re-run Face Recognition"
                    className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-800 dark:text-red-300">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Visual Viewport with Canvas Overlay */}
            {selectedImageSrc ? (
              <div className="relative rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-950 flex items-center justify-center min-h-[360px]">
                {/* Original Image */}
                <img
                  ref={imageRef}
                  src={selectedImageSrc}
                  alt="Recognition Input"
                  className="w-full h-auto max-h-[600px] object-contain block"
                  onLoad={() => {
                    if (summary && imageRef.current && canvasRef.current) {
                      drawOverlay(
                        canvasRef.current,
                        {
                          width: imageRef.current.clientWidth,
                          height: imageRef.current.clientHeight,
                        },
                        summary,
                        { drawLandmarks: settings.drawLandmarks, showScores: true }
                      );
                    }
                  }}
                />

                {/* Overlaid Canvas */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 pointer-events-none w-full h-full"
                />

                {/* Processing Overlay Spinner */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                    <span className="text-xs font-mono font-medium tracking-wide">
                      Detecting Faces & Computing 128-D Descriptors...
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Drag & Drop Empty View */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 rounded-xl p-12 text-center cursor-pointer transition-colors bg-neutral-50/50 dark:bg-neutral-800/30 min-h-[340px] flex flex-col items-center justify-center gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                    Drop a photo here or click to browse
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Supports high-resolution group photos, portraits, JPEG, PNG, WebP
                  </p>
                </div>
                <div className="pt-2">
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 underline underline-offset-4">
                    Or click one of the quick test presets above
                  </span>
                </div>
              </div>
            )}

            {/* Export Action Controls */}
            {summary && summary.totalFaces > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                  Analyzed in {summary.executionTimeMs}ms ({summary.imageWidth}×{summary.imageHeight})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportPNG}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PNG</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Summary Panel & Results Table (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Summary Metric Strip */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              Recognition Summary
            </h2>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 text-center">
                <span className="block text-2xl font-bold font-mono tabular-nums text-neutral-900 dark:text-white">
                  {summary ? summary.totalFaces : 0}
                </span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                  Total Faces
                </span>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 text-center">
                <span className="block text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {summary ? summary.knownFaces : 0}
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                  Known
                </span>
              </div>

              <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 text-center">
                <span className="block text-2xl font-bold font-mono tabular-nums text-red-600 dark:text-red-400">
                  {summary ? summary.unknownFaces : 0}
                </span>
                <span className="text-[11px] text-red-700 dark:text-red-300 font-medium">
                  Unknown
                </span>
              </div>
            </div>

            {enrolledPeople.length === 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300">
                <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p>
                  No people are enrolled in IndexedDB yet. All detected faces will be labeled <strong>UNKNOWN</strong> until you enroll people in the Enroll tab.
                </p>
              </div>
            )}
          </div>

          {/* Results Table */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Detected Faces Breakdown
              </h3>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                {summary ? summary.results.length : 0} Entries
              </span>
            </div>

            {!summary || summary.results.length === 0 ? (
              <div className="py-10 text-center text-xs text-neutral-400">
                {isProcessing ? 'Analyzing facial geometry...' : 'Upload or select an image to inspect results'}
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80 max-h-[460px] overflow-y-auto pr-1">
                {summary.results.map((face, idx) => {
                  const isKnown = face.label === 'KNOWN';
                  const isSelected = selectedFaceId === face.id;

                  return (
                    <div
                      key={face.id}
                      onClick={() => setSelectedFaceId(isSelected ? null : face.id)}
                      className={`py-3 flex items-center justify-between gap-3 cursor-pointer rounded-lg px-2 transition-colors ${
                        isSelected
                          ? 'bg-neutral-100 dark:bg-neutral-800'
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                      }`}
                    >
                      {/* Face Thumbnail Crop */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 ${
                            isKnown
                              ? 'border-emerald-500'
                              : 'border-red-500'
                          }`}
                        >
                          {face.thumbnailCrop ? (
                            <img
                              src={face.thumbnailCrop}
                              alt={`Face #${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-neutral-200 dark:bg-neutral-800" />
                          )}
                        </div>

                        {/* Name & Identity */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-semibold ${
                                isKnown
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-red-700 dark:text-red-400'
                              }`}
                            >
                              {isKnown ? face.name : 'Unknown Face'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                            <span>Face #{idx + 1}</span>
                            <span aria-hidden="true">·</span>
                            <span>{face.box.width}×{face.box.height}px</span>
                          </div>
                        </div>
                      </div>

                      {/* Distance Score & Confidence */}
                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold font-mono tabular-nums text-neutral-900 dark:text-white">
                          d: {face.distance.toFixed(4)}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                          {isKnown ? `${face.confidence}% conf` : 'd > thresh'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
