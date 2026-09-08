/**
 * @fileoverview Protocol Model - Isomorphic pure functions for CDP protocols.
 * Browser-agnostic, zero-DOM ES module.
 */

/** @import { ProtocolDomain, NormalizedProtocolDomain, ProtocolRoot, NormalizedProtocolRoot, TargetKind, RouteInfo } from '../types/types.d.ts' */

/** @type {Map<string, TargetKind>} */
const TARGET_MAP = new Map([
  ['tot', 'tot'],
  ['stable', 'stable'],
  ['1-3', 'stable'],
  ['1-2', 'stable'],
  ['v8', 'v8'],
]);

/**
 * Normalizes a target string to one of: 'tot', 'stable', 'v8'.
 * @param {string|null|undefined} target
 * @returns {TargetKind}
 */
export function normalizeTarget(target) {
  if (!target) return 'tot';
  return TARGET_MAP.get(target.toLowerCase()) || 'tot';
}

/**
 * Resolves the identifier property name for sorting a CDP collection.
 * @param {string} collectionName
 * @returns {string|null}
 */
function nameProperty(collectionName) {
  switch (collectionName) {
    case 'domains':
      return 'domain';
    case 'types':
      return 'id';
    case 'commands':
    case 'events':
    case 'parameters':
    case 'returns':
    case 'properties':
      return 'name';
    default:
      return null;
  }
}

/**
 * Deterministically sorts a collection in-place:
 * 1. Standard (0) before Experimental (1) before Deprecated (2).
 * 2. Required before optional.
 * 3. Alphabetical by entity name.
 *
 * @param {Array<any>} items
 * @param {string|null} prop
 */
function sortCollection(items, prop) {
  if (!prop) return;
  items.sort((a, b) => {
    // 1. Standard (0) before Experimental (1) before Deprecated (2)
    const aRank = a.deprecated ? 2 : a.experimental ? 1 : 0;
    const bRank = b.deprecated ? 2 : b.experimental ? 1 : 0;
    if (aRank !== bRank) {
      return aRank - bRank;
    }

    // 2. Required before optional
    const aOpt = a.optional ? 1 : 0;
    const bOpt = b.optional ? 1 : 0;
    if (aOpt !== bOpt) {
      return aOpt - bOpt;
    }

    // 3. Alphabetical by entity name/id
    const aName = String(a[prop] || '');
    const bName = String(b[prop] || '');
    return aName.localeCompare(bName);
  });
}

/**
 * Recursively normalizes an arbitrary CDP node without mutating original input.
 * @param {any} object
 * @param {boolean} alreadyExperimental
 * @returns {any}
 */
function normalizeNode(object, alreadyExperimental) {
  if (!object || typeof object !== 'object') {
    return object;
  }

  if (Array.isArray(object)) {
    return object.map((item) => normalizeNode(item, alreadyExperimental));
  }

  const result = /** @type {Record<string, any>} */ ({});
  const isSelfExperimental = Boolean(object.experimental);
  const childAlreadyExperimental = alreadyExperimental || isSelfExperimental;

  for (const [key, value] of Object.entries(object)) {
    // Avoid redundant experimental flag on children without mutating input
    if (key === 'experimental' && alreadyExperimental) {
      continue;
    }

    if (Array.isArray(value)) {
      result[key] = value.map((item) => normalizeNode(item, childAlreadyExperimental));
      sortCollection(result[key], nameProperty(key));
    } else {
      result[key] = normalizeNode(value, childAlreadyExperimental);
    }
  }

  return result;
}

/**
 * Normalizes protocol data by establishing empty array defaults and deterministic sorting.
 * Pure function: does NOT mutate input protocol object.
 *
 * @param {ProtocolRoot | { domains?: any[] }} protocol
 * @returns {NormalizedProtocolRoot} Normalized protocol clone
 */
export function normalizeProtocol(protocol) {
  if (!protocol || typeof protocol !== 'object') {
    return { domains: [] };
  }

  const normalized = normalizeNode(protocol, false);
  normalized.domains = normalized.domains || [];

  for (const domain of normalized.domains) {
    domain.commands = domain.commands || [];
    domain.events = domain.events || [];
    domain.types = domain.types || [];

    for (const event of domain.events) {
      event.parameters = event.parameters || [];
    }
    for (const command of domain.commands) {
      command.parameters = command.parameters || [];
      command.returns = command.returns || [];
    }
    for (const type of domain.types) {
      if (type.properties) {
        type.properties = type.properties || [];
      }
    }
  }

  return /** @type {NormalizedProtocolRoot} */ (normalized);
}

