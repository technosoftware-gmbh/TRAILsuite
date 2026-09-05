# Security

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private reporting form, which is enabled on this repository:
[Report a vulnerability](https://github.com/technosoftware-gmbh/TRAILsuite/security/advisories/new).
It is private between you and the maintainers until an advisory is published.

If you would rather use email, <support@technosoftware.com> reaches the same
people. Say TRAILsuite in the subject. CULItrail has [its own repository](https://github.com/technosoftware-gmbh/CULItrail) and its own policy.

What helps: which plugin and version, what an attacker can do that they should
not be able to, and the smallest reproduction you can manage. A note or a
statement file that triggers it is worth more than a description of one, with
anything private taken out of it.

You can expect an acknowledgement within five working days and an assessment
with a plan or a reason it is not a vulnerability within fifteen. If a fix is
warranted it ships as a release with an advisory naming you, unless you would
rather not be named.

## Supported versions

The newest release of each package is the supported one. There is no long-term
support branch.

| Package | Supported |
|---|---|
| `@technosoftware/trail-core` | newest release |
| `apertrail` | newest release |
| `nodatrail` | newest release |

## What the attack surface actually is

Worth knowing before you look, because it is smaller than most:

**Neither plugin makes a network request.** There is no `fetch`, no
`requestUrl`, no XMLHttpRequest and no WebSocket anywhere in the shipped
source; the only URLs in the code are links a user clicks, which open in their
browser. Release notes are compiled into the bundle at build time rather than
fetched. Nothing is sent anywhere, and there is no server, no account and no
telemetry.

So the surface is local, and it is these three things:

1. **What the plugins parse.** Vault notes and their frontmatter, `.ics`
   calendar files, and bank statement exports (CSV). A file that a user chooses
   to import is the untrusted input here.
2. **What the plugins write.** They create and rewrite notes in configured
   folders. A path that escapes the folder it was meant for, or a write that
   destroys content it was meant to leave alone, is a vulnerability in the
   sense that matters most for this project: a vault is somebody's records.
3. **What they render.** Rendered vault content that could execute rather than
   display. The `ui-conventions` test forbids `innerHTML` in both plugins, which
   is part of why.

Out of scope: Obsidian itself, other plugins installed alongside these, and
anything that requires an attacker to already have write access to the vault
folder or to the machine. Report those to Obsidian or to the plugin in
question.

Denial of service by feeding a plugin an enormous file is interesting to us as
a bug, not as a vulnerability.
