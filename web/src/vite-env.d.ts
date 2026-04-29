/// <reference types="vite/client" />

interface Document {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
}
