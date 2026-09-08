import type Protocol from 'devtools-protocol';
export type { Protocol };

export interface ProtocolParameter {
  name?: string;
  type?: string;
  $ref?: string;
  description?: string;
  optional?: boolean;
  experimental?: boolean;
  deprecated?: boolean;
  items?: ProtocolParameter;
  enum?: string[];
}

export interface ProtocolCommand {
  name: string;
  description?: string;
  experimental?: boolean;
  deprecated?: boolean;
  parameters?: ProtocolParameter[];
  returns?: ProtocolParameter[];
  redirect?: string;
}

export interface ProtocolEvent {
  name: string;
  description?: string;
  experimental?: boolean;
  deprecated?: boolean;
  parameters?: ProtocolParameter[];
}

export interface ProtocolBackReference {
  type: 'command' | 'event' | 'type';
  name: string;
}

export interface ProtocolType {
  id: string;
  type?: string;
  description?: string;
  experimental?: boolean;
  deprecated?: boolean;
  properties?: ProtocolParameter[];
  enum?: string[];
  items?: ProtocolParameter;
  referencedBy?: ProtocolBackReference[];
}

export interface ProtocolDomain {
  domain: string;
  description?: string;
  experimental?: boolean;
  deprecated?: boolean;
  dependencies?: string[];
  types?: ProtocolType[];
  commands?: ProtocolCommand[];
  events?: ProtocolEvent[];
}

export interface NormalizedProtocolDomain extends ProtocolDomain {
  types: ProtocolType[];
  commands: ProtocolCommand[];
  events: ProtocolEvent[];
}

export interface ProtocolRoot {
  version?: { major: string; minor: string };
  domains: ProtocolDomain[];
}

export interface NormalizedProtocolRoot {
  version?: { major: string; minor: string };
  domains: NormalizedProtocolDomain[];
}

export type TargetKind = 'tot' | 'stable' | 'v8';

export interface RouteInfo {
  target: TargetKind;
  domain: string | null;
  member: string | null;
}

export interface EHelper {
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
  a(href: string, text?: string): HTMLAnchorElement;
}
