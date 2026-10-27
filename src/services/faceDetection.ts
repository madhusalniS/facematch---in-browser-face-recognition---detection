/**
 * Face Detection and Recognition Engine powered by @vladmandic/face-api.
 * Operates 100% client-side in the browser.
 */

import * as faceapi from '@vladmandic/face-api';
import {
  DetectorType,
  DetectionSettings,
  EnrolledPerson,
  FaceBoundingBox,
  FaceMatchResult,
  RecognitionSummary,
} from '../types';
import { matchFaceDescriptor } from './matcher';

// State tracking for model loading
let modelsLoaded = false;
let currentDetector: DetectorType | null = null;
let modelPathInUse = '/models';

const PRIMARY_MODEL_PATH = '/models';
const CDN_MODEL_PATH = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

/**
 * Initializes and loads required neural network models into WebGL / WASM memory.
 */
export async function loadFaceModels(
  detector: DetectorType = 'tiny',
  onProgress?: (msg: string) => void
): Promise<void> {
  if (modelsLoaded && currentDetector === detector) {
    return;
  }

  onProgress?.('Initializing face detection engine...');

  let basePath = PRIMARY_MODEL_PATH;
  try {
    await testModelPath(basePath);
  } catch {
    basePath = CDN_MODEL_PATH;
    modelPathInUse = CDN_MODEL_PATH;
  }

  try {
    if (detector === 'tiny') {
      onProgress?.('Loading fast TinyFace detector...');
      await faceapi.nets.tinyFaceDetector.loadFromUri(basePath);
    } else {
      onProgress?.('Loading high-accuracy SSD MobileNet detector...');
      await faceapi.nets.ssdMobilenetv1.loadFromUri(basePath);
    }

    onProgress?.('Loading 68-point facial landmark model...');
    await faceapi.nets.faceLandmark68Net.loadFromUri(basePath);

    onProgress?.('Loading 128-D biometric recognition model...');
    await faceapi.nets.faceRecognitionNet.loadFromUri(basePath);

    modelsLoaded = true;
    currentDetector = detector;
    onProgress?.('Neural models ready.');
  } catch (err: any) {
    console.error('Failed to load models from primary path, trying CDN fallback...', err);
    if (basePath !== CDN_MODEL_PATH) {
      modelPathInUse = CDN_MODEL_PATH;
      await loadFaceModels(detector, onProgress);
    } else {
      throw new Error(`Failed to initialize facial models: ${err?.message || err}`);
    }
  }
}

async function testModelPath(path: string): Promise<void> {
  const testUrl = `${path}/tiny_face_detector_model-weights_manifest.json`;
  const res = await fetch(testUrl, { method: 'HEAD' });
  if (!res.ok) {
    throw new Error(`Manifest not accessible at ${path}`);
  }
}

/**
 * Creates detection options based on detector type and threshold settings.
 */
export function getDetectorOptions(settings: DetectionSettings) {
  if (settings.detector === 'tiny') {
    return new faceapi.TinyFaceDetectorOptions({
      inputSize: settings.inputSize || 416,
      scoreThreshold: settings.minConfidence || 0.4,
    });
  } else {
    return new faceapi.SsdMobilenetv1Options({
      minConfidence: settings.minConfidence || 0.45,
    });
  }
}

/**
 * Resizes an image or canvas if width or height exceeds maxDimension (e.g. 1280px).
 * Returns an HTMLCanvasElement with optimized dimensions.
 */
export function resizeImageToMaxDimension(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  maxDimension = 1280
): HTMLCanvasElement {
  const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height;

  if (!width || !height) {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    return canvas;
  }

  let targetWidth = width;
  let targetHeight = height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      targetWidth = maxDimension;
      targetHeight = Math.round((height * maxDimension) / width);
    } else {
      targetHeight = maxDimension;
      targetWidth = Math.round((width * maxDimension) / height);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  }
  return canvas;
}

/**
 * Extracts a face crop data URL from a source element with given bounding box.
 */
