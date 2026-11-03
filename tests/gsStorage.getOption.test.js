import { describe, it, expect, vi, afterEach } from 'vitest';
import { gsStorage } from '../src/js/gsStorage.js';

// getOption() is on every tab-check path, several times per check. It reads one property,
// so it must not deep-clone the whole settings object; the visible behaviour still has to
// match getSettings(), including the defaults for a property storage does not carry.

describe('gsStorage.getOption', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a stored option and the default for a missing one', async () => {
    await gsStorage.setOption(gsStorage.SUSPEND_TIME, '90');
    await expect(gsStorage.getOption(gsStorage.SUSPEND_TIME)).resolves.toBe('90');
    await expect(gsStorage.getOption(gsStorage.SUSPEND_TIME_ON_BATTERY)).resolves.toBe('');
  });

  it('does not clone the whole settings object for a single read', async () => {
    // warm the cache the way a service worker start does
    await gsStorage.getSettings();
    const clone = vi.spyOn(globalThis, 'structuredClone');
    await expect(gsStorage.getOption(gsStorage.SUSPEND_TIME)).resolves.toBe('90');
    expect(clone).not.toHaveBeenCalled();
  });
});
