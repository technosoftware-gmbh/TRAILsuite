/**
 * How important a thing is, named once for everything that has a priority.
 *
 * Its own module rather than a corner of `tasks/`, because only half of it is
 * about tasks: a PARA note records a number and a task records the Tasks
 * plugin's emoji, and the point of this module is that both answer to the same
 * four words.
 */
export * from './priority.js';
