/**
 * Privacy notice banner emphasizing client-side processing & consent ethics.
 */

import React, { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';

export const PrivacyBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 px-4 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            <strong className="font-semibold text-neutral-800 dark:text-neutral-200">Local Biometric Privacy:</strong>{' '}
            Images are processed locally in your browser. No photos or face embeddings are ever sent to an external server. Only enroll people who have given consent.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1 transition-colors"
          aria-label="Dismiss privacy notice"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
