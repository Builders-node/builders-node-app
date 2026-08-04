import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './lib/queryClient';
import './tailwind.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* At the root, not inside a page — the cache has to outlive navigation
        for any of it to be worth having. */}
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
