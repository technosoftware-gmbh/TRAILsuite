# Company

An organization behind the places a trip visits: a tourist board, a railway, a hotel group. Read on the same terms as a Person -- a note in the configured Companies folder carrying the configured type value, which is a setting rather than a fixed word.

A Company note gets no related-trips block. Nothing links a trip to a company, so the block could only ever report that it has nothing to report.

## Fields

1. Type
   company, or whatever `companyTypeValue` is set to
2. Title
   The company's name, for Obsidian's own property editor. The filename is what other notes link to
3. Description
   One line, shown on the company's card
4. Tags
   Free tags, read from `companyTagProperty` -- a separate setting from the person one, so the two can differ
5. Address (text input)
6. Website (text input)
   Shown on the card as just its host
7. Email (text input)
8. Phone (text input)
   A company gets `phone`, a person gets `mobile`. Two settings rather than one shared field, because they are the number you would actually use in each case

## Example Layout

---
type: company
title: Basel Tourismus
description: City tourist board for Basel
tags:
  - Tourism
address: Aeschenvorstadt, 4051 Basel, Switzerland
website: https://www.basel.com/
email: 
phone: 
created: 
modified: 
---

# Overview

# Notes
