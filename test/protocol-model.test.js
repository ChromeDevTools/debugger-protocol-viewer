import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProtocol,
  stabilize,
  computeBackReferences,
  parseRoute,
  formatRoute,
  normalizeTarget,
} from '../src/protocol-model.js';

/** @import { TestContext } from 'node:test' */
/** @import { ProtocolDomain, ProtocolType } from '../src/types.d.ts' */

test('normalizeTarget', () => {
  assert.equal(normalizeTarget('tot'), 'tot');
  assert.equal(normalizeTarget('stable'), 'stable');
  assert.equal(normalizeTarget('1-3'), 'stable');
  assert.equal(normalizeTarget('1-2'), 'stable');
  assert.equal(normalizeTarget('v8'), 'v8');
  assert.equal(normalizeTarget(''), 'tot');
  assert.equal(normalizeTarget(null), 'tot');
  assert.equal(normalizeTarget('unknown'), 'tot');
});

test('normalizeProtocol: sets empty array defaults', () => {
  /** @type {any} */
  const raw = {
    domains: [
      {
        domain: 'Sample',
      },
    ],
  };

  const normalized = normalizeProtocol(raw);

  assert.deepEqual(normalized.domains[0]?.commands, []);
  assert.deepEqual(normalized.domains[0]?.events, []);
  assert.deepEqual(normalized.domains[0]?.types, []);

  // Assert input object was not mutated
  assert.equal(raw.domains[0].commands, undefined);
  assert.equal(raw.domains[0].events, undefined);
  assert.equal(raw.domains[0].types, undefined);
});

test('normalizeProtocol: deterministic sorting (experimental, deprecated, optional, alphabetical)', () => {
  const raw = {
    domains: [
      {
        domain: 'Alpha',
        commands: [
          { name: 'zetaExp', experimental: true },
          { name: 'beta' },
          { name: 'alpha' },
          { name: 'alphaDep', deprecated: true },
        ],
      },
    ],
  };

  const normalized = normalizeProtocol(raw);
  const commandNames = (normalized.domains[0]?.commands || []).map(
    (/** @type {{name: string}} */ c) => c.name,
  );

  // Standard alphabetical first, then experimental, then deprecated
  assert.deepEqual(commandNames, ['alpha', 'beta', 'zetaExp', 'alphaDep']);
});

test('normalizeProtocol: does NOT mutate input objects (delete object.experimental)', () => {
  const raw = {
    domains: [
      {
        domain: 'ExperimentalDomain',
        experimental: true,
        commands: [
          {
            name: 'expCommand',
            experimental: true,
          },
        ],
      },
    ],
  };

  const normalized = normalizeProtocol(raw);

  // In normalized output, redundant experimental flag on child is pruned
  assert.equal(normalized.domains[0]?.experimental, true);
  assert.equal(normalized.domains[0]?.commands[0]?.experimental, undefined);

  // Input object must retain experimental: true
  assert.equal(raw.domains[0].commands[0].experimental, true);
});

test('stabilize: deep immutability and filtering experimental entities', () => {
  const original = {
    domain: 'TestDomain',
    experimental: false,
    commands: [
      { name: 'stableCommand', experimental: false },
      { name: 'expCommand', experimental: true },
    ],
    types: [
      {
        id: 'StableType',
        properties: [
          { name: 'propA', experimental: false },
          { name: 'propB', experimental: true },
        ],
      },
      {
        id: 'ExpType',
        experimental: true,
      },
    ],
  };

  const stable = stabilize(original);

  // Commands filtered
  assert.equal(stable.commands.length, 1);
  assert.equal(stable.commands[0]?.name, 'stableCommand');

  // Types filtered
  assert.equal(stable.types.length, 1);
  assert.equal(stable.types[0]?.id, 'StableType');
  assert.equal(stable.types[0]?.properties?.length, 1);
  assert.equal(stable.types[0]?.properties?.[0]?.name, 'propA');

  // Deep clone immutability: mutating stable must not affect original
  stable.commands[0].name = 'MUTATED';
  stable.commands.push(/** @type {any} */ ({ name: 'NEW' }));
  assert.equal(original.commands[0]?.name, 'stableCommand');
  assert.equal(original.commands.length, 2);
});

