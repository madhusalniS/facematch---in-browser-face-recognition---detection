/**
 * HowItWorksModal:
 * Visual & technical explanation of the 128-D facial recognition pipeline,
 * Euclidean distance metric, threshold mechanics, and client-side privacy architecture.
 */

import React from 'react';
import { X, ShieldCheck, Binary, Sliders, Scan, BookOpen } from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">
              How FaceMatch Works
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

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs text-neutral-600 dark:text-neutral-300">
          
          {/* Step 1: Face Detection */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-neutral-900 dark:text-white font-bold text-sm">
              <Scan className="w-4 h-4 text-emerald-500" />
              <span>1. Detection & Alignment (68-Point Mesh)</span>
            </div>
            <p className="leading-relaxed">
              When an image or webcam frame is provided, the detector (TinyFaceDetector or SSD MobileNet) locates all human faces and fits a 68-point landmark mesh covering the jawline, eyes, eyebrows, nose, and lips. The face is then affine-rotated and aligned so the eyes are horizontal and normalized to standard resolution.
            </p>
          </div>

          {/* Step 2: 128-D Deep Metric Learning */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-neutral-900 dark:text-white font-bold text-sm">
              <Binary className="w-4 h-4 text-blue-500" />
              <span>2. 128-Dimensional Deep Feature Extraction</span>
            </div>
            <p className="leading-relaxed">
              The aligned face is passed through a ResNet-34 deep convolutional neural network trained with triplet loss. It maps facial geometry into a continuous <strong>128-dimensional hypersphere</strong> vector (128 floating-point numbers). This vector is unique to the person's bone structure and features, remaining consistent across lighting, haircuts, and expressions.
            </p>
          </div>

          {/* Step 3: Euclidean Metric & Threshold */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-neutral-900 dark:text-white font-bold text-sm">
              <Sliders className="w-4 h-4 text-amber-500" />
              <span>3. Nearest-Neighbor Matching & Decision Threshold</span>
            </div>
            <p className="leading-relaxed">
              To identify a face, the engine computes the Euclidean distance (L2 norm) between its 128-D vector and each enrolled person's stored descriptors:
            </p>
            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg font-mono text-[11px] text-neutral-800 dark:text-neutral-200">
              distance = sqrt( sum( (target[i] - enrolled[i])^2 for i=0..127 ) )
            </div>
            <p className="leading-relaxed">
              The decision rule uses the <strong>Match Threshold (default 0.50)</strong>:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>distance ≤ 0.50:</strong> Classified as <strong>KNOWN</strong> (labeled with person's name + green bounding box).
              </li>
              <li>
                <strong>distance &gt; 0.50:</strong> Classified as <strong>UNKNOWN</strong> (labeled with red bounding box).
              </li>
              <li>
                Lowering the threshold (e.g. 0.40) makes matching stricter (fewer false positives). Raising it (e.g. 0.60) makes it more permissive.
              </li>
            </ul>
          </div>

          {/* Step 4: Local Security & Privacy */}
          <div className="space-y-1.5 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2 text-neutral-900 dark:text-white font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>100% Client-Side In-Browser Privacy</span>
            </div>
            <p className="leading-relaxed">
              All neural network inference runs locally in your browser using TensorFlow.js WebGL/WASM acceleration. Enrolled profiles and descriptors are stored in your browser's private <strong>IndexedDB</strong> storage. No photos, crops, or biometric embeddings are ever transmitted to an external server.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 rounded-lg transition-colors"
          >
            Got it
          </button>
        </div>

      </div>
    </div>
  );
};
