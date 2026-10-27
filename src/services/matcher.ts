/**
 * FaceMatch Biometric Matching Engine
 * 
 * ============================================================================
 * HOW 128-DIMENSIONAL FACE RECOGNITION WORKS:
 * ============================================================================
 * 1. Deep Metric Learning:
 *    The face-recognition neural network (ResNet-34 based) takes an aligned face
 *    crop and projects it into a 128-dimensional continuous vector space.
 * 
 * 2. Euclidean Distance Metric:
 *    In this 128-D hypersphere, the similarity between two faces A and B is measured
 *    by the Euclidean distance (L2 norm):
 *      d(A, B) = sqrt( sum_{i=0}^{127} (A[i] - B[i])^2 )
 * 
 * 3. Match Threshold Mechanics:
 *    - Typical distance for identical photos: 0.00 - 0.15
 *    - Same person across different lighting/angles/expressions: 0.20 - 0.45
 *    - Borderline/ambiguous cases: 0.48 - 0.55
 *    - Completely different people: 0.60 - 1.20+
 * 
 *    The standard industry default threshold is 0.50 (or 0.60 in permissive settings).
 *    - LOWER threshold (e.g., 0.40): Stricter security, fewer false positives, but may
 *      miss matches under tough lighting.
 *    - HIGHER threshold (e.g., 0.60): More lenient, fewer false negatives, but increased
 *      risk of falsely identifying an unknown person as a known individual.
 * 
 * 4. Multi-Photo Enrollment:
 *    When a person enrolls 1 to 5 photos, FaceMatch tests the target face against ALL
 *    enrolled descriptors for that person, taking the minimum distance:
 *      min_d = min_{photo in person.descriptors} d(target, photo)
 *    This accounts for facial variations across lighting, angles, and facial expressions.
 * ============================================================================
 */

import { EnrolledPerson, FaceMatchResult } from '../types';

/**
 * Computes standard Euclidean distance between two 128-D vectors.
 */
export function calculateEuclideanDistance(desc1: number[] | Float32Array, desc2: number[] | Float32Array): number {
  if (desc1.length !== desc2.length) {
    throw new Error(`Descriptor dimensions mismatch: ${desc1.length} vs ${desc2.length}`);
  }

  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Calculates human-readable confidence percentage from distance and threshold.
 * Uses a smooth inverted sigmoid centered around the matching threshold.
 * Returns an integer between 0 and 99.
 */
export function calculateConfidence(distance: number, threshold: number): number {
  // If identical match
  if (distance < 0.05) return 99;
  
  // Logistic curve centered at threshold with steepness factor 7
  // At distance = threshold, value is 50%
  // At distance = 0.25 (when threshold=0.5), value is ~85%
  // At distance = 0.70, value is ~18%
  const steepness = 7.5;
  const normalized = 1 / (1 + Math.exp((distance - threshold) * steepness));
  const percentage = Math.round(normalized * 100);
  return Math.max(1, Math.min(99, percentage));
}

/**
 * Matches a detected face's 128-D descriptor against all enrolled people in the database.
 * 
 * @param queryDescriptor The 128-D descriptor extracted from the detected face
 * @param enrolledPeople List of registered identities from IndexedDB
 * @param threshold Maximum Euclidean distance to accept as a KNOWN match (default 0.5)
 * @returns Matched identity, distance, confidence, and status
 */
export function matchFaceDescriptor(
  queryDescriptor: number[] | Float32Array,
  enrolledPeople: EnrolledPerson[],
  threshold: number = 0.5
): {
  label: 'KNOWN' | 'UNKNOWN';
  name?: string;
  personId?: string;
  distance: number;
  confidence: number;
  allCandidates: { name: string; distance: number }[];
} {
  if (!enrolledPeople || enrolledPeople.length === 0) {
    return {
      label: 'UNKNOWN',
      distance: 1.0,
      confidence: 0,
      allCandidates: [],
    };
  }

  let bestPerson: EnrolledPerson | null = null;
  let minDistance = Infinity;
  const candidates: { name: string; distance: number }[] = [];

  for (const person of enrolledPeople) {
    if (!person.descriptors || person.descriptors.length === 0) continue;

    // Multi-descriptor evaluation: find the closest reference photo for this person
    let personMinDistance = Infinity;
    for (const enrolledDesc of person.descriptors) {
      const dist = calculateEuclideanDistance(queryDescriptor, enrolledDesc);
      if (dist < personMinDistance) {
        personMinDistance = dist;
      }
    }

    candidates.push({
      name: person.name,
      distance: Number(personMinDistance.toFixed(4)),
    });

    if (personMinDistance < minDistance) {
      minDistance = personMinDistance;
      bestPerson = person;
    }
  }

  // Sort candidates by lowest distance
  candidates.sort((a, b) => a.distance - b.distance);

  const roundedDistance = Number(minDistance.toFixed(4));
  const confidence = calculateConfidence(minDistance, threshold);

  // Core decision rule:
  // If minimum Euclidean distance is less than or equal to threshold => KNOWN
  // Otherwise => UNKNOWN
  if (bestPerson && minDistance <= threshold) {
    return {
      label: 'KNOWN',
      name: bestPerson.name,
      personId: bestPerson.id,
      distance: roundedDistance,
      confidence,
      allCandidates: candidates.slice(0, 3),
    };
  }

  return {
    label: 'UNKNOWN',
    name: undefined,
    personId: undefined,
    distance: roundedDistance,
    confidence: Math.max(0, 100 - confidence),
    allCandidates: candidates.slice(0, 3),
  };
}
