/**
 * FaceMatch Data Types and Interfaces
 */

export interface EnrolledPerson {
  id: string;
  name: string;
  thumbnail: string; // Base64 data URL
  descriptors: number[][]; // Array of 128-D floating-point face descriptors
  createdAt: number;
  photoCount: number;
  notes?: string;
}

export type DetectorType = 'tiny' | 'ssd';

export interface DetectionSettings {
  detector: DetectorType;
  threshold: number; // 0.3 - 0.7, default 0.5
  inputSize: number; // 320, 416, 512, 608 for tiny face detector
  minConfidence: number; // 0.1 - 0.9, default 0.5
  drawLandmarks: boolean;
  flipWebcam: boolean;
  targetFps: number; // 2 - 15 fps
}

export interface FaceBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceMatchResult {
  id: string;
  box: FaceBoundingBox;
  label: 'KNOWN' | 'UNKNOWN';
  name?: string;
  personId?: string;
  distance: number; // Euclidean distance in 128-D space
  confidence: number; // 0 - 100 %
  thumbnailCrop?: string; // Base64 thumbnail crop of the detected face
  landmarks?: { x: number; y: number }[];
  allCandidates?: { name: string; distance: number }[];
}

export interface RecognitionSummary {
  totalFaces: number;
  knownFaces: number;
  unknownFaces: number;
  executionTimeMs: number;
  results: FaceMatchResult[];
  imageWidth: number;
  imageHeight: number;
}

export interface ModelLoadStatus {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  detectorName: DetectorType;
  progressMessage: string;
}

export interface PhotoEnrollmentResult {
  file: File;
  previewUrl: string;
  descriptor?: number[];
  faceCrop?: string;
  status: 'pending' | 'success' | 'error';
  errorMessage?: string;
}
