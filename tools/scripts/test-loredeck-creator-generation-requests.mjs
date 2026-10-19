import assert from 'node:assert/strict';
import {
  createLoredeckCreatorGenerationRequestHandlers,
  isLoredeckCreatorBriefRetryableError,
} from '../../src/loredecks/loredeck-creator-generation-requests.js';

function createMockHandlers(script = []) {
  const calls = [];
  const handlers = createLoredeckCreatorGenerationRequestHandlers({
    sendLoreRequest: async (systemPrompt, userPrompt, options) => {
      calls.push({ systemPrompt, userPrompt, options });
      const next = script.length ? script.shift() : { ok: true };
      if (next instanceof Error) throw next;
      return next;
    },
  });
  return { handlers, calls };
}

assert.equal(isLoredeckCreatorBriefRetryableError(new Error('Provider hit the response token limit.')), true);
assert.equal(isLoredeckCreatorBriefRetryableError(new Error('reasoning-only output with empty visible content')), true);
assert.equal(isLoredeckCreatorBriefRetryableError(new Error('Provider configuration missing')), false);

{
  const progress = [];
  const { handlers, calls } = createMockHandlers([
    new Error('Provider hit the response token limit.'),
    { text: '{"brief":{"title":"Arlong Park"}}' },
  ]);
  const result = await handlers.requestLoredeckCreatorBriefResponse(
    { fandom: 'One Piece', scope: 'Arlong Park' },
    { stream: true, onProgress: event => progress.push(event) },
  );

  assert.deepEqual(result, { text: '{"brief":{"title":"Arlong Park"}}' });
  assert.equal(calls.length, 2, 'Retryable brief failures should trigger one compact retry.');
  assert.equal(calls[0].options.providerKind, 'lore');
  assert.equal(calls[0].options.maxTokens, 2048);
  assert.equal(calls[0].options.expectedOutput, 'json');
  assert(calls[1].systemPrompt.includes('RETRY MODE:'), 'Retry prompt should include the compact retry mode.');
  assert(calls[1].userPrompt.includes('Return the compact scope brief now.'), 'Brief retry should force a compact final JSON answer.');
  assert.deepEqual(progress[0], {
    type: 'phase',
    phase: 'retry',
    message: 'Retrying compact scope brief after empty or oversized response...',
    streamSupported: true,
  });
}

{
  const { handlers, calls } = createMockHandlers([new Error('Provider configuration missing')]);
  await assert.rejects(
    () => handlers.requestLoredeckCreatorOutlineResponse({ brief: { title: 'Arc' } }),
    /Provider configuration missing/,
    'Non-retryable provider errors should not be masked by retry prompts.',
  );
  assert.equal(calls.length, 1);
}

{
  const { handlers, calls } = createMockHandlers([{ text: '{"titleDrafts":[]}' }]);
  await handlers.requestLoredeckCreatorTitleResponse({ titlePassLimit: 5 });
  assert.equal(calls[0].options.maxTokens, 4096);
  assert.equal(calls[0].options.expectedOutput, 'json');
}

{
  const { handlers, calls } = createMockHandlers([
    new Error('truncated response'),
    { text: '{"titleDrafts":[]}' },
  ]);
  await handlers.requestLoredeckCreatorTitleResponse({ titlePassLimit: 99 });
  assert.equal(calls.length, 2);
  assert(calls[1].systemPrompt.includes('Generate at most 12 titles'), 'Title retry limits should be clamped to the stage maximum.');
}

{
  const { handlers, calls } = createMockHandlers([{ text: '{"proposals":[]}' }]);
  await handlers.requestLoredeckCreatorEntryResponse({ targetTitleDrafts: [] });
  assert.equal(calls[0].options.maxTokens, 8192);
  assert.equal(calls[0].options.expectedOutput, 'json');
}

