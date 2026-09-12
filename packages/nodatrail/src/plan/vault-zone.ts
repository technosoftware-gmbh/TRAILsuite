/**
 * The zone a day note's clock means.
 *
 * A day note is somebody's day, so `08:00` in one means eight o'clock where
 * they were. That is the zone the machine is set to, and this is the one place
 * that asks: `trail-core` takes the zone as an argument everywhere and never
 * consults the runtime, for the same reason it never calls `new Date()`.
 *
 * **The same answer has to be given to the plan and to the replay.** An import
 * converts the export's times into this zone before deriving a key from them,
 * and `priorImportsOf` re-derives keys from an archived file the same way. Two
 * different answers in one run would report every meeting as both new and gone.
 * So both go through here rather than each asking for itself.
 *
 * The consequence of tying it to the machine, which is worth knowing before it
 * happens: **importing the same file on a machine set to another zone writes
 * different times**, and a re-import after moving zones sees its own earlier
 * lines as gone. The alternative, reading `X-WR-TIMEZONE` out of the file, is
 * stable across machines and wrong for anybody whose calendar is published in a
 * zone they do not live in. Neither is free, and this one is at least the
 * reading that matches the notes around it.
 */

/**
 * The runtime's IANA zone, or blank when it will not say.
 *
 * Blank converts nothing, which is the behaviour every import had before zones
 * were read at all. An environment with no zone table is not one where guessing
 * would help.
 */
export function vaultZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}
