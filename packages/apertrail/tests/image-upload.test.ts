/**
 * Putting a picture into the vault, and where it lands.
 *
 * The destination is not this plugin's decision and the test says so: it
 * asserts that `getAvailablePathForAttachment` is asked, with the note the
 * picture belongs to, and that whatever it answers is used. A vault set to
 * `./_resources` therefore files a trip's picture inside that trip's folder
 * without anything here knowing what a trip folder is.
 *
 * The two behaviours worth pinning are both about a batch. Somebody selecting
 * fourteen pictures has said what they want fourteen times, so one unreadable
 * file must not discard the other thirteen; and the paths have to be resolved
 * one at a time, because a free path is only free until something takes it.
 */
import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { uploadPictures } from '../src/ui/components/image-upload';
import { moveInList } from '../src/shared/reorder';

/** A File without a DOM: only `name` and `arrayBuffer()` are ever touched. */
function aFile(name: string, bytes = 4): File {
  return {
    name,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(bytes)),
  } as unknown as File;
}

interface Stub {
  app: Parameters<typeof uploadPictures>[0];
  taken: Set<string>;
  order: string[];
}

/**
 * An app that behaves the way Obsidian's does: it hands out a free path, and a
 * path stops being free once something is written to it.
 */
function anApp(options: { failOn?: string[]; folder?: string } = {}): Stub {
  const taken = new Set<string>();
  const order: string[] = [];
  const folder = options.folder ?? 'Trips/Rovos/_resources';

  const app = {
    fileManager: {
      getAvailablePathForAttachment: (name: string, source: string) => {
        order.push(`ask:${name}:${source}`);
        let path = `${folder}/${name}`;
        for (let n = 1; taken.has(path); n += 1) {
          path = `${folder}/${name.replace(/(\.[^.]+)$/, ` ${n}$1`)}`;
        }
        return Promise.resolve(path);
      },
    },
    vault: {
      createBinary: (path: string) => {
        order.push(`write:${path}`);
        if (options.failOn?.some((name) => path.includes(name))) {
          return Promise.reject(new Error('unreadable'));
        }
        taken.add(path);
        const file = new TFile();
        file.path = path;
        return Promise.resolve(file);
      },
    },
  };

  return { app: app as unknown as Stub['app'], taken, order };
}

const NOTE = 'Trips/Rovos/Rovos.md';

describe('uploading a picture', () => {
  it('lets Obsidian decide where it goes, and asks about the right note', async () => {
    const stub = anApp();
    const result = await uploadPictures(stub.app, [aFile('duene45.jpeg')], NOTE);

    expect(stub.order[0]).toBe(`ask:duene45.jpeg:${NOTE}`);
    expect(result.written).toEqual([
      { path: 'Trips/Rovos/_resources/duene45.jpeg', name: 'duene45.jpeg' },
    ]);
    expect(result.failed).toEqual([]);
  });

  it('keeps the order they were chosen in', async () => {
    const stub = anApp();
    const result = await uploadPictures(
      stub.app,
      [aFile('a.jpeg'), aFile('b.jpeg'), aFile('c.jpeg')],
      NOTE
    );

    expect(result.written.map((picture) => picture.name)).toEqual(['a.jpeg', 'b.jpeg', 'c.jpeg']);
  });

  /**
   * The reason this is a loop and not `Promise.all`. Two cameras produce
   * `IMG_1234.jpg`; resolved together, both are told the same path is free and
   * the second silently overwrites the first.
   */
  it('resolves each path only after the last one is written', async () => {
    const stub = anApp();
    const result = await uploadPictures(
      stub.app,
      [aFile('IMG_1234.jpg'), aFile('IMG_1234.jpg')],
      NOTE
    );

    expect(result.written.map((picture) => picture.path)).toEqual([
      'Trips/Rovos/_resources/IMG_1234.jpg',
      'Trips/Rovos/_resources/IMG_1234 1.jpg',
    ]);
    // Ask, write, ask, write. Interleaved, never both asks first.
    expect(stub.order.map((step) => step.split(':')[0])).toEqual(['ask', 'write', 'ask', 'write']);
  });

  it('keeps the pictures it could write when one of them fails', async () => {
    const stub = anApp({ failOn: ['broken'] });
    const result = await uploadPictures(
      stub.app,
      [aFile('good.jpeg'), aFile('broken.jpeg'), aFile('also-good.jpeg')],
      NOTE
    );

    expect(result.written.map((picture) => picture.name)).toEqual(['good.jpeg', 'also-good.jpeg']);
    expect(result.failed).toEqual(['broken.jpeg']);
  });

  it('does nothing at all when nothing was chosen', async () => {
    const stub = anApp();
    const result = await uploadPictures(stub.app, [], NOTE);

    expect(result).toEqual({ written: [], failed: [] });
    expect(stub.order).toEqual([]);
  });
});

describe('moving a row', () => {
  it('swaps with its neighbour and says it moved', () => {
    const list = ['a', 'b', 'c'];

    expect(moveInList(list, 2, -1)).toBe(true);
    expect(list).toEqual(['a', 'c', 'b']);
  });

  /** The edge the buttons are disabled on, asserted anyway: a disabled button is a UI fact, not a guarantee. */
  it('refuses to move the first row up or the last row down', () => {
    const list = ['a', 'b', 'c'];

    expect(moveInList(list, 0, -1)).toBe(false);
    expect(moveInList(list, 2, 1)).toBe(false);
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('refuses an index that is not in the list', () => {
    expect(moveInList([], 0, 1)).toBe(false);
    expect(moveInList(['a'], 5, -1)).toBe(false);
  });
});
