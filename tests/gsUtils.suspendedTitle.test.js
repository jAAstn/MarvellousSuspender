import { describe, it, expect } from 'vitest';
import { gsUtils } from '../src/js/gsUtils.js';

// A title with `<` used to be htmlEncode()d before rendering, which showed `&lt;`.
// These cases pin the replacement: the raw characters reach textContent, and the
// helper must never fall back to innerHTML (the setter throws if it does).
function textElement() {
  const el = { textContent: '' };
  Object.defineProperty(el, 'innerHTML', {
    get() {
      throw new Error('innerHTML must not be read for a suspended title');
    },
    set() {
      throw new Error('innerHTML must not be written for a suspended title');
    },
  });
  return el;
}

function fakeDocument() {
  const elements = {
    gsTitle: textElement(),
    gsTopBarTitle: textElement(),
  };
  return {
    title: '',
    elements,
    getElementById: (id) => elements[id] ?? null,
  };
}

describe('gsUtils.setSuspendedPageTitle', () => {
  it('keeps a less-than sign literal instead of entity-encoding it', () => {
    const doc = fakeDocument();
    const title = '1 < 2 und <script>alert(1)</script>';

    const topBarTitle = gsUtils.setSuspendedPageTitle(doc, title);

    expect(topBarTitle).toBe(doc.elements.gsTopBarTitle);
    expect(doc.title).toBe(title);
    expect(doc.elements.gsTitle.textContent).toBe(title);
    expect(doc.elements.gsTopBarTitle.textContent).toBe(title);
    expect(doc.elements.gsTitle.textContent).not.toContain('&lt;');
  });

  it('does not decode an ampersand entity in the title', () => {
    const doc = fakeDocument();
    const title = 'Tom &amp; Jerry';

    gsUtils.setSuspendedPageTitle(doc, title);

    expect(doc.elements.gsTitle.textContent).toBe('Tom &amp; Jerry');
  });

  it('still sets document.title when the visible elements are absent', () => {
    const doc = { title: '', getElementById: () => null };

    expect(gsUtils.setSuspendedPageTitle(doc, '<3')).toBe(null);
    expect(doc.title).toBe('<3');
  });

  it('treats a missing title as an empty string', () => {
    const doc = fakeDocument();

    gsUtils.setSuspendedPageTitle(doc, undefined);

    expect(doc.title).toBe('');
    expect(doc.elements.gsTitle.textContent).toBe('');
  });
});