export function extractFaceCrop(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  box: FaceBoundingBox,
  targetSize = 128,
  paddingRatio = 0.25
): string {
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const padX = box.width * paddingRatio;
  const padY = box.height * paddingRatio;

  const sx = Math.max(0, box.x - padX);
  const sy = Math.max(0, box.y - padY);
  const sw = box.width + padX * 2;
  const sh = box.height + padY * 2;

  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, targetSize, targetSize);
  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Strict single-face extraction for enrolling known identities.
 * Enforces:
 *  - Exactly ONE face detected.
 *  - Rejects 0 faces with clear guidance.
 *  - Rejects >1 faces with count and explanation.
 */
export async function extractSingleFaceForEnrollment(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  detector: DetectorType = 'tiny'
): Promise<{
  descriptor: number[];
  faceCrop: string;
  box: FaceBoundingBox;
}> {
  await loadFaceModels(detector);

  // Optimize image to reasonable max size
  const optimizedCanvas = resizeImageToMaxDimension(sourceImage, 1280);

  const options = detector === 'tiny'
    ? new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 })
    : new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 });

  const allDetections = await faceapi
    .detectAllFaces(optimizedCanvas, options)
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (allDetections.length === 0) {
    throw new Error('No face detected in this image. Please upload a clear photo with a visible, forward-facing face.');
  }

  if (allDetections.length > 1) {
    throw new Error(
      `Multiple faces detected (${allDetections.length} faces found). Enrolled photos must contain exactly ONE person to ensure identity accuracy.`
    );
  }

  const singleDetection = allDetections[0];
  const box: FaceBoundingBox = {
    x: singleDetection.detection.box.x,
    y: singleDetection.detection.box.y,
    width: singleDetection.detection.box.width,
    height: singleDetection.detection.box.height,
  };

  const descriptor = Array.from(singleDetection.descriptor);
  const faceCrop = extractFaceCrop(optimizedCanvas, box, 160, 0.25);

  return {
    descriptor,
    faceCrop,
    box,
  };
}

/**
 * Detects ALL faces in an image or frame and evaluates each against enrolled people.
 */
export async function detectAndRecognizeAllFaces(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  enrolledPeople: EnrolledPerson[],
  settings: DetectionSettings
): Promise<RecognitionSummary> {
  const startTime = performance.now();
  await loadFaceModels(settings.detector);

  // Resize if too large
  const canvas = resizeImageToMaxDimension(source, 1280);
  const options = getDetectorOptions(settings);

  const detections = await faceapi
    .detectAllFaces(canvas, options)
    .withFaceLandmarks()
    .withFaceDescriptors();

  const results: FaceMatchResult[] = [];
  let knownCount = 0;
  let unknownCount = 0;

  for (let i = 0; i < detections.length; i++) {
    const det = detections[i];
    const box: FaceBoundingBox = {
      x: Math.round(det.detection.box.x),
      y: Math.round(det.detection.box.y),
      width: Math.round(det.detection.box.width),
      height: Math.round(det.detection.box.height),
    };

    const match = matchFaceDescriptor(det.descriptor, enrolledPeople, settings.threshold);

    if (match.label === 'KNOWN') {
      knownCount++;
    } else {
      unknownCount++;
    }

    const faceCrop = extractFaceCrop(canvas, box, 120, 0.2);

    const landmarks = settings.drawLandmarks
      ? det.landmarks.positions.map((pt) => ({ x: pt.x, y: pt.y }))
      : undefined;

    results.push({
      id: `face_${i + 1}`,
      box,
      label: match.label,
      name: match.name,
      personId: match.personId,
      distance: match.distance,
      confidence: match.confidence,
      thumbnailCrop: faceCrop,
      landmarks,
      allCandidates: match.allCandidates,
    });
  }

  const executionTimeMs = Math.round(performance.now() - startTime);

  return {
    totalFaces: detections.length,
    knownFaces: knownCount,
    unknownFaces: unknownCount,
    executionTimeMs,
    results,
    imageWidth: canvas.width,
    imageHeight: canvas.height,
  };
}

