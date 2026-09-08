import type {
  ProtocolDomain,
  ProtocolType,
  ProtocolCommand,
  ProtocolEvent,
  EHelper,
} from './types.d.ts';

declare global {
  const E: EHelper;
  const FuzzySearch: any;
  const Search: any;
  const ProtocolRenderer: any;

  interface Window {
    app: any;
    E: EHelper;
    $: any;
    $$: any;
  }

  interface Element {
    scrollIntoViewIfNeeded?(centerIfNeeded?: boolean): void;
    el(name: string, className?: string, textContent?: string): HTMLElement;
    textNode(text: string): Text;
    div(className?: string, textContent?: string): HTMLDivElement;
    span(className?: string, textContent?: string): HTMLSpanElement;
    p(className?: string, textContent?: string): HTMLParagraphElement;
    box(className?: string, textContent?: string): HTMLDivElement;
    hbox(className?: string, textContent?: string): HTMLDivElement;
    vbox(className?: string, textContent?: string): HTMLDivElement;
    strong(text: string): HTMLElement;
    code(text: string): HTMLElement;
  }

  interface DocumentFragment {
    el(name: string, className?: string, textContent?: string): HTMLElement;
    textNode(text: string): Text;
    div(className?: string, textContent?: string): HTMLDivElement;
    span(className?: string, textContent?: string): HTMLSpanElement;
    p(className?: string, textContent?: string): HTMLParagraphElement;
    box(className?: string, textContent?: string): HTMLDivElement;
    hbox(className?: string, textContent?: string): HTMLDivElement;
    vbox(className?: string, textContent?: string): HTMLDivElement;
    strong(text: string): HTMLElement;
    code(text: string): HTMLElement;
  }
}
