// Adds the DOM matchers to expect(): toBeInTheDocument, toHaveTextContent, toHaveAttribute…
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { fakeApi } from './test-utils';

// No test reaches the network, even one that sets no fake API of its own.
beforeEach(() => {
  fakeApi({});
});

// Every test starts logged out.
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});
