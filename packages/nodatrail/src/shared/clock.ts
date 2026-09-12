/**
 * Today, in one place.
 *
 * Everything in `src/` that needs the current date takes it as an argument, so
 * that the pure half of every module is testable on a fixed day. This is the
 * one function that reads the real clock, and the views are what call it.
 */
export function now(): Date {
  return new Date();
}

/** Local midnight today, which is what every ISO-day comparison wants. */
export function today(): Date {
  const stamp = now();
  return new Date(stamp.getFullYear(), stamp.getMonth(), stamp.getDate());
}