/**
 * Recursive, structurally unified deep clone filtering out anything with experimental === true.
 * Guarantees fresh copy with no shared references.
 *
 * @template T
 * @param {T} node
 * @returns {T} Fresh copy stripped of experimental entities
 */
export function stabilize(node) {
  if (typeof node !== 'object' || node === null) {
    return node;
  }

  if (Array.isArray(node)) {
    return /** @type {any} */ (
      node
        .filter((item) => !(item && typeof item === 'object' && item.experimental === true))
        .map((item) => stabilize(item))
    );
  }

  const result = /** @type {Record<string, any>} */ ({});
  for (const [key, value] of Object.entries(node)) {
    result[key] = stabilize(value);
  }

  return /** @type {T} */ (result);
}

/**
 * Helper to extract referenced type id from parameter/property object.
 * @param {string} domainName
 * @param {any} parameter
 * @returns {string|null}
 */
function getReferencedType(domainName, parameter) {
  if (!parameter || typeof parameter !== 'object') {
    return null;
  }
  if (parameter.$ref) {
    return parameter.$ref.includes('.') ? parameter.$ref : `${domainName}.${parameter.$ref}`;
  }
  if (parameter.type === 'array' && parameter.items) {
    return getReferencedType(domainName, parameter.items);
  }
  return null;
}

/**
 * Dynamically computes reverse references ("Used by") for every type across commands,
 * events, and types (properties and array items $ref).
 * Deduplicates and sorts references.
 *
 * @template {ProtocolDomain} D
 * @param {Array<D>} domains
 * @returns {Array<D>} The domains array with type.referencedBy populated
 */
export function computeBackReferences(domains) {
  if (!Array.isArray(domains)) return [];

  const typeidToType = new Map();
  for (const domain of domains) {
    for (const type of domain.types || []) {
      type.referencedBy = [];
      typeidToType.set(`${domain.domain}.${type.id}`, type);
    }
  }

  /**
   * @param {string} domainName
   * @param {any} arg
   * @param {'command' | 'event' | 'type'} type
   * @param {string} name
   */
  const addRef = (domainName, arg, type, name) => {
    const typeId = getReferencedType(domainName, arg);
    const referencedType = typeidToType.get(typeId);
    if (referencedType) {
      referencedType.referencedBy.push({ type, name });
    }
  };

  for (const domain of domains) {
    const domainName = domain.domain;

    for (const command of domain.commands || []) {
      const args = [...(command.parameters || []), ...(command.returns || [])];
      for (const arg of args) {
        addRef(domainName, arg, 'command', `${domainName}.${command.name}`);
      }
    }

    for (const event of domain.events || []) {
      for (const arg of event.parameters || []) {
        addRef(domainName, arg, 'event', `${domainName}.${event.name}`);
      }
    }

    for (const type of domain.types || []) {
      for (const prop of type.properties || []) {
        addRef(domainName, prop, 'type', `${domainName}.${type.id}`);
      }
      if (type.items) {
        addRef(domainName, type.items, 'type', `${domainName}.${type.id}`);
      }
    }
  }

  for (const type of typeidToType.values()) {
    const map = new Map();
    for (const reference of type.referencedBy) {
      map.set(reference.name, reference);
    }
    type.referencedBy = Array.from(map.values());
    type.referencedBy.sort((/** @type {{name: string}} */ a, /** @type {{name: string}} */ b) =>
      a.name.localeCompare(b.name),
    );
  }

  return domains;
}

const ROUTE_BASE_URL = 'https://cdp.internal';

const legacyAnchorPattern = new URLPattern({ hash: ':prefix(method|type|event)-:member' });

const legacyPathPattern = new URLPattern({
  pathname:
    '{/:repo(devtools-protocol|debugger-protocol-viewer)}?/:target(tot|v8|1-3|1-2|stable)/:domain{/}*',
  baseURL: ROUTE_BASE_URL,
});

const hashTargetMemberPattern = new URLPattern({
  hash: '#/:target(tot|v8|1-3|1-2|stable)/:domain.:member',
});
const hashTargetDomainPattern = new URLPattern({
  hash: '#/:target(tot|v8|1-3|1-2|stable)/:domain{/}*',
});
const hashTargetOnlyPattern = new URLPattern({ hash: '#/:target(tot|v8|1-3|1-2|stable){/}*' });

const hashMemberPattern = new URLPattern({ hash: '#/:domain.:member' });
const hashDomainPattern = new URLPattern({ hash: '#/:domain{/}*' });

