/**
 * Sample Demo Data for FaceMatch
 * Includes pre-packaged portrait assets and group test scenes for instant testing.
 */

export interface SampleProfile {
  name: string;
  imageSrc: string;
  role: string;
}

export const SAMPLE_PROFILES: SampleProfile[] = [
  {
    name: 'Elena Rostova',
    imageSrc: '/src/assets/images/face_portrait_elena_1793111519252.jpg',
    role: 'Product Lead',
  },
  {
    name: 'David Sterling',
    imageSrc: '/src/assets/images/face_portrait_david_1793111520216.jpg',
    role: 'Principal Architect',
  },
  {
    name: 'Maya Lin',
    imageSrc: '/src/assets/images/face_portrait_maya_1793111502010.jpg',
    role: 'Research Engineer',
  },
];

export const SAMPLE_TEST_IMAGES = [
  {
    name: 'Office Team Meeting',
    description: '3 colleagues in open workspace',
    imageSrc: '/src/assets/images/face_group_conference_1793111502327.jpg',
  },
  {
    name: 'Elena (Verification)',
    description: 'Target test: Elena Rostova',
    imageSrc: '/src/assets/images/face_portrait_elena_1793111519252.jpg',
  },
  {
    name: 'David (Verification)',
    description: 'Target test: David Sterling',
    imageSrc: '/src/assets/images/face_portrait_david_1793111520216.jpg',
  },
];
