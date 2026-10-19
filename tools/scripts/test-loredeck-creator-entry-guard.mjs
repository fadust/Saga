import assert from 'node:assert/strict';

import { buildLoredeckHealthForData } from '../../src/loredecks/loredeck-health-engine.js';
import {
  guardLoredeckCreatorEntryDraftChange,
  normalizeCreatorSchemaV3EntryOverride,
} from '../../src/loredecks/loredeck-creator-entry-guard.js';
import {
  applyLoredeckRecordPatch,
  configureLoredeckPendingChangeModel,
  createLoredeckRecordPatchChange,
} from '../../src/runtime/loredeck-pending-change-model.js';

function buildPack(entryOverrides = {}) {
  return {
    packId: 'creator-entry-guard-pack',
    type: 'generated',
    title: 'Creator Entry Guard Pack',
    entrySchemaVersion: 3,
    manifestData: {
      id: 'creator-entry-guard-pack',
      type: 'generated',
      title: 'Creator Entry Guard Pack',
      entrySchemaVersion: 3,
      files: [],
      registries: {
        timeline: 'timeline.json',
        tags: 'tags.json',
      },
      stats: { entryCount: Object.keys(entryOverrides).length },
    },
    entryOverrides,
    timelineRegistry: {
      schemaVersion: 1,
      timelineMode: 'hybrid',
      sortKeyScale: 'pack_local',
      anchors: [
        { id: 'arlong.start', label: 'Arlong starts pressuring Cocoyasi', sortKey: 10 },
        { id: 'arlong.end', label: 'Arlong betrays the buyback deal', sortKey: 20 },
      ],
      windows: [
        { id: 'arlong.pressure', label: 'Arlong pressure phase', anchorFrom: 'arlong.start', anchorTo: 'arlong.end', sortKeyFrom: 10, sortKeyTo: 20 },
      ],
    },
    tagRegistry: {
      schemaVersion: 1,
      tags: {
        'character:nami': { label: 'Nami' },
      },
    },
  };
}

function buildRawEntry(overrides = {}) {
  return {
    schemaVersion: 3,
    id: 'nami-secret',
    title: "Nami's Secret",
    kind: 'fact',
    category: 'secret',
    fact: 'Legacy top-level fact should move into content.',
    tags: ['characternami', 'fact', 'secret', 'other'],
    context: {
      scope: 'window',
      validFromAnchor: 'arlong.start',
      validToAnchor: 'arlong.end',
      sortKeyFrom: 10,
      sortKeyTo: 20,
      precision: 'anchor_window',
      windowKind: 'pressure_phase',
      label: 'Arlong pressure phase',
    },
    retrieval: {
      activation: 'context_or_topic',
      frequency: 'normal',
      contextBoost: 'high',
    },
    content: {
      fact: 'Nami hides her buyback deal from Arlong.',
      injection: 'When Nami or Arlong pressure is relevant, treat the thefts as cover for a hidden buyback plan.',
    },
    ...overrides,
  };
}

function buildChange(entry = buildRawEntry()) {
  return createLoredeckRecordPatchChange({
    source: 'loredeck_creator',
    action: 'creator_upsert_entry',
    targetKind: 'entry',
    title: `Deck Maker entry: ${entry.title}`,
    affectedEntryIds: [entry.id],
    payload: {
      entryOverrides: {
        [entry.id]: entry,
      },
      disabledEntryIdsRemove: [entry.id],
    },
  });
}

function assertCleanPackHealth(pack) {
  const health = buildLoredeckHealthForData({
    packId: pack.packId,
    manifest: pack.manifestData,
    entryFiles: [{
      file: '__creator_entry_guard__',
      schemaVersion: 3,
      entries: Object.values(pack.entryOverrides),
    }],
    timeline: pack.timelineRegistry,
    tagRegistry: pack.tagRegistry,
  });
  assert.equal(health.summary.errorCount, 0);
  assert.equal(health.summary.undefinedTagCount, 0);
  assert.equal(health.summary.brokenAnchorReferenceCount, 0);
  assert.equal(health.summary.schemaV3IssueCount, 0);
}

const pack = buildPack();
const guarded = guardLoredeckCreatorEntryDraftChange(pack, buildChange(), {
  targetEntryIds: new Set(['nami-secret']),
  targetTitleByEntryId: new Map([['nami-secret', { timelineWindowIds: ['arlong.pressure'] }]]),
});
assert.deepEqual(guarded.errors, []);
assert.equal(guarded.repaired, true);
const guardedEntry = guarded.change.payload.entryOverrides['nami-secret'];
assert.deepEqual(guardedEntry.tags, ['character:nami']);
assert.equal(Object.hasOwn(guardedEntry, 'fact'), false);
assert.ok(guarded.warnings.some(warning => warning.includes('Mapped compacted tag characternami to character:nami')));
assert.ok(guarded.warnings.some(warning => warning.includes('Dropped generic Lorecard tag fact')));
assertCleanPackHealth(buildPack({ 'nami-secret': guardedEntry }));

const unknownAnchor = guardLoredeckCreatorEntryDraftChange(pack, buildChange(buildRawEntry({
  context: {
    ...buildRawEntry().context,
    validToAnchor: 'arlong.end.deal',
  },
})), {
  targetEntryIds: new Set(['nami-secret']),
  targetTitleByEntryId: new Map([['nami-secret', { timelineWindowIds: ['arlong.pressure'] }]]),
});
assert.equal(unknownAnchor.change, null);
assert.ok(unknownAnchor.errors.some(error => error.includes('Unknown validToAnchor arlong.end.deal')));

