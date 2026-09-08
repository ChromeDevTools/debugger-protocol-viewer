declare global {
  interface Window {
    app?: any;
  }

  interface Element {
    scrollIntoViewIfNeeded?(centerIfNeeded?: boolean): void;
  }
}

export {};
