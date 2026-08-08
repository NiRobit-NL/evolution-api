import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProfilePictureUrlFetcher,
  resolveProfilePictureUrl,
} from '../src/api/integrations/channel/whatsapp/profile-picture';

test('uses the preview avatar without requesting the full image', async () => {
  const calls: Array<{ type: string; timeoutMs: number }> = [];
  const fetchUrl: ProfilePictureUrlFetcher = async (_jid, type, timeoutMs) => {
    calls.push({ type, timeoutMs });
    return 'https://example.test/preview.jpg';
  };

  const result = await resolveProfilePictureUrl(fetchUrl, '31612345678@s.whatsapp.net');

  assert.equal(result, 'https://example.test/preview.jpg');
  assert.deepEqual(calls, [{ type: 'preview', timeoutMs: 5_000 }]);
});

test('falls back to the full image within the remaining timeout budget', async () => {
  const calls: Array<{ type: string; timeoutMs: number }> = [];
  const fetchUrl: ProfilePictureUrlFetcher = async (_jid, type, timeoutMs) => {
    calls.push({ type, timeoutMs });
    if (type === 'preview') throw new Error('preview unavailable');
    return 'https://example.test/full.jpg';
  };
  const times = [1_000, 2_250];

  const result = await resolveProfilePictureUrl(
    fetchUrl,
    '31612345678@s.whatsapp.net',
    5_000,
    () => times.shift() ?? 2_250,
  );

  assert.equal(result, 'https://example.test/full.jpg');
  assert.deepEqual(calls, [
    { type: 'preview', timeoutMs: 5_000 },
    { type: 'image', timeoutMs: 3_750 },
  ]);
});

test('does not start a second query after the timeout budget is exhausted', async () => {
  let calls = 0;
  const fetchUrl: ProfilePictureUrlFetcher = async () => {
    calls += 1;
    throw new Error('unavailable');
  };
  const times = [1_000, 6_000];

  const result = await resolveProfilePictureUrl(
    fetchUrl,
    '31612345678@s.whatsapp.net',
    5_000,
    () => times.shift() ?? 6_000,
  );

  assert.equal(result, null);
  assert.equal(calls, 1);
});
