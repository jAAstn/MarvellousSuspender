import { describe, it, expect } from 'vitest';
import { gsUtils } from '../src/js/gsUtils.js';

// The suspended page's top bar shows the original url without scheme, query and a
// trailing slash. `suspended.js` renders that string with textContent (the url comes
// from the hash, which any web page can set), so these cases pin the shortening itself:
// what used to be `cleanUrl()` in suspended.js must keep producing the same text.
describe('gsUtils.cleanUrlForDisplay', () => {
  it.each([
    ['https://example.com/', 'example.com'],
    ['https://example.com', 'example.com'],
    ['http://example.com/path', 'example.com/path'],
    ['https://example.com/path/', 'example.com/path'],
    ['https://example.com/path/?q=1', 'example.com/path'],
    ['https://example.com/path?q=1#section', 'example.com/path'],
    ['https://example.com/path#section', 'example.com/path'],
    ['https://example.com:8080/a/b', 'example.com:8080/a/b'],
    ['https://www.example.com/a?b=c&d=e', 'www.example.com/a'],
    ['file:///Users/me/doc.html', '/Users/me/doc.html'],
    ['chrome-extension://abcdef/suspended.html#uri=x', 'abcdef/suspended.html'],
    ['example.com/no-scheme', 'example.com/no-scheme'],
    ['about:blank', 'about:blank'],
  ])('%s -> %s', (url, expected) => {
    expect(gsUtils.cleanUrlForDisplay(url)).toBe(expected);
  });

  it('returns an empty string for a missing url instead of throwing', () => {
    expect(gsUtils.cleanUrlForDisplay('')).toBe('');
    expect(gsUtils.cleanUrlForDisplay(undefined)).toBe('');
    expect(gsUtils.cleanUrlForDisplay(null)).toBe('');
  });

  // Shortening is not escaping. An injected '<' must survive as a character here and be
  // neutralised by textContent at the render site; if this helper ever started returning
  // HTML, the display path would be trusting it to do a renderer's job.
  it('leaves markup characters in the string unchanged', () => {
    expect(gsUtils.cleanUrlForDisplay('https://example.com/<img src=x>'))
      .toBe('example.com/<img src=x>');
  });
});
