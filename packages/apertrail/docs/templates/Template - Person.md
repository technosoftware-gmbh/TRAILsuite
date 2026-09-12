# Person

Somebody you travel with, or somebody a place connects you to. A Person note is one the vault usually already has: APERtrail keeps no contact list of its own, it reads notes in the configured People folder that carry the configured type value. That value is a setting, not a fixed word, so a vault whose contacts say `type: Kontakt` changes the setting rather than the notes.

The Trip editor's participant list is built from these, optionally narrowed to the tags in `eligiblePersonTags`.

## Fields

1. Type
   person, or whatever `personTypeValue` is set to
2. Title
   The person's name. The note's filename is what trips actually link to; this is for display in Obsidian's own property editor
3. Description
   One line, shown on the person's card
4. Tags
   Free tags. Also what `eligiblePersonTags` filters on, if you use that
5. Address (text input)
6. Mobile (text input)
   The number you would actually call. `private:` and `work:` below are for hand-editing; the plugin reads neither
7. Email (text input)
8. Related trips block
   Lists every trip naming this person, most recent first. New Person notes get one automatically; paste one into an older note to give it the same

## Example Layout

---
type: person
title: Marc
description: 
tags:
  - Friends
address: Länggassstrasse, 3012 Bern, Switzerland
private: 
work: 
mobile: "+41 79 000 00 06"
email: marc@example.com
created: 
modified: 
---

```travel-related-trips
```