{
  const progress = [];
  const longMalformed = `{"broken":"${'x'.repeat(9500)}"}`;
  const { handlers, calls } = createMockHandlers([{ text: '{"proposals":[]}' }]);
  await handlers.repairLoredeckCreatorPlanningResponse(
    longMalformed,
    {
      generatedPackId: 'one-piece-generated',
      proposalLimit: 99,
      approvedTitleDrafts: Array.from({ length: 30 }, (_, index) => ({ titleId: `title-${index + 1}` })),
      existingTimelineIds: Array.from({ length: 140 }, (_, index) => `anchor-${index + 1}`),
      existingTagIds: Array.from({ length: 180 }, (_, index) => `tag-${index + 1}`),
    },
    { onProgress: event => progress.push(event) },
  );

  const request = calls[0];
  const payload = JSON.parse(request.userPrompt);
  assert.equal(request.options.maxTokens, 2048);
  assert.equal(request.options.expectedOutput, 'json');
  assert.equal(payload.sourceInputs.proposalLimit, 24);
  assert.equal(payload.sourceInputs.approvedTitleDrafts.length, 24);
  assert.equal(payload.sourceInputs.existingTimelineIds.length, 120);
  assert.equal(payload.sourceInputs.existingTagIds.length, 160);
  assert.equal(payload.limits.proposals, 24);
  assert(payload.malformedResponse.length <= 9003, 'Planning repair payload should bound malformed response text.');
  assert(payload.malformedResponse.endsWith('...'), 'Truncated malformed response text should make truncation visible.');
  assert.deepEqual(progress[0], {
    type: 'phase',
    phase: 'repairing',
    message: 'Repairing malformed Context and Tag plan into compact Deck Maker JSON...',
    streamSupported: false,
  });
}

{
  const { handlers, calls } = createMockHandlers([{ text: '{"proposals":[]}' }]);
  await handlers.repairLoredeckCreatorEntryResponse(
    '{"broken":true}',
    {
      entryBatchLimit: 20,
      targetTitleDrafts: Array.from({ length: 8 }, (_, index) => ({ titleId: `target-${index + 1}` })),
      existingEntryIds: Array.from({ length: 200 }, (_, index) => `entry-${index + 1}`),
    },
  );

  const payload = JSON.parse(calls[0].userPrompt);
  assert.equal(calls[0].options.maxTokens, 4096);
  assert.equal(payload.sourceInputs.targetTitleDrafts.length, 6);
  assert.equal(payload.sourceInputs.existingEntryIds.length, 160);
  assert.equal(payload.limits.proposals, 6);
  assert.equal(payload.limits.upsertEntriesOnly, true);
}

// Context-fit rules must survive both transport retries and JSON repair.
for (const stage of ['Planning', 'Entry']) {
  const { handlers, calls } = createMockHandlers([new Error('truncated response'), { text: '{}' }, { text: '{}' }]);
  const context = {
    approvedTitleDrafts: [{ titleId: 'early-gate', contextHint: 'Early gate' }],
    targetTitleDrafts: [{ titleId: 'early-gate', contextHint: 'Early gate', allowedAnchorIds: ['late-reunion'] }],
    timelineRegistry: { anchors: [{ id: 'late-reunion', label: 'Late reunion' }], windows: [] },
  };
  const before = structuredClone(context);
  await handlers[`requestLoredeckCreator${stage}Response`](context);
  await handlers[`repairLoredeckCreator${stage}Response`]('{"proposals":', context);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.match(call.systemPrompt, /contextHint/);
    assert.match(call.systemPrompt, /empty proposals array/);
    if (stage === 'Entry') {
      assert.match(call.systemPrompt, /existence allowlist, not evidence of relevance/);
      assert.match(call.systemPrompt, /Never make a time-dependent fact or reveal global/);
      assert.match(call.systemPrompt, /takes precedence over producing one card per title/);
    } else {
      assert.match(call.systemPrompt, /compactness must not remove required timing coverage/);
    }
    const payload = JSON.parse(call.userPrompt);
    const inputs = payload.sourceInputs || payload;
    assert.equal((inputs.targetTitleDrafts || inputs.approvedTitleDrafts)[0].contextHint, 'Early gate');
  }
  assert.deepEqual(context, before, 'Prompt construction must not change the saved authoring input.');
}

console.log('Deck Maker generation request tests passed.');
