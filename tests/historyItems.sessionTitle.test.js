import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { historyItems } from '../src/js/historyItems.js';
import { gsSession } from '../src/js/gsSession.js';
import { gsUtils } from '../src/js/gsUtils.js';

// The suite runs with environment: 'node' and no DOM dependency. This is the smallest
// double that createSessionHtml() actually touches: elements with attributes/children
// and textContent. innerHTML throws, so a fallback to markup fails the test instead
// of passing silently.
class FakeNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this._text = '';
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this._text = value;
    this.children = [];
  }

  get innerHTML() {
    throw new Error('innerHTML must not be read by createSessionHtml');
  }

  set innerHTML(_value) {
    throw new Error('innerHTML must not be written by createSessionHtml');
  }
}

const savedSession = (name, windowTabCounts) => ({
  sessionId: 'saved-session',
  name,
  date: '2026-10-28T10:00:00.000Z',
  windows: windowTabCounts.map((count) => ({
    tabs: Array.from({ length: count }, () => ({})),
  })),
});

describe('historyItems.createSessionHtml session title', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: (tagName) => new FakeNode(tagName),
      createElementNS: (_namespace, tagName) => new FakeNode(tagName),
      createTextNode: (text) => {
        const node = new FakeNode('#text');
        node.textContent = text;
        return node;
      },
    });
    // A saved session, not the current one: sessionType === 'saved'.
    vi.spyOn(gsSession, 'getSessionId').mockResolvedValue('another-session');
    vi.spyOn(gsUtils, 'getMessage').mockImplementation((key) => ({
      js_history_windows: 'windows',
      js_history_window: 'window',
      js_history_tabs: 'tabs',
      js_history_tab: 'tab',
    })[key] ?? key);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function titleFor(name, counts) {
    const session = savedSession(name, counts);
    const root = await historyItems.createSessionHtml(session, false);
    const title = root.children.find((child) => child.attributes.class === 'sessionLink');
    expect(title).toBeTruthy();
    return title;
  }

  it('keeps the counter line as a real <small> element', async () => {
    const title = await titleFor('Urlaub', [2, 3]);
    const meta = title.children.find((child) => child.tagName === 'small');

    expect(meta).toBeTruthy();
    expect(meta.textContent).toBe('(2 windows, 5 tabs)');
    expect(title.textContent).toBe('Urlaub\u00A0 (2 windows, 5 tabs)');
  });

  it('uses the singular wording for one window and one tab', async () => {
    const title = await titleFor('Einzelner Tab', [1]);
    const meta = title.children.find((child) => child.tagName === 'small');

    expect(meta.textContent).toBe('(1 window, 1 tab)');
  });

  // Session names come from the save prompt or an imported backup's file name. A value
  // containing tags must stay text; it must neither become elements nor be entity-encoded.
  it('renders a name containing markup as literal text', async () => {
    const name = '<b>Urlaub</b><a href="https://example.com">hier</a>';
    const title = await titleFor(name, [1]);

    expect(title._text).toBe(name);
    expect(title.children.some((child) => child.tagName === 'b')).toBe(false);
    expect(title.children.some((child) => child.tagName === 'a')).toBe(false);
    expect(title.textContent).toBe(`${name}\u00A0 (1 window, 1 tab)`);
  });

  it('does not turn an ampersand entity into a character reference', async () => {
    const title = await titleFor('Tom &amp; Jerry', [1]);

    expect(title._text).toBe('Tom &amp; Jerry');
    expect(title.textContent).toContain('Tom &amp; Jerry');
  });

  // createEl() used to htmlEncode() its label and assign innerHTML. A locale string
  // containing markup now has to stay text, with no element children.
  it('renders action labels as text, not HTML', async () => {
    gsUtils.getMessage.mockImplementation((key) => ({
      js_history_export: 'Export & <b>now</b>',
      js_history_windows: 'windows',
      js_history_window: 'window',
      js_history_tabs: 'tabs',
      js_history_tab: 'tab',
    })[key] ?? key);

    const root = await historyItems.createSessionHtml(savedSession('Urlaub', [1]), true);
    const exportLink = root.children.find((child) => child.attributes.class === 'groupLink exportLink');

    expect(exportLink).toBeTruthy();
    expect(exportLink._text).toBe('Export & <b>now</b>');
    expect(exportLink.children).toHaveLength(0);
  });
});