const unknownTag = guardLoredeckCreatorEntryDraftChange(pack, buildChange(buildRawEntry({
  tags: ['character:unknown'],
})), {
  targetEntryIds: new Set(['nami-secret']),
  targetTitleByEntryId: new Map([['nami-secret', { timelineWindowIds: ['arlong.pressure'] }]]),
});
assert.equal(unknownTag.change, null);
assert.ok(unknownTag.errors.some(error => error.includes('Unknown tag character:unknown')));

const omittedTitleTag = guardLoredeckCreatorEntryDraftChange(pack, buildChange(buildRawEntry({
  tags: ['character:nami', 'location:cocoyashi'],
})), {
  targetEntryIds: new Set(['nami-secret']),
  targetTitleByEntryId: new Map([['nami-secret', { timelineWindowIds: ['arlong.pressure'] }]]),
  targetTitleByEntryId: new Map([[
    'nami-secret',
    {
      titleId: 'nami-secret',
      targetEntryId: 'nami-secret',
      omittedTitleTags: ['location:cocoyashi'],
      timelineWindowIds: ['arlong.pressure'],
    },
  ]]),
});
assert.deepEqual(omittedTitleTag.errors, []);
assert.ok(omittedTitleTag.change, 'omitted title-sourced unknown tags should not reject an otherwise valid draft');
assert.ok(omittedTitleTag.warnings.some(warning => warning.includes('Dropped omitted title tag location:cocoyashi before Draft Review')));
assert.deepEqual(omittedTitleTag.change.payload.entryOverrides['nami-secret'].tags, ['character:nami']);
assertCleanPackHealth(buildPack({ 'nami-secret': omittedTitleTag.change.payload.entryOverrides['nami-secret'] }));

const wrongTarget = guardLoredeckCreatorEntryDraftChange(pack, buildChange(), {
  targetEntryIds: new Set(['different-title']),
});
assert.equal(wrongTarget.change, null);
assert.ok(wrongTarget.errors.some(error => error.includes('outside this Deck Maker micro-batch')));

const missingContextLabel = guardLoredeckCreatorEntryDraftChange(pack, buildChange(buildRawEntry({
  context: {
    ...buildRawEntry().context,
    label: '',
  },
})), {
  targetEntryIds: new Set(['nami-secret']),
  targetTitleByEntryId: new Map([['nami-secret', { timelineWindowIds: ['arlong.pressure'] }]]),
});
assert.equal(missingContextLabel.change, null);
assert.ok(missingContextLabel.errors.some(error => error.includes('Missing context.label')));

const reversedContextSort = guardLoredeckCreatorEntryDraftChange(pack, buildChange(buildRawEntry({
  context: {
    ...buildRawEntry().context,
    sortKeyFrom: 30,
    sortKeyTo: 20,
  },
})), {
  targetEntryIds: new Set(['nami-secret']),
  targetTitleByEntryId: new Map([['nami-secret', { timelineWindowIds: ['arlong.pressure'] }]]),
});
assert.equal(reversedContextSort.change, null);
assert.ok(reversedContextSort.errors.some(error => error.includes('context.sortKeyFrom is after context.sortKeyTo')));

const missingRetrieval = guardLoredeckCreatorEntryDraftChange(pack, buildChange(buildRawEntry({
  retrieval: {
    activation: '',
    frequency: 'normal',
    contextBoost: 'high',
  },
})), {
  targetEntryIds: new Set(['nami-secret']),
  targetTitleByEntryId: new Map([['nami-secret', { timelineWindowIds: ['arlong.pressure'] }]]),
});
assert.equal(missingRetrieval.change, null);
assert.ok(missingRetrieval.errors.some(error => error.includes('Missing retrieval.activation')));

const missingContent = guardLoredeckCreatorEntryDraftChange(pack, buildChange(buildRawEntry({
  fact: '',
  content: {
    fact: '',
    injection: '',
  },
})), {
  targetEntryIds: new Set(['nami-secret']),
  targetTitleByEntryId: new Map([['nami-secret', { timelineWindowIds: ['arlong.pressure'] }]]),
});
assert.equal(missingContent.change, null);
assert.ok(missingContent.errors.some(error => error.includes('Missing content.fact')));
assert.ok(missingContent.errors.some(error => error.includes('Missing content.injection')));

configureLoredeckPendingChangeModel({
  normalizeLoredeckPatchEntryOverride: (record, rawEntry, id) => {
    const schemaVersion = Math.max(Number(rawEntry?.schemaVersion) || 0, Number(record?.entrySchemaVersion) || 0);
    return schemaVersion >= 3
      ? normalizeCreatorSchemaV3EntryOverride(record, rawEntry, id)
      : rawEntry;
  },
});

const acceptedPack = buildPack();
applyLoredeckRecordPatch(acceptedPack, buildChange(buildRawEntry()).payload);
const acceptedEntry = acceptedPack.entryOverrides['nami-secret'];
assert.equal(acceptedEntry.schemaVersion, 3);
assert.equal(Object.hasOwn(acceptedEntry, 'fact'), false);
assert.equal(Object.hasOwn(acceptedEntry, 'date'), false);
assert.deepEqual(acceptedEntry.tags, ['characternami', 'fact', 'secret', 'other']);

console.log('Deck Maker entry guard tests passed.');