test('computeBackReferences: computes reverse references with deduplication and array item $ref unpacking', () => {
  /** @type {ProtocolDomain[]} */
  const domains = [
    {
      domain: 'DOM',
      types: [
        { id: 'NodeId', type: 'integer' },
        { id: 'Node', type: 'object', properties: [{ name: 'nodeId', $ref: 'NodeId' }] },
        {
          id: 'NodeList',
          type: 'array',
          items: { $ref: 'Node' },
        },
      ],
      commands: [
        {
          name: 'describeNode',
          parameters: [{ name: 'nodeId', $ref: 'NodeId' }],
          returns: [{ name: 'node', $ref: 'Node' }],
        },
        {
          name: 'pushNodesByBackendIdsToFrontend',
          parameters: [{ name: 'backendNodeIds', $ref: 'NodeId' }],
          returns: [{ name: 'nodeIds', $ref: 'NodeId' }],
        },
      ],
      events: [
        {
          name: 'setChildNodes',
          parameters: [
            { name: 'parentId', $ref: 'NodeId' },
            {
              name: 'nodes',
              type: 'array',
              items: { $ref: 'Node' },
            },
          ],
        },
      ],
    },
  ];

  computeBackReferences(domains);

  const nodeIdType = domains[0]?.types?.find((t) => t.id === 'NodeId');
  const nodeType = domains[0]?.types?.find((t) => t.id === 'Node');

  // NodeId should be referenced by:
  // - DOM.describeNode (command)
  // - DOM.pushNodesByBackendIdsToFrontend (command - deduplicated across params and returns!)
  // - DOM.setChildNodes (event)
  // - DOM.Node (type)
  assert.ok(nodeIdType?.referencedBy);
  assert.deepEqual(
    nodeIdType?.referencedBy,
    [
      { type: 'command', name: 'DOM.describeNode' },
      { type: 'type', name: 'DOM.Node' },
      { type: 'command', name: 'DOM.pushNodesByBackendIdsToFrontend' },
      { type: 'event', name: 'DOM.setChildNodes' },
    ].sort((a, b) => a.name.localeCompare(b.name)),
  );

  // Node should be referenced by:
  // - DOM.describeNode (command return)
  // - DOM.NodeList (type items $ref)
  // - DOM.setChildNodes (event array items $ref)
  assert.ok(nodeType?.referencedBy);
  assert.deepEqual(
    nodeType?.referencedBy,
    [
      { type: 'command', name: 'DOM.describeNode' },
      { type: 'type', name: 'DOM.NodeList' },
      { type: 'event', name: 'DOM.setChildNodes' },
    ].sort((a, b) => a.name.localeCompare(b.name)),
  );
});