/**
 * Renders annotated bounding boxes, label tags, and landmark overlays onto an overlay canvas.
 */
export function drawOverlay(
  canvas: HTMLCanvasElement,
  displayDimensions: { width: number; height: number },
  summary: RecognitionSummary,
  options: { drawLandmarks: boolean; showScores: boolean }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = displayDimensions;
  canvas.width = width;
  canvas.height = height;

  ctx.clearRect(0, 0, width, height);

  // Scaling factor between internal processing resolution and display resolution
  const scaleX = width / (summary.imageWidth || width);
  const scaleY = height / (summary.imageHeight || height);

  for (const face of summary.results) {
    const bx = face.box.x * scaleX;
    const by = face.box.y * scaleY;
    const bw = face.box.width * scaleX;
    const bh = face.box.height * scaleY;

    const isKnown = face.label === 'KNOWN';
    const mainColor = isKnown ? '#10B981' : '#EF4444'; // Emerald for known, Crimson for unknown
    const fillColor = isKnown ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';

    // 1. Draw subtle shaded face box
    ctx.fillStyle = fillColor;
    ctx.fillRect(bx, by, bw, bh);

    // 2. Draw crisp bounding border
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.strokeRect(bx, by, bw, bh);

    // 3. Draw high-tech corner brackets for sleek aesthetic
    const cornerLen = Math.min(18, bw * 0.25, bh * 0.25);
    ctx.lineWidth = 4;
    ctx.beginPath();
    // Top-left
    ctx.moveTo(bx, by + cornerLen);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + cornerLen, by);
    // Top-right
    ctx.moveTo(bx + bw - cornerLen, by);
    ctx.lineTo(bx + bw, by);
    ctx.lineTo(bx + bw, by + cornerLen);
    // Bottom-left
    ctx.moveTo(bx, by + bh - cornerLen);
    ctx.lineTo(bx, by + bh);
    ctx.lineTo(bx + cornerLen, by + bh);
    // Bottom-right
    ctx.moveTo(bx + bw - cornerLen, by + bh);
    ctx.lineTo(bx + bw, by + bh);
    ctx.lineTo(bx + bw, by + bh - cornerLen);
    ctx.stroke();

    // 4. Draw optional 68-point landmarks
    if (options.drawLandmarks && face.landmarks) {
      ctx.fillStyle = isKnown ? '#34D399' : '#F87171';
      for (const pt of face.landmarks) {
        ctx.beginPath();
        ctx.arc(pt.x * scaleX, pt.y * scaleY, 2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // 5. Draw label badge
    const labelTitle = isKnown ? (face.name || 'Known') : 'Unknown';
    const scoreText = options.showScores
      ? isKnown
        ? `${face.confidence}% · d:${face.distance.toFixed(3)}`
        : `d:${face.distance.toFixed(3)}`
      : '';

    ctx.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
    const titleWidth = ctx.measureText(labelTitle).width;
    ctx.font = '500 11px "JetBrains Mono", monospace';
    const subWidth = scoreText ? ctx.measureText(scoreText).width : 0;

    const badgeWidth = Math.max(titleWidth, subWidth) + 16;
    const badgeHeight = scoreText ? 36 : 24;

    // Position label above box if space permits, else inside top
    let badgeY = by - badgeHeight - 6;
    if (badgeY < 4) {
      badgeY = by + 6;
    }
    const badgeX = Math.max(4, Math.min(width - badgeWidth - 4, bx));

    // Badge background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 6);
    ctx.fill();

    // Badge border
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Text: Title
    ctx.fillStyle = isKnown ? '#A7F3D0' : '#FECACA';
    ctx.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(labelTitle, badgeX + 8, badgeY + 5);

    // Text: Sub-scores
    if (scoreText) {
      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.fillText(scoreText, badgeX + 8, badgeY + 20);
    }
  }
}
