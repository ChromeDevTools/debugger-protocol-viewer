/**
 * @fileoverview Protocol Model - Isomorphic pure functions for CDP protocols.
 * Browser-agnostic, zero-DOM ES module.
 */

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
 * @returns {'tot'|'stable'|'v8'}
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
 * @param {Array<Object>} items
 * @param {string|null} prop
 */
function sortCollection(items, prop) {
  if (!prop) return;
  items.sort((a, b) => {
    // 1. Standard (0) before Experimental (1) before Deprecated (2)
    const aRank = a.deprecated ? 2 : (a.experimental ? 1 : 0);
    const bRank = b.deprecated ? 2 : (b.experimental ? 1 : 0);
    if (aRank !== bRank) return aRank - bRank;

    // 2. Required before optional
    const aOpt = a.optional ? 1 : 0;
    const bOpt = b.optional ? 1 : 0;
    if (aOpt !== bOpt) return aOpt - bOpt;

    // 3. Alphabetical by entity name
    if (!a[prop] || !b[prop]) return 0;
    return a[prop].localeCompare(b[prop]);
  });
}

/**
 * Recursive normalization helper creating a fresh object without mutating input.
 * @param {*} object
 * @param {boolean} alreadyExperimental
 * @returns {*}
 */
function normalizeNode(object, alreadyExperimental) {
  if (typeof object !== 'object' || object === null) {
    return object;
  }

  if (Array.isArray(object)) {
    return object.map(item => normalizeNode(item, alreadyExperimental));
  }

  const result = {};
  const isSelfExperimental = Boolean(object.experimental);
  const childAlreadyExperimental = alreadyExperimental || isSelfExperimental;

  for (const [key, value] of Object.entries(object)) {
    // Avoid redundant experimental flag on children without mutating input
    if (key === 'experimental' && alreadyExperimental) {
      continue;
    }

    if (Array.isArray(value)) {
      result[key] = value.map(item => normalizeNode(item, childAlreadyExperimental));
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
 * @param {Object} protocol
 * @returns {Object} Normalized protocol clone
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
      event.returns = event.returns || [];
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

  return normalized;
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
    return node
      .filter(item => !(item && typeof item === 'object' && item.experimental === true))
      .map(item => stabilize(item));
  }

  const result = {};
  for (const [key, value] of Object.entries(node)) {
    result[key] = stabilize(value);
  }

  return result;
}

/**
 * Helper to extract referenced type id from parameter/property object.
 * @param {string} domainName
 * @param {Object} parameter
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
 * @param {Array<Object>} domains
 * @returns {Array<Object>} The domains array with type.referencedBy populated
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

  for (const domain of domains) {
    const domainName = domain.domain;

    for (const command of domain.commands || []) {
      const args = [...(command.parameters || []), ...(command.returns || [])];
      for (const arg of args) {
        const typeId = getReferencedType(domainName, arg);
        const referencedType = typeidToType.get(typeId);
        if (referencedType) {
          referencedType.referencedBy.push({
            type: 'command',
            name: `${domainName}.${command.name}`,
          });
        }
      }
    }

    for (const event of domain.events || []) {
      const args = [...(event.parameters || []), ...(event.returns || [])];
      for (const arg of args) {
        const typeId = getReferencedType(domainName, arg);
        const referencedType = typeidToType.get(typeId);
        if (referencedType) {
          referencedType.referencedBy.push({
            type: 'event',
            name: `${domainName}.${event.name}`,
          });
        }
      }
    }

    for (const type of domain.types || []) {
      if (type.properties) {
        for (const prop of type.properties) {
          const typeId = getReferencedType(domainName, prop);
          const referencedType = typeidToType.get(typeId);
          if (referencedType) {
            referencedType.referencedBy.push({
              type: 'type',
              name: `${domainName}.${type.id}`,
            });
          }
        }
      }
      if (type.items) {
        const typeId = getReferencedType(domainName, type.items);
        const referencedType = typeidToType.get(typeId);
        if (referencedType) {
          referencedType.referencedBy.push({
            type: 'type',
            name: `${domainName}.${type.id}`,
          });
        }
      }
    }
  }

  for (const type of typeidToType.values()) {
    const map = new Map();
    for (const reference of type.referencedBy) {
      map.set(reference.name, reference);
    }
    type.referencedBy = Array.from(map.values());
    type.referencedBy.sort((a, b) => a.name.localeCompare(b.name));
  }

  return domains;
}

/**
 * Parses raw route string into canonical target, domain, and member components.
 * Supports modern hash routes, composite legacy paths, isolated legacy anchors, and query fallbacks.
 *
 * @param {string|null|undefined} routeString
 * @returns {{ target: 'tot'|'stable'|'v8', domain: string|null, member: string|null }}
 */
export function parseRoute(routeString) {
  if (!routeString || typeof routeString !== 'string') {
    return { target: 'tot', domain: null, member: null };
  }

  const trimmed = routeString.trim();
  if (!trimmed || trimmed === '#' || trimmed === '#/' || trimmed === '/') {
    return { target: 'tot', domain: null, member: null };
  }

  // Handle isolated legacy anchors: #method-foo, #event-bar, #type-baz
  const isolatedLegacyMatch = trimmed.match(/^#(?:method|type|event)-([\w-]+)$/);
  if (isolatedLegacyMatch) {
    return { target: 'tot', domain: null, member: isolatedLegacyMatch[1] };
  }

  const hashIndex = trimmed.indexOf('#');
  let pathPart = '';
  let hashPart = '';

  if (hashIndex !== -1) {
    pathPart = trimmed.slice(0, hashIndex);
    hashPart = trimmed.slice(hashIndex + 1);
  } else if (trimmed.startsWith('?')) {
    hashPart = trimmed.slice(1);
  } else {
    pathPart = trimmed;
  }

  // Check if hashPart is a legacy anchor like method-navigate
  const legacyHashMatch = hashPart.match(/^(?:method|type|event)-([\w-]+)$/);
  const legacyMember = legacyHashMatch ? legacyHashMatch[1] : null;

  const pathSegments = pathPart
    .split('/')
    .map(s => s.trim())
    .filter(s => Boolean(s) && !s.endsWith('.html'));

  // Filter out leading repository base path if present (e.g. /devtools-protocol/)
  if (pathSegments.length > 0 && pathSegments[0] === 'devtools-protocol') {
    pathSegments.shift();
  }

  // Composite legacy URLs: /tot/Page/#method-navigate, /1-3/Page/#method-navigate, /1-2/Network/
  if (pathSegments.length > 0) {
    let target = 'tot';
    let domain = null;

    const targetIndex = pathSegments.findIndex(s => TARGET_MAP.has(s.toLowerCase()));
    if (targetIndex !== -1) {
      target = normalizeTarget(pathSegments[targetIndex]);
      if (pathSegments.length > targetIndex + 1) {
        domain = pathSegments[targetIndex + 1];
      }
    } else {
      domain = pathSegments[0];
    }

    return { target, domain, member: legacyMember };
  }

  // Modern hash route or query format: e.g. /Page.navigate, /v8/Runtime.evaluate, Page.navigate, Page
  let cleanHash = hashPart;
  if (cleanHash.startsWith('/')) {
    cleanHash = cleanHash.slice(1);
  }
  if (!cleanHash) {
    return { target: 'tot', domain: null, member: null };
  }

  let target = 'tot';
  let targetAndRest = cleanHash;

  const slashIndex = cleanHash.indexOf('/');
  if (slashIndex !== -1) {
    const potentialTarget = cleanHash.slice(0, slashIndex).toLowerCase();
    if (TARGET_MAP.has(potentialTarget)) {
      target = normalizeTarget(potentialTarget);
      targetAndRest = cleanHash.slice(slashIndex + 1);
    }
  }

  // Strip trailing slashes from domain/member (e.g. #/Page/ -> Page)
  targetAndRest = targetAndRest.replace(/\/+$/, '');

  if (!targetAndRest) {
    return { target, domain: null, member: null };
  }

  const dotIndex = targetAndRest.indexOf('.');
  if (dotIndex !== -1) {
    const domain = targetAndRest.slice(0, dotIndex);
    const member = targetAndRest.slice(dotIndex + 1);
    return { target, domain, member: member || null };
  }

  return { target, domain: targetAndRest, member: null };
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
    return '#/';
  }
  if (member) {
    return `#/${targetPrefix}${domain}.${member}`;
  }
  return `#/${targetPrefix}${domain}`;
}
