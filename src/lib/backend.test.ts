import assert from 'node:assert/strict';
import test from 'node:test';
import { createCampaignName } from './backend';

test('createCampaignName normalizes text into a stable slug', () => {
  assert.equal(createCampaignName('Sir Rowan', 'Fantasy'), 'sir-rowan-fantasy');
  assert.equal(createCampaignName('  $$$  ', 'Horror'), 'horror');
});
