/**
 * Export utilities for FaceMatch: Annotated PNG download and CSV data export.
 */

import { RecognitionSummary } from '../types';

/**
 * Composites the source image with the canvas overlays and downloads the result as a PNG file.
 */
export async function downloadAnnotatedImage(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  overlayCanvas: HTMLCanvasElement,
  filename = 'facematch-annotated.png'
): Promise<void> {
  const originalWidth = 'naturalWidth' in sourceImage ? sourceImage.naturalWidth : sourceImage.width;
  const originalHeight = 'naturalHeight' in sourceImage ? sourceImage.naturalHeight : sourceImage.height;

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = originalWidth;
  exportCanvas.height = originalHeight;

  const ctx = exportCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize export canvas context.');
  }

  // 1. Draw base photo at full native resolution
  ctx.drawImage(sourceImage, 0, 0, originalWidth, originalHeight);

  // 2. Composite overlay canvas
  ctx.drawImage(overlayCanvas, 0, 0, originalWidth, originalHeight);

  // 3. Trigger download
  exportCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

/**
 * Generates and triggers download of face recognition results as a clean CSV file.
 */
export function downloadResultsCSV(
  summary: RecognitionSummary,
  filename = 'facematch-results.csv'
): void {
  const headers = [
    'Face Index',
    'Status',
    'Matched Name',
    'Distance Score',
    'Confidence (%)',
    'Box X',
    'Box Y',
    'Box Width',
    'Box Height',
  ];

  const rows = summary.results.map((r, index) => [
    index + 1,
    r.label,
    `"${r.name || 'N/A'}"`,
    r.distance.toFixed(4),
    `${r.confidence}%`,
    r.box.x,
    r.box.y,
    r.box.width,
    r.box.height,
  ]);

  const csvContent = [
    `# FaceMatch Recognition Export - Generated at ${new Date().toISOString()}`,
    `# Total Faces: ${summary.totalFaces}, Known: ${summary.knownFaces}, Unknown: ${summary.unknownFaces}, Time: ${summary.executionTimeMs}ms`,
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
