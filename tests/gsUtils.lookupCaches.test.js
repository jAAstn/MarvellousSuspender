import { describe, it, expect } from 'vitest';
import { gsUtils } from '../src/js/gsUtils.js';
import { EXTENSION_ID } from './setup/chrome-stub.js';

// The whitelist / always-suspend lookups cache their split lists and compiled regexes, and
// the suspended-url hash parser caches the last parsed url. A cache keyed wrongly, or one
// that survives a list edit, would change which tabs suspend, so these tests exercise the
// behaviour across repeated and alternating calls rather than the cache itself.

const URL_A = 'https://example.com/some/page';
const URL_B = 'https://other.test/elsewhere';
const SUSPENDED = `chrome-extension://${EXTENSION_ID}/suspended.html`;

describe('gsUtils whitelist matching with cached parsing', () => {
  it('matches a plain substring', () => {
    expect(gsUtils.checkSpecificWhiteList(URL_A, 'example.com')).toBe(true);
  });

  it('does not match a substring the url does not contain', () => {
    expect(gsUtils.checkSpecificWhiteList(URL_A, 'other.test')).toBe(false);
  });

  it('matches a /regex/ entry', () => {
    expect(gsUtils.checkSpecificWhiteList(URL_A, '/^https:\\/\\/example\\.com/')).toBe(true);
  });

  it('treats an invalid /regex/ entry as no match', () => {
    expect(gsUtils.checkSpecificWhiteList(URL_A, '/[/')).toBe(false);
  });

  it('keeps the result of one pattern from being reused for another', () => {
    expect(gsUtils.checkSpecificWhiteList(URL_A, '/example\\.com/')).toBe(true);
    expect(gsUtils.checkSpecificWhiteList(URL_B, '/example\\.com/')).toBe(false);
    expect(gsUtils.checkSpecificWhiteList(URL_B, '/other\\.test/')).toBe(true);
    expect(gsUtils.checkSpecificWhiteList(URL_A, '/other\\.test/')).toBe(false);
  });

  it('re-reads a list that changed between two calls', () => {
    expect(gsUtils.checkSpecificWhiteList(URL_B, 'example.com')).toBe(false);
    expect(gsUtils.checkSpecificWhiteList(URL_B, 'other.test')).toBe(true);
    expect(gsUtils.checkSpecificWhiteList(URL_A, 'other.test')).toBe(false);
  });

  it('splits entries on spaces and newlines, and ignores an empty list', () => {
    expect(gsUtils.checkSpecificWhiteList(URL_A, 'one.test example.com')).toBe(true);
    expect(gsUtils.checkSpecificWhiteList(URL_A, 'one.test\nexample.com')).toBe(true);
    expect(gsUtils.checkSpecificWhiteList(URL_A, '')).toBe(false);
  });

  it('applies the same rules to the always-suspend list', () => {
    expect(gsUtils.checkSpecificAlwaysSuspendList(URL_A, '/example\\.com/')).toBe(true);
    expect(gsUtils.checkSpecificAlwaysSuspendList(URL_B, '/example\\.com/')).toBe(false);
    expect(gsUtils.checkSpecificAlwaysSuspendList(URL_B, '/[/')).toBe(false);
  });
});

describe('gsUtils.getHashVariable with the last-url cache', () => {
  const HASH_A = `${SUSPENDED}#ttl=Title%20A&pos=12&uri=https://a.test/page`;
  const HASH_B = `${SUSPENDED}#ttl=Title%20B&pos=34&uri=https://b.test/page?x=1&y=2`;

  it('returns the values of two urls in turn, and of the first again', () => {
    expect(gsUtils.getHashVariable('pos', HASH_A)).toBe('12');
    expect(gsUtils.getHashVariable('pos', HASH_B)).toBe('34');
    expect(gsUtils.getHashVariable('pos', HASH_A)).toBe('12');
    expect(gsUtils.getHashVariable('uri', HASH_B)).toBe('https://b.test/page?x=1&y=2');
  });

  it('still returns false for a key the url does not carry', () => {
    expect(gsUtils.getHashVariable('missing', HASH_A)).toBe(false);
    expect(gsUtils.getHashVariable('missing', HASH_A)).toBe(false);
  });

  it('returns false for a url without a hash', () => {
    expect(gsUtils.getHashVariable('ttl', 'https://example.com/page')).toBe(false);
    expect(gsUtils.getHashVariable('ttl', HASH_A)).toBe('Title%20A');
  });
});

describe('gsUtils.contains', () => {
  it('finds a value and reports a missing one', () => {
    expect(gsUtils.contains(['a', 0, false], 0)).toBe(true);
    expect(gsUtils.contains(['a', 'b'], 'c')).toBe(false);
    expect(gsUtils.contains([], 'a')).toBe(false);
  });
});
