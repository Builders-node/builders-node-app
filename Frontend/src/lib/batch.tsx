import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiRequest } from './api';

type BatchValue = {
  /** Raw ISO date (YYYY-MM-DD) or null. */
  startDate: string | null;
  /** Optional custom badge label. */
  label: string | null;
};

const BatchContext = createContext<BatchValue>({ startDate: null, label: null });

export function BatchProvider({ children }: { children: ReactNode }) {
  const [batch, setBatch] = useState<BatchValue>({ startDate: null, label: null });

  useEffect(() => {
    apiRequest<{ batch: BatchValue }>('/public/settings')
      .then((data) => setBatch(data.batch ?? { startDate: null, label: null }))
      .catch(() => {
        /* fall back to the landing's default copy */
      });
  }, []);

  return <BatchContext.Provider value={batch}>{children}</BatchContext.Provider>;
}

export function useBatch() {
  const { startDate, label } = useContext(BatchContext);
  // Parse as a local date (avoid timezone shifting a YYYY-MM-DD by a day).
  const date = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const valid = date && !Number.isNaN(date.getTime()) ? date : null;
  return {
    startDate,
    label,
    date: valid,
    longDate: valid ? valid.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null,
    monthDay: valid ? valid.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : null,
  };
}