const queryMemberPattern = new URLPattern({ search: '?:domain.:member' });
const queryDomainPattern = new URLPattern({ search: '?:domain' });

/**
 * Parses any incoming route variant into a canonical RouteInfo object using standard URLPattern.
 *
 * Supported route structures:
 * - Modern hash routes: #/Page.navigate, #/Page, #/v8/Runtime.evaluate, #/stable/Network.getCookies
 * - Legacy paths: /tot/Page/#method-navigate, /1-3/Page/#method-navigate, /1-2/Network/
 * - Base-path prefixed: /devtools-protocol/tot/Page/#method-navigate, /debugger-protocol-viewer/tot/Page/#method-navigate
 * - Isolated legacy anchors: #method-navigate, #type-Node, #event-requestWillBeSent
 * - Query format: ?Page.navigate, ?Network
 *
 * @param {string|null} [routeString]
 * @returns {RouteInfo}
 */
export function parseRoute(routeString) {
  if (!routeString || typeof routeString !== 'string') {
    return { target: 'tot', domain: null, member: null };
  }

  const trimmed = routeString.trim();
  if (!trimmed || trimmed === '#' || trimmed === '#/' || trimmed === '/') {
    return { target: 'tot', domain: null, member: null };
  }

  const url =
    trimmed.startsWith('#') || trimmed.startsWith('?') || trimmed.startsWith('/')
      ? new URL(trimmed, ROUTE_BASE_URL)
      : new URL('/' + trimmed, ROUTE_BASE_URL);

  const legacyAnchorMatch = legacyAnchorPattern.exec(url);
  const legacyMember = legacyAnchorMatch?.hash.groups.member ?? null;

  const legacyPathMatch = legacyPathPattern.exec(url);
  if (
    legacyPathMatch?.pathname.groups.domain &&
    !legacyPathMatch.pathname.groups.domain.endsWith('.html')
  ) {
    return {
      target: normalizeTarget(legacyPathMatch.pathname.groups.target),
      domain: legacyPathMatch.pathname.groups.domain,
      member: legacyMember,
    };
  }

  if (legacyMember) {
    return { target: 'tot', domain: null, member: legacyMember };
  }

  const htm = hashTargetMemberPattern.exec(url);
  if (htm?.hash.groups.domain && htm.hash.groups.member) {
    return {
      target: normalizeTarget(htm.hash.groups.target),
      domain: htm.hash.groups.domain,
      member: htm.hash.groups.member,
    };
  }

  const htd = hashTargetDomainPattern.exec(url);
  if (htd?.hash.groups.domain) {
    return {
      target: normalizeTarget(htd.hash.groups.target),
      domain: htd.hash.groups.domain,
      member: null,
    };
  }

  const hto = hashTargetOnlyPattern.exec(url);
  if (hto?.hash.groups.target) {
    return {
      target: normalizeTarget(hto.hash.groups.target),
      domain: null,
      member: null,
    };
  }

  const hm = hashMemberPattern.exec(url);
  if (hm?.hash.groups.domain && hm.hash.groups.member) {
    return {
      target: 'tot',
      domain: hm.hash.groups.domain,
      member: hm.hash.groups.member,
    };
  }

  const hd = hashDomainPattern.exec(url);
  if (hd?.hash.groups.domain) {
    return {
      target: 'tot',
      domain: hd.hash.groups.domain,
      member: null,
    };
  }

  const qm = queryMemberPattern.exec(url);
  if (qm?.search.groups.domain && qm.search.groups.member) {
    return {
      target: 'tot',
      domain: qm.search.groups.domain,
      member: qm.search.groups.member,
    };
  }

  const qd = queryDomainPattern.exec(url);
  if (qd?.search.groups.domain) {
    return {
      target: 'tot',
      domain: qd.search.groups.domain,
      member: null,
    };
  }

  return { target: 'tot', domain: null, member: null };
}

/**
 * Formats canonical hash route from components.
 * @param {{ target?: string|null, domain?: string|null, member?: string|null }} [route]
 * @returns {string} Canonical hash route, e.g. '#/Page.navigate'
 */
export function formatRoute({ target = 'tot', domain = null, member = null } = {}) {
  const normTarget = normalizeTarget(target);
  const targetPrefix = normTarget === 'tot' ? '' : `${normTarget}/`;

  if (!domain) {
    return normTarget === 'tot' ? '#/' : `#/${targetPrefix}`;
  }
  if (member) {
    return `#/${targetPrefix}${domain}.${member}`;
  }
  return `#/${targetPrefix}${domain}`;
}
