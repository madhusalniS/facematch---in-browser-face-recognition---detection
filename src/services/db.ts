/**
 * IndexedDB persistence service for FaceMatch.
 * Stores enrolled people with 128-D descriptors, thumbnails, and metadata locally in browser storage.
 */

import { EnrolledPerson } from '../types';

const DB_NAME = 'facematch_db';
const DB_VERSION = 1;
const STORE_PEOPLE = 'enrolled_people';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PEOPLE)) {
        const store = db.createObjectStore(STORE_PEOPLE, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(new Error(request.error?.message || 'Failed to open IndexedDB database.'));
    };
  });
}

export async function getAllPeople(): Promise<EnrolledPerson[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_PEOPLE, 'readonly');
      const store = tx.objectStore(STORE_PEOPLE);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = (request.result || []) as EnrolledPerson[];
        // Sort descending by creation date
        result.sort((a, b) => b.createdAt - a.createdAt);
        resolve(result);
      };

      request.onerror = () => {
        reject(new Error(request.error?.message || 'Failed to fetch enrolled people.'));
      };
    } catch (err) {
      reject(err);
    }
  });
}

export async function addPerson(person: Omit<EnrolledPerson, 'id' | 'createdAt'>): Promise<EnrolledPerson> {
  const db = await openDatabase();
  const newPerson: EnrolledPerson = {
    ...person,
    id: 'person_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_PEOPLE, 'readwrite');
      const store = tx.objectStore(STORE_PEOPLE);
      const request = store.add(newPerson);

      request.onsuccess = () => {
        resolve(newPerson);
      };

      request.onerror = () => {
        reject(new Error(request.error?.message || 'Failed to enroll person.'));
      };
    } catch (err) {
      reject(err);
    }
  });
}

export async function deletePerson(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_PEOPLE, 'readwrite');
      const store = tx.objectStore(STORE_PEOPLE);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(request.error?.message || 'Failed to delete enrolled person.'));
      };
    } catch (err) {
      reject(err);
    }
  });
}

export async function clearAllPeople(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_PEOPLE, 'readwrite');
      const store = tx.objectStore(STORE_PEOPLE);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(request.error?.message || 'Failed to clear enrolled database.'));
      };
    } catch (err) {
      reject(err);
    }
  });
}
