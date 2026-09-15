/**
 * The sheet contract: the settings the plugins that export sheets agree on,
 * so a vault's printed pages are filed and signed the same way whichever
 * plugin wrote them.
 *
 * Like `DISPLAY_CONTRACT`, this is not configuration. Each plugin owns a real
 * setting a vault can change; this is only the default all of them ship.
 */

export interface SheetContract {
  /**
   * Who a sheet says made it, in its credit line: "Erstellt von Thomas am ...".
   * Blank leaves the "by" out rather than printing an empty name.
   */
  exportAuthor: string;
  /**
   * The subfolder sheets are written into, beside what they render. Blank
   * writes them beside it. `_exports` is what APERtrail has written since its
   * first sheet, which is why it is the default rather than a new name.
   */
  exportsSubfolder: string;
}

export const SHEET_CONTRACT: Readonly<SheetContract> = Object.freeze({
  exportAuthor: '',
  exportsSubfolder: '_exports',
});

export const SHEET_CONTRACT_KEYS: readonly (keyof SheetContract)[] = [
  'exportAuthor',
  'exportsSubfolder',
];
