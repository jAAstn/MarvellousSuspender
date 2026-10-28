import { describe, it, expect } from 'vitest';
import { gsUtils } from '../src/js/gsUtils.js';

// The reason line under the suspended-page message is a locale string (Crowdin), so
// it is text, never markup. innerHTML throws here: a fallback would fail the test.
class FakeNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this._text = '';
    this._classes = new Set();
    this.classList = {
      add: (name) => this._classes.add(name),
      contains: (name) => this._classes.has(name),
    };
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  appendChild(node) {
    this.children.push(node);
    return node;
  }

  insertBefore(node, reference) {
    const index = reference == null ? this.children.length : this.children.indexOf(reference);
    this.children.splice(index === -1 ? this.children.length : index, 0, node);
    return node;
  }

  get firstChild() {
    return this.children[0] ?? null;
  }

  get textContent() {
    return this._text;
  }

  set textContent(value) {
    this._text = value;
    this.children = [];
  }

  get innerHTML() {
    throw new Error('innerHTML must not be read for a suspended-page reason');
  }

  set innerHTML(_value) {
    throw new Error('innerHTML must not be written for a suspended-page reason');
  }
}

function fakeDocument({ withContainer = true } = {}) {
  const container = new FakeNode('div');
  const elements = {};
  if (withContainer) elements['suspendedMsg-instr'] = container;

  return {
    container,
    elements,
    getElementById: (id) => elements[id] ?? null,
    createElement: (tagName) => new FakeNode(tagName),
  };
}

describe('gsUtils.setSuspendedPageReason', () => {
  it('creates the line in front of the message and keeps markup literal', () => {
    const doc = fakeDocument();
    const firstMessageNode = new FakeNode('span');
    doc.container.appendChild(firstMessageNode);
    const reason = 'Low <b>memory</b> &amp; more';

    const reasonEl = gsUtils.setSuspendedPageReason(doc, reason);

    expect(reasonEl).toBe(doc.container.children[0]);
    expect(doc.container.children[1]).toBe(firstMessageNode);
    expect(reasonEl.attributes.id).toBe('reasonMsg');
    expect(reasonEl._classes.has('reasonMsg')).toBe(true);
    expect(reasonEl.textContent).toBe(reason);
    expect(reasonEl.children).toHaveLength(0);
  });

  it('reuses an existing line instead of adding a second one', () => {
    const doc = fakeDocument();
    const existing = new FakeNode('div');
    doc.elements.reasonMsg = existing;

    const reasonEl = gsUtils.setSuspendedPageReason(doc, 'Low memory');

    expect(reasonEl).toBe(existing);
    expect(doc.container.children).toHaveLength(0);
    expect(existing.textContent).toBe('Low memory');
  });

  it('treats a missing reason as empty text', () => {
    const doc = fakeDocument();
    doc.elements.reasonMsg = new FakeNode('div');

    gsUtils.setSuspendedPageReason(doc, null);

    expect(doc.elements.reasonMsg.textContent).toBe('');
  });

  it('returns null when the message container is absent', () => {
    const doc = fakeDocument({ withContainer: false });

    expect(gsUtils.setSuspendedPageReason(doc, 'Low memory')).toBe(null);
  });
});
