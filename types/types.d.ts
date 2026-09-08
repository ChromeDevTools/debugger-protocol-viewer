export type { Protocol } from 'devtools-protocol';
import type { IProtocol, Protocol as ProtocolSchema } from './protocol-schema.d.ts';

export type { IProtocol } from './protocol-schema.d.ts';

export type ProtocolCommand = ProtocolSchema.Command;
export type ProtocolEvent = ProtocolSchema.Event;

export interface ProtocolBackReference {
  type: 'command' | 'event' | 'type';
  name: string;
}

/** Flattened protocol parameter / property for viewer traversal */
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
  properties?: ProtocolParameter[];
}

/** Flattened domain type representation including runtime back-references */
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
  version?: ProtocolSchema.Version;
  domains: ProtocolDomain[];
}

export interface NormalizedProtocolRoot {
  version?: ProtocolSchema.Version;
  domains: NormalizedProtocolDomain[];
}

export type TargetKind = 'tot' | 'stable' | 'v8';

export interface RouteInfo {
  target: TargetKind;
  domain: string | null;
  member: string | null;
}
