/**
 * Waiting for the metadata cache, and giving up on it.
 *
 * The bug this exists for: a gallery redrawn the instant a write resolved read
 * the note it had just saved as having no `type`, because Obsidian re-parses
 * after the write and a note is identified by folder and type together. The
 * card vanished and the next manual refresh brought it back.
 *
 * Two things have to hold, and the second is the one that would rot quietly.
 * It has to resolve when the cache catches up, and it has to resolve **anyway**
 * when no event ever arrives -- a view that redraws late is a great deal better
 * than one that never redraws, and a promise nobody settles is a gallery frozen
 * on whatever it last drew.
 *
 * The app here is a stub of the two methods used, and its type is taken from
 * the function rather than from `obsidian`: this package stays Obsidian-free
 * and its own lint rule says so, tests included.
 */
import { describe, expect, it, vi } from 'vitest';
import { whenIndexed } from '../../src/obsidian/indexed.js';

type AppLike = Parameters<typeof whenIndexed>[0];

interface Fake {
  app: AppLike;
  fire: (path: string) => void;
  counts: { listeners: number; offrefs: number };
}

/** The two calls `whenIndexed` makes, and a way to fire the event by hand. */
function fakeApp(): Fake {
  const handlers: ((file: { path: string }) => void)[] = [];
  const counts = { listeners: 0, offrefs: 0 };

  const app = {
    metadataCache: {
      on: (_name: string, handler: (file: { path: string }) => void) => {
        handlers.push(handler);
        counts.listeners += 1;
        return { handler };
      },
      offref: () => {
        counts.offrefs += 1;
      },
    },
  } as unknown as AppLike;

  return { app, fire: (path) => handlers.forEach((handler) => handler({ path })), counts };
}

describe('waiting for a note to be re-read', () => {
  it('resolves when the cache reports the note it was told to wait for', async () => {
    const fake = fakeApp();
    let settled = false;
    const waiting = whenIndexed(fake.app, { path: 'Trips/Nordkap.md' }).then(() => {
      settled = true;
    });

    expect(settled).toBe(false);
    fake.fire('Trips/Nordkap.md');
    await waiting;
    expect(settled).toBe(true);
  });

  it('ignores another note while it is waiting for one', async () => {
    vi.useFakeTimers();
    try {
      const fake = fakeApp();
      let settled = false;
      const waiting = whenIndexed(fake.app, { path: 'Trips/Nordkap.md' }).then(() => {
        settled = true;
      });

      fake.fire('Plätze/Oslo.md');
      await Promise.resolve();
      expect(settled).toBe(false);

      // And the backstop still ends it, rather than leaving a view hanging on
      // an event that is never coming.
      vi.advanceTimersByTime(600);
      await waiting;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('takes the next note re-read when it was not told which one', async () => {
    // What a caller that does not know which file was written has to settle
    // for, and in the moment after a save it is that file.
    const fake = fakeApp();
    let settled = false;
    const waiting = whenIndexed(fake.app).then(() => {
      settled = true;
    });

    fake.fire('irgendwas.md');
    await waiting;
    expect(settled).toBe(true);
  });

  it('resolves on the backstop when no event ever arrives', async () => {
    vi.useFakeTimers();
    try {
      const fake = fakeApp();
      const waiting = whenIndexed(fake.app, { timeoutMs: 50 });
      vi.advanceTimersByTime(50);
      await expect(waiting).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets go of the listener when the event ended it', async () => {
    // Left subscribed, every save would add another listener for the life of
    // the session.
    const fake = fakeApp();
    const waiting = whenIndexed(fake.app);
    fake.fire('a.md');
    await waiting;

    expect(fake.counts.listeners).toBe(1);
    expect(fake.counts.offrefs).toBe(1);
  });

  it('lets go of it when the backstop did', async () => {
    vi.useFakeTimers();
    try {
      const fake = fakeApp();
      const waiting = whenIndexed(fake.app, { timeoutMs: 10 });
      vi.advanceTimersByTime(10);
      await waiting;

      expect(fake.counts.listeners).toBe(1);
      expect(fake.counts.offrefs).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('settles once when the event and the backstop both fire', async () => {
    vi.useFakeTimers();
    try {
      const fake = fakeApp();
      const waiting = whenIndexed(fake.app, { timeoutMs: 10 });
      fake.fire('a.md');
      vi.advanceTimersByTime(10);
      await waiting;

      expect(fake.counts.offrefs).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