test('parseRoute: dynamic native subtests for all route formats', async (/** @type {TestContext} */ t) => {
  const cases = [
    // Standard modern hash routes
    {
      input: '#/Page.navigate',
      expected: { target: 'tot', domain: 'Page', member: 'navigate' },
    },
    {
      input: '#/Page',
      expected: { target: 'tot', domain: 'Page', member: null },
    },
    {
      input: '#/v8/Runtime.evaluate',
      expected: { target: 'v8', domain: 'Runtime', member: 'evaluate' },
    },
    {
      input: '#/stable/Network.getCookies',
      expected: { target: 'stable', domain: 'Network', member: 'getCookies' },
    },

    // Composite legacy URLs
    {
      input: '/tot/Page/#method-navigate',
      expected: { target: 'tot', domain: 'Page', member: 'navigate' },
    },
    {
      input: '/1-3/Page/#method-navigate',
      expected: { target: 'stable', domain: 'Page', member: 'navigate' },
    },
    {
      input: '/1-2/Network/',
      expected: { target: 'stable', domain: 'Network', member: null },
    },

    // Isolated legacy anchors
    {
      input: '#method-navigate',
      expected: { target: 'tot', domain: null, member: 'navigate' },
    },
    {
      input: '#type-Node',
      expected: { target: 'tot', domain: null, member: 'Node' },
    },
    {
      input: '#event-requestWillBeSent',
      expected: { target: 'tot', domain: null, member: 'requestWillBeSent' },
    },

    // Query format fallbacks
    {
      input: '?Page.navigate',
      expected: { target: 'tot', domain: 'Page', member: 'navigate' },
    },
    {
      input: '?Network',
      expected: { target: 'tot', domain: 'Network', member: null },
    },

    // Root and empty routes
    {
      input: '#/',
      expected: { target: 'tot', domain: null, member: null },
    },
    {
      input: '',
      expected: { target: 'tot', domain: null, member: null },
    },
    {
      input: '#',
      expected: { target: 'tot', domain: null, member: null },
    },
    {
      input: '/',
      expected: { target: 'tot', domain: null, member: null },
    },
    {
      input: '/index.html',
      expected: { target: 'tot', domain: null, member: null },
    },
    {
      input: '/tot/index.html',
      expected: { target: 'tot', domain: null, member: null },
    },

    // Base path prefix stripping (/devtools-protocol/)
    {
      input: '/devtools-protocol/',
      expected: { target: 'tot', domain: null, member: null },
    },
    {
      input: '/devtools-protocol/index.html',
      expected: { target: 'tot', domain: null, member: null },
    },
    {
      input: '/devtools-protocol/tot/Page/#method-navigate',
      expected: { target: 'tot', domain: 'Page', member: 'navigate' },
    },

    // Trailing slashes
    {
      input: '#/Page/',
      expected: { target: 'tot', domain: 'Page', member: null },
    },
    {
      input: '#/v8/Runtime/',
      expected: { target: 'v8', domain: 'Runtime', member: null },
    },
    {
      input: '#/v8',
      expected: { target: 'v8', domain: null, member: null },
    },
    {
      input: '#/v8/',
      expected: { target: 'v8', domain: null, member: null },
    },
    {
      input: '#/stable',
      expected: { target: 'stable', domain: null, member: null },
    },
    {
      input: '#/stable/',
      expected: { target: 'stable', domain: null, member: null },
    },
  ];

  for (const { input, expected } of cases) {
    await t.test(`parseRoute("${input}")`, () => {
      const result = parseRoute(input);
      assert.deepEqual(result, expected);
    });
  }
});

test('formatRoute: canonical route formatting', () => {
  // Tot target formats without prefix
  assert.equal(
    formatRoute({ target: 'tot', domain: 'Page', member: 'navigate' }),
    '#/Page.navigate',
  );
  assert.equal(formatRoute({ target: 'tot', domain: 'Page', member: null }), '#/Page');
  assert.equal(formatRoute({ target: 'tot', domain: null, member: null }), '#/');

  // V8 target formats with v8/ prefix
  assert.equal(
    formatRoute({ target: 'v8', domain: 'Runtime', member: 'evaluate' }),
    '#/v8/Runtime.evaluate',
  );
  assert.equal(formatRoute({ target: 'v8', domain: 'Runtime', member: null }), '#/v8/Runtime');
  assert.equal(formatRoute({ target: 'v8', domain: null, member: null }), '#/v8/');

  // Stable target formats with stable/ prefix
  assert.equal(
    formatRoute({ target: 'stable', domain: 'Network', member: 'getCookies' }),
    '#/stable/Network.getCookies',
  );
  assert.equal(
    formatRoute({ target: 'stable', domain: 'Network', member: null }),
    '#/stable/Network',
  );
  assert.equal(formatRoute({ target: 'stable', domain: null, member: null }), '#/stable/');

  // Default options
  assert.equal(formatRoute(), '#/');
});
