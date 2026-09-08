declare global {
  interface Window {
    app?: import('../src/main.js').App;
  }

  interface Element {
    scrollIntoViewIfNeeded?(centerIfNeeded?: boolean): void;
  }
}

export {};
