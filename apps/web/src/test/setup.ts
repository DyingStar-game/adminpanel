import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import '@/i18n';
import { server } from './server';

// jsdom lacks matchMedia (theme), ResizeObserver and pointer capture (Radix primitives).
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.scrollIntoView ??= () => {};

// React Flow measures nodes and the viewport (see its testing guide).
class DOMMatrixReadOnlyMock {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([1-9.])\)/)?.[1];
    this.m22 = scale !== undefined ? Number(scale) : 1;
  }
}
globalThis.DOMMatrixReadOnly ??= DOMMatrixReadOnlyMock as unknown as typeof DOMMatrixReadOnly;
Object.defineProperties(HTMLElement.prototype, {
  offsetHeight: {
    get() {
      return Number.parseFloat(this.style.height) || 1;
    },
  },
  offsetWidth: {
    get() {
      return Number.parseFloat(this.style.width) || 1;
    },
  },
});
(SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () =>
  ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  // Unmount first, so in-flight queries never hit already-reset handlers.
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());
