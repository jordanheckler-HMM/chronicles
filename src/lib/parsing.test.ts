import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractStatsFromResponse,
  splitNarrativeAndChoices,
  stripChoicePrefix,
} from './parsing';

test('extractStatsFromResponse parses valid stats block and strips it from output', () => {
  const response =
    'You enter the dungeon.\n1. Open the door\n2. Hide\n3. Run\n{"health": 88, "weapon": "Dagger", "gold": 17}';

  const parsed = extractStatsFromResponse(response);

  assert.deepEqual(parsed.stats, {
    health: 88,
    weapon: 'Dagger',
    gold: 17,
  });
  assert.equal(parsed.cleanResponse.includes('{"health": 88'), false);
});

test('extractStatsFromResponse keeps text when stats json is invalid', () => {
  const response =
    'You enter the dungeon.\n{"health": "bad", "weapon": "Dagger", "gold": 17}';

  const parsed = extractStatsFromResponse(response);

  assert.equal(parsed.stats, null);
  assert.equal(parsed.cleanResponse, response);
});

test('splitNarrativeAndChoices separates numbered options', () => {
  const parsed = splitNarrativeAndChoices(
    'A shadow moves in the hall.\n1. Investigate\n2. Wait\n3. Retreat',
  );

  assert.equal(parsed.narrative, 'A shadow moves in the hall.');
  assert.deepEqual(parsed.choices, ['1. Investigate', '2. Wait', '3. Retreat']);
});

test('stripChoicePrefix trims standard choice prefix', () => {
  assert.equal(stripChoicePrefix('2.   Investigate the room'), 'Investigate the room');
});
