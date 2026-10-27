/**
 * Enrollment Component:
 * Allows enrolling known individuals via multi-photo uploads (1-5 photos) or webcam capture.
 * Validates strictly: rejects 0 faces or >1 faces with descriptive feedback.
 * Stores 128-D descriptors, thumbnails, and names in IndexedDB.
 */

import React, { useState, useRef } from 'react';
import {
  Upload,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  Sparkles,
  RefreshCw,
  Plus,
  X,
  Info,
} from 'lucide-react';
import { EnrolledPerson, DetectorType } from '../types';
import { extractSingleFaceForEnrollment } from '../services/faceDetection';
import { SAMPLE_PROFILES } from '../services/sampleData';

interface EnrollTabProps {
  enrolledPeople: EnrolledPerson[];
  onEnrollPerson: (person: Omit<EnrolledPerson, 'id' | 'createdAt'>) => Promise<void>;
  onDeletePerson: (id: string) => Promise<void>;
  detector: DetectorType;
  isModelReady: boolean;
}

interface PhotoItem {
  id: string;
  file?: File;
  previewUrl: string;
  descriptor?: number[];
  faceCrop?: string;
  status: 'idle' | 'processing' | 'valid' | 'invalid';
  errorMessage?: string;
}

export const EnrollTab: React.FC<EnrollTabProps> = ({
  enrolledPeople,
  onEnrollPerson,
  onDeletePerson,
  detector,
  isModelReady,
}) => {
  const [personName, setPersonName] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);

  // Webcam capture state inside enrollment form
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setEnrollError(null);
    setEnrollSuccess(null);

    const remainingSlots = 5 - photos.length;
    if (remainingSlots <= 0) {
      setEnrollError('Maximum of 5 photos per person reached.');
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    const newItems: PhotoItem[] = selectedFiles.map((f) => ({
      id: Math.random().toString(36).substring(2, 9),
      file: f,
      previewUrl: URL.createObjectURL(f),
      status: 'idle',
    }));

    setPhotos((prev) => [...prev, ...newItems]);

    // Process each newly added photo
    for (const item of newItems) {
      await processPhotoItem(item);
    }
  };

  const processPhotoItem = async (item: PhotoItem) => {
    updatePhotoStatus(item.id, { status: 'processing', errorMessage: undefined });

    try {
      const img = new Image();
      img.src = item.previewUrl;
      await new Promise((res, rej) => {
        img.onload = () => res(true);
        img.onerror = () => rej(new Error('Failed to decode image file.'));
      });

      const { descriptor, faceCrop } = await extractSingleFaceForEnrollment(img, detector);

      updatePhotoStatus(item.id, {
        status: 'valid',
        descriptor,
        faceCrop,
        errorMessage: undefined,
      });
    } catch (err: any) {
      updatePhotoStatus(item.id, {
        status: 'invalid',
        errorMessage: err.message || 'Face extraction failed.',
      });
    }
  };

  const updatePhotoStatus = (id: string, updates: Partial<PhotoItem>) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Start webcam for instant snapshot capture
  const startEnrollmentWebcam = async () => {
    setEnrollError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsWebcamActive(true);
    } catch (err: any) {
      setEnrollError(
        'Unable to access webcam: ' + (err.message || 'Camera permission denied or device not found.')
      );
    }
  };

  const stopEnrollmentWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsWebcamActive(false);
  };

  const captureWebcamSnapshot = async () => {
    if (!videoRef.current || photos.length >= 5) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw frame (mirrored)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const photoId = Math.random().toString(36).substring(2, 9);
    const newItem: PhotoItem = {
      id: photoId,
      previewUrl: dataUrl,
      status: 'processing',
    };

    setPhotos((prev) => [...prev, newItem]);

    try {
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res) => { img.onload = res; });
      const { descriptor, faceCrop } = await extractSingleFaceForEnrollment(img, detector);

      updatePhotoStatus(photoId, {
        status: 'valid',
        descriptor,
        faceCrop,
      });
    } catch (err: any) {
      updatePhotoStatus(photoId, {
        status: 'invalid',
        errorMessage: err.message || 'Face detection failed.',
      });
    }
  };

  // Submit enrollment
  const handleSubmitEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError(null);
    setEnrollSuccess(null);

    const trimmedName = personName.trim();
    if (!trimmedName) {
      setEnrollError('Please enter the person\'s full name.');
      return;
    }

    const validPhotos = photos.filter((p) => p.status === 'valid' && p.descriptor);

    if (validPhotos.length === 0) {
      setEnrollError('Please provide at least 1 valid photo containing a single clear face.');
      return;
    }

    // Check if any photos are still processing
    const isStillProcessing = photos.some((p) => p.status === 'processing');
    if (isStillProcessing) {
      setEnrollError('Please wait for photo verification to finish.');
      return;
    }

    setIsSubmitting(true);
    try {
      const descriptors = validPhotos.map((p) => p.descriptor!);
      // Use the first valid photo's faceCrop as thumbnail
      const thumbnail = validPhotos[0].faceCrop || validPhotos[0].previewUrl;

      await onEnrollPerson({
        name: trimmedName,
        thumbnail,
        descriptors,
        photoCount: validPhotos.length,
        notes: notes.trim() || undefined,
      });

      setEnrollSuccess(`Successfully enrolled "${trimmedName}" with ${validPhotos.length} face reference(s).`);
      setPersonName('');
      setNotes('');
      setPhotos([]);
      stopEnrollmentWebcam();
    } catch (err: any) {
      setEnrollError(err.message || 'Failed to enroll person into IndexedDB.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick enroll sample profiles for instant testing
  const handleLoadSampleProfiles = async () => {
    setIsSubmitting(true);
    setEnrollError(null);
    setEnrollSuccess(null);

    try {
      for (const sample of SAMPLE_PROFILES) {
        // Check if already enrolled
        const exists = enrolledPeople.some((p) => p.name.toLowerCase() === sample.name.toLowerCase());
        if (exists) continue;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = sample.imageSrc;
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = () => rej(new Error(`Failed to load ${sample.name} image`));
        });

        const { descriptor, faceCrop } = await extractSingleFaceForEnrollment(img, detector);

        await onEnrollPerson({
          name: sample.name,
          thumbnail: faceCrop,
          descriptors: [descriptor],
          photoCount: 1,
          notes: sample.role,
        });
      }

      setEnrollSuccess('Loaded sample profiles (Elena, David, Maya) ready for recognition.');
    } catch (err: any) {
      setEnrollError('Failed to load sample profiles: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const validPhotoCount = photos.filter((p) => p.status === 'valid').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Overview Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Enroll Known People
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Register trusted identities with 1 to 5 reference photos. 128-D descriptors are stored in your browser's IndexedDB.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleLoadSampleProfiles}
            disabled={isSubmitting || !isModelReady}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Load Sample Profiles</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Form on Left, Enrolled Directory on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Enrollment Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form
            onSubmit={handleSubmitEnrollment}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                New Identity Profile
              </h2>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                {validPhotoCount}/5 Valid Photos
              </span>
            </div>

            {/* Notifications */}
            {enrollError && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-800 dark:text-red-300">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p>{enrollError}</p>
              </div>
            )}

            {enrollSuccess && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p>{enrollSuccess}</p>
              </div>
            )}

            {/* Person Name Input */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="e.g., Sarah Chen, Marcus Vance"
                className="w-full px-3.5 py-2 text-sm bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
                required
              />
            </div>

            {/* Optional Role/Department */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                Notes / Department <span className="text-neutral-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Engineering Lead, Visitor Pass #102"
                className="w-full px-3.5 py-2 text-sm bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
              />
            </div>

            {/* Photo Ingestion Zone */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Reference Photos <span className="text-neutral-400 font-normal">(1 to 5 clear single-face portraits)</span>
                </label>
                <div className="flex items-center gap-2">
                  {!isWebcamActive ? (
                    <button
                      type="button"
                      onClick={startEnrollmentWebcam}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Use Webcam</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopEnrollmentWebcam}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-md hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Close Camera</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Webcam Preview if active */}
              {isWebcamActive && (
                <div className="relative rounded-lg overflow-hidden border border-neutral-300 dark:border-neutral-700 bg-black aspect-video flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  <button
                    type="button"
                    onClick={captureWebcamSnapshot}
                    disabled={photos.length >= 5}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-neutral-900/90 text-white rounded-full text-xs font-medium backdrop-blur-md shadow-lg hover:bg-neutral-800 transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Snapshot</span>
                  </button>
                </div>
              )}

              {/* Drag & Drop Upload Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 rounded-xl p-6 text-center cursor-pointer transition-colors bg-neutral-50/50 dark:bg-neutral-800/30"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-xs">
                    <span className="font-semibold text-neutral-900 dark:text-white">Click to upload</span> or drag and drop photos
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    JPEG, PNG or WebP · Max 5 photos · Must contain exactly 1 face
                  </div>
                </div>
              </div>

              {/* Selected Photo Previews & Validation Cards */}
              {photos.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {photos.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`relative flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                        item.status === 'valid'
                          ? 'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                          : item.status === 'invalid'
                          ? 'border-red-300 dark:border-red-800/60 bg-red-50/30 dark:bg-red-950/20'
                          : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40'
                      }`}
                    >
                      {/* Photo Thumbnail Crop */}
                      <div className="w-14 h-14 rounded-md overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 relative">
                        <img
                          src={item.faceCrop || item.previewUrl}
                          alt={`Reference #${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {item.status === 'processing' && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 text-white animate-spin" />
                          </div>
                        )}
                      </div>

                      {/* Status Info */}
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          {item.status === 'valid' && (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                                Valid 128-D Face
                              </span>
                            </>
                          )}
                          {item.status === 'invalid' && (
                            <>
                              <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                              <span className="text-red-700 dark:text-red-300 font-semibold">
                                Rejected
                              </span>
                            </>
                          )}
                          {item.status === 'processing' && (
                            <span className="text-neutral-500 text-xs">Extracting landmarks...</span>
                          )}
                        </div>

                        {item.errorMessage ? (
                          <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 line-clamp-2 leading-tight">
                            {item.errorMessage}
                          </p>
                        ) : (
                          <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
                            Reference #{idx + 1}
                          </p>
                        )}
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removePhoto(item.id)}
                        className="absolute top-2 right-2 p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                        title="Remove photo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || validPhotoCount === 0 || !personName.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 rounded-lg transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Storing Biometric Descriptors...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Enroll {personName.trim() ? `"${personName.trim()}"` : 'Person'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Enrolled People Directory (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-neutral-500" />
                <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                  Enrolled Directory
                </h2>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                {enrolledPeople.length} {enrolledPeople.length === 1 ? 'Person' : 'People'}
              </span>
            </div>

            {enrolledPeople.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 mx-auto flex items-center justify-center text-neutral-400">
                  <Users className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    No Enrolled People Yet
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto">
                    Enroll someone using the form on the left or click "Load Sample Profiles" to test immediately with demo identities.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadSampleProfiles}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Load Sample Profiles</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80 max-h-[560px] overflow-y-auto pr-1">
                {enrolledPeople.map((person) => (
                  <div
                    key={person.id}
                    className="py-3 flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-neutral-200 dark:border-neutral-700">
                        <img
                          src={person.thumbnail}
                          alt={person.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                          {person.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span>{person.photoCount} {person.photoCount === 1 ? 'photo' : 'photos'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">128-D vector</span>
                          {person.notes && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate max-w-[100px]">{person.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeletePerson(person.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors shrink-0"
                      title={`Delete ${person.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
