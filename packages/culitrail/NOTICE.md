# Notice

CULItrail is copyright (c) 2026 Technosoftware GmbH
(<https://technosoftware.com>) and is licensed GPL-3.0-or-later.

CULItrail's meal and meal-planning code descends from one originally
separate Obsidian community plugin:

- **Recipe Box** by Arcane Tech / AdamArcane
  (https://github.com/AdamArcane/obsidian-recipebox), GPL-3.0-or-later.

Recipe Box was integrated as CULItrail's meal module rather than rebuilt from
scratch, so the code that reads, renders and plans a dish descends from it
directly.

Because Recipe Box's code is GPL-3.0-or-later, this plugin is licensed as a
whole under GPL-3.0-or-later (see `LICENSE`).

This is worth stating plainly, because CULItrail's sibling plugin **APERtrail**
(https://github.com/technosoftware-gmbh/TRAILsuite/tree/main/packages/apertrail)
ships under the PolyForm Noncommercial License 1.0.0. The two are deliberately licensed differently:
CULItrail carries inherited GPL code and APERtrail does not. Code must not be
copied from CULItrail into APERtrail.

The source is public and the build is installed by hand, by copying
`main.js`, `manifest.json` and `styles.css` into a vault's
`.obsidian/plugins/culitrail/`. It is not published to the Obsidian community
plugin directory.
