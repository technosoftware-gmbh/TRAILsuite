/**
 * The seven fenced blocks, registered in one place.
 *
 * A processor is registered per language rather than one that switches on an
 * argument, because the language is what a reader types and what a reader
 * greps for.
 *
 * An async renderer's promise is voided explicitly at the boundary rather than
 * handed to Obsidian as a bare `async` callback: a floating promise in a
 * post-processor is a rejection nobody sees.
 */
import { Plugin } from 'obsidian';
import { JOURNAL_LANGUAGE } from '@technosoftware/trail-core';
import { NOD_SPENDING_BLOCK_LANG } from '../../crm/spending-block-lang';
import { renderProjectsBlock } from './para-blocks';
import { renderBillsBlock, renderBudgetBlock, renderSpendingBlock } from './finance-blocks';
import { renderPeriodBlock, renderTasksBlock } from './plan-blocks';
import { renderJournalBlock } from './journal-block';
import type { BlockDeps } from './context';

export function registerBlocks(plugin: Plugin, deps: BlockDeps): void {
  plugin.registerMarkdownCodeBlockProcessor('nod-projects', (source, element, context) => {
    renderProjectsBlock(deps, source, element, context);
  });

  // The one block whose language is not `nod-`: a journal fence is written by
  // the plugin into notes it created, and `noda-journal` is the name the parser
  // in trail-core already knows.
  plugin.registerMarkdownCodeBlockProcessor(JOURNAL_LANGUAGE, (source, element) => {
    renderJournalBlock(deps, source, element);
  });

  plugin.registerMarkdownCodeBlockProcessor('nod-bills', (source, element) => {
    renderBillsBlock(deps, source, element);
  });

  plugin.registerMarkdownCodeBlockProcessor('nod-budget', (source, element) => {
    void renderBudgetBlock(deps, source, element);
  });

  plugin.registerMarkdownCodeBlockProcessor(NOD_SPENDING_BLOCK_LANG, (source, element, context) => {
    renderSpendingBlock(deps, source, element, context);
  });

  plugin.registerMarkdownCodeBlockProcessor('nod-tasks', (source, element, context) => {
    void renderTasksBlock(deps, source, element, context);
  });

  plugin.registerMarkdownCodeBlockProcessor('nod-period', (source, element, context) => {
    void renderPeriodBlock(deps, source, element, context);
  });
}
