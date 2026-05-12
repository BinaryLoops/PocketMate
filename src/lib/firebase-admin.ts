import 'server-only';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

let _initialized = false;

function getAdminApp() {
  // Lazy init so API routes can catch env errors and return JSON,
  // instead of throwing at module import time (which yields HTML error pages).
  if (!_initialized) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      throw new Error('Missing FIREBASE_ADMIN_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID).');
    }

    const clientEmail = requireEnv('FIREBASE_ADMIN_CLIENT_EMAIL');
    const privateKey = requireEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n');

    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    _initialized = true;
  }

  return getApps()[0]!;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

