# Person

A household member, or anyone an order names. A Person note is one the
vault usually already has: CULItrail keeps no contact list of its own, it
reads notes in the configured People folder that carry the configured type
value. That value is a setting, not a fixed word, so a vault whose contacts
say `type: Kontakt` changes the setting rather than the notes.

**CULItrail creates no person notes.** Write one by hand from this template,
or let [APERtrail](https://github.com/technosoftware-gmbh/TRAILsuite/tree/main/packages/apertrail)
create it if you have it installed. Two plugins both offering "New person" would produce two
different shapes for the same person the first time somebody used the wrong
button, so only one of them offers it.

The meal plan's person selector and an order's recipient list are both
built from these, optionally narrowed to the tags in `eligiblePersonTags`.
An empty filter means everyone.

## Fields

1. **Type**
   `person`, or whatever `personTypeValue` is set to
2. **Title**
   The person's name. The note's filename is what orders and meal plans
   actually link to; this is for display in Obsidian's own property editor
3. **Description**
   One line
4. **Tags** (`personTagProperty`)
   Free tags. Also what `eligiblePersonTags` filters on, if you use it
5. **Address**
6. **Mobile**
   The number you would actually call. `private:` and `work:` below are for
   hand-editing; CULItrail reads neither, and neither does APERtrail
7. **Email**
8. **Related orders block**
   Lists every order naming this person, most recent first, with the
   meals they chose in each. Paste one into any person note to give it
   the same

## Sharing with APERtrail

The folder, the type value and the tag property all default to exactly what
APERtrail defaults to, in both English and German, so a vault with both
plugins reads one set of person notes rather than two.

A person note in such a vault carries two blocks. Neither breaks when its
plugin is absent; an unrendered fence is visible and harmless.

## Example layout

    ---
    type: person
    title: Stefan
    description:
    tags:
      - Family
    address: Musterweg 1, 8000 Zürich, Switzerland
    private:
    work:
    mobile: "+41 79 000 00 01"
    email: stefan@example.com
    created: "2026-08-09T09:00"
    modified: "2026-08-09T09:00"
    ---

    ```culi-related-orders
    ```

    ```travel-related-trips
    ```
