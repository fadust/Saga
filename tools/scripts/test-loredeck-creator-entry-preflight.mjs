import assert from 'node:assert/strict';

import {
  preflightLoredeckCreatorEntryTargets,
} from '../../src/loredecks/loredeck-creator-entry-preflight.js';
import {
  buildLoredeckCreatorEntryUserPrompt,
} from '../../src/loredecks/loredeck-assistant.js';

const tagRegistry = {
  schemaVersion: 1,
  tags: {
    'character:nami': { label: 'Nami' },
    'character:genzo': { label: 'Genzo' },
    'faction:arlong-pirates': { label: 'Arlong Pirates' },
  },
};

const timelineRegistry = {
  schemaVersion: 1,
  anchors: [
    { id: 'one-piece.arlong.occupation-begins', label: 'Occupation begins', sortKey: 10 },
    { id: 'one-piece.arlong.reneges-deal', label: 'Arlong reneges', sortKey: 40 },
  ],
  windows: [
    { id: 'one-piece.arlong.occupation-span', label: 'Occupation span' },
  ],
};

const preflight = preflightLoredeckCreatorEntryTargets({
  tagRegistry,
  timelineRegistry,
  targetTitles: [{
    titleId: 'genzos-vigil-over-cocoyashi',
    targetEntryId: 'genzos-vigil-over-cocoyashi',
    title: "Genzo's vigil over Cocoyashi",
    category: 'setting_community',
    tags: ['character:genzo', 'location:cocoyashi', 'Character Genzo'],
    coverageDimensionIds: ['village-suffering'],
  }, {
    titleId: 'nami-hides-the-deal',
    title: 'Nami hides the deal',
    tags: ['character:nami', 'faction:arlong-pirates'],
  }],
});

assert.equal(preflight.summary.targetCount, 2);
assert.equal(preflight.summary.acceptedTagCount, 3);
assert.equal(preflight.summary.omittedTagCount, 1);
assert.equal(preflight.summary.planningGapCount, 3);

const genzoTarget = preflight.targetTitleDrafts[0];
assert.deepEqual(genzoTarget.allowedEntryTags, ['character:genzo']);
assert.deepEqual(genzoTarget.tags, ['character:genzo']);
assert.deepEqual(genzoTarget.omittedTitleTags, ['location:cocoyashi']);
assert.deepEqual(genzoTarget.allowedAnchorIds, []);
assert.deepEqual(genzoTarget.allowedWindowIds, []);
assert.ok(genzoTarget.contextMappingError);
assert.equal(genzoTarget.preflightStatus, 'gaps');
assert.equal(genzoTarget.planningGaps[0].id, 'location:cocoyashi');

const namiTarget = preflight.targetTitleDrafts[1];
assert.deepEqual(namiTarget.allowedEntryTags, ['character:nami', 'faction:arlong-pirates']);
assert.deepEqual(namiTarget.omittedTitleTags, []);
assert.equal(namiTarget.preflightStatus, 'gaps');

assert.equal(preflight.diagnostics.length, 1);
assert.equal(preflight.diagnostics[0].targetEntryId, 'genzos-vigil-over-cocoyashi');
assert.equal(preflight.diagnostics[0].reasonCode, 'unknown_tag');
assert.deepEqual(preflight.diagnostics[0].unknownTags, ['location:cocoyashi']);

const prompt = JSON.parse(buildLoredeckCreatorEntryUserPrompt({
  generatedPackId: 'one-piece-arlong-park',
  targetTitleDrafts: preflight.targetTitleDrafts,
  targetPreflight: preflight.summary,
  targetPreflightDiagnostics: preflight.diagnostics,
  tagRegistry,
  timelineRegistry,
  entryBatchLimit: 2,
}));

assert.equal(prompt.constraints.useAllowedEntryTagsPerTargetOnly, true);
assert.equal(prompt.constraints.omittedTitleTagsAreForbidden, true);
assert.equal(prompt.targetPreflight.omittedTagCount, 1);
assert.equal(prompt.targetPreflightDiagnostics[0].reasonCode, 'unknown_tag');
assert.deepEqual(prompt.targetTitleDrafts[0].tags, ['character:genzo']);
assert.deepEqual(prompt.targetTitleDrafts[0].allowedEntryTags, ['character:genzo']);
assert.deepEqual(prompt.targetTitleDrafts[0].omittedTitleTags, ['location:cocoyashi']);
assert.equal(prompt.targetTitleDrafts[0].tags.includes('location:cocoyashi'), false);

const noRegistry = preflightLoredeckCreatorEntryTargets({
  targetTitles: [{
    titleId: 'open-registry-title',
    tags: ['location:cocoyashi'],
  }],
});
assert.deepEqual(noRegistry.targetTitleDrafts[0].allowedEntryTags, ['location:cocoyashi']);
assert.deepEqual(noRegistry.targetTitleDrafts[0].omittedTitleTags, []);

const timelinePreflight = preflightLoredeckCreatorEntryTargets({
  tagRegistry,
  timelineRegistry,
  targetTitles: [{
    titleId: 'explicit-timeline-title',
    title: 'Explicit timeline title',
    tags: ['character:nami'],
    timelineAnchorIds: [
      'one-piece.arlong.occupation-begins',
      'one-piece.arlong.reneges-deal',
      'one-piece.arlong.missing-anchor',
    ],
    timelineWindowIds: [
      'one-piece.arlong.occupation-span',
      'one-piece.arlong.missing-window',
    ],
  }],
});
const timelineTarget = timelinePreflight.targetTitleDrafts[0];
assert.equal(timelineTarget.timelineReferenceMode, 'explicit');
assert.deepEqual(timelineTarget.allowedAnchorIds, [
  'one-piece.arlong.occupation-begins',
  'one-piece.arlong.reneges-deal',
]);
assert.deepEqual(timelineTarget.allowedWindowIds, ['one-piece.arlong.occupation-span']);
assert.deepEqual(timelineTarget.omittedAnchorIds, ['one-piece.arlong.missing-anchor']);
assert.deepEqual(timelineTarget.omittedWindowIds, ['one-piece.arlong.missing-window']);
assert.equal(timelinePreflight.summary.omittedAnchorCount, 1);
assert.equal(timelinePreflight.summary.omittedWindowCount, 1);
assert.equal(timelinePreflight.summary.planningGapCount, 3);
assert.deepEqual(timelinePreflight.diagnostics.map(item => item.reasonCode), ['unknown_anchor', 'unknown_timeline_window']);

console.log('Deck Maker entry preflight tests passed.');
