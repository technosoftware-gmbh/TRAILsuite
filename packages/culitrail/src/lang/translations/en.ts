/**
 * English translation table.
 *
 * Keys carry no top-level namespace: `settings.x`, not `meals.settings.x`.
 * In a plugin that is only about eating, that level named nothing.
 *
 * Only the keys the settings layer needs exist so far. The UI blocks arrive
 * with the areas that use them. Every new key lands here and in `de.ts` in the
 * same commit; tests/translation-keys.test.ts fails otherwise.
 */

export const enTranslations = {
  settings: {
    nav: {
      back: 'Back',
    },
    header: {
      whatsNew: {
        name: "What's new in CULItrail {version}",
        desc: 'See recent updates and improvements.',
        button: 'View recent updates',
      },
      support: {
        name: 'Support development',
        desc: 'If CULItrail has earned its place in your vault, this is how you keep it developing.',
        sponsor: 'Sponsor',
        coffee: 'Buy me a coffee',
      },
      help: {
        name: 'Help and contact',
        desc: 'The documentation, the issue tracker, and a way to reach a person.',
        docs: 'Documentation',
        issues: 'Report an issue',
        contact: 'Contact support',
      },
    },
    whatsNew: {
      title: "What's new in CULItrail {version}",
      empty: 'This build ships no release notes.',
      close: 'Close',
      allReleases: 'Every release on GitHub',
    },
    vault: {
      title: 'Vault setup',
      intro:
        'Where your notes live, and what the fields inside them are called. Both are set once when a vault is adopted and then left alone.',
      folders: {
        name: 'Folders',
        desc: 'The meal, plan, order, delivery and contact folders, and the one note path that is a file rather than a folder.',
        value: '{count} folders',
      },
      properties: {
        name: 'Property keys',
        desc: 'Every frontmatter name CULItrail reads and writes, grouped by the note type that carries it.',
        valueLocked: '{count} keys, locked',
        valueUnlocked: '{count} keys, editable',
      },
    },
    propertyKeys: {
      intro:
        'The frontmatter names CULItrail reads and writes. Change one only to match a name your notes already use: nothing on disk is renamed with it.',
      search: 'Find a property',
      searchNote: 'Filters the rows below by name or by current value.',
      searchPlaceholder: 'e.g. diet, vat, entry',
    },
    page: {
      itemCount: '{count} entries',
    },
    people: {
      title: 'People',
      intro: 'Which of your Person notes an order will offer you.',
    },
    views: {
      title: 'Opening views',
      intro: 'What Obsidian does on its own when you open a note of one of these kinds.',
    },
    list: {
      moveUp: 'Move up',
      moveDown: 'Move down',
      remove: 'Remove',
      edit: 'Edit',
      save: 'Save',
    },
    badges: {
      title: 'Header badges',
      note: "The order of this list is the header's layout. The two arrangement entries, a separator and a line break, exist to space the badges around them. A built-in can be edited and switched off, but not removed.",
      add: 'Add a badge',
      newBadge: 'New badge',
      editBadge: 'Edit badge',
      enabled: 'Shown',
      noProperty: 'no property',
      separator: 'Separator',
      newline: 'Line break',
      type: 'Kind',
      typeBadge: 'Badge',
      label: 'Label',
      labelBuiltinDesc:
        'Leave this empty to keep the translated name. Typing anything fixes the label as typed, in every language.',
      property: 'Frontmatter property',
      propertyDesc: 'What the badge shows. Leave empty for a badge that is only a formula.',
      derivedDesc:
        'This badge computes its own value from the eating history, so it has no property and no formula. Its label, icon and colour can still be changed.',
      formula: 'Formula',
      formulaDesc:
        "An expression over the note's properties, such as (prepTime || 0) + (reheatTime || 0) || null. A result of null hides the badge.",
      icon: 'Icon',
      color: 'Colour',
      valueColors: 'Colour per value',
      valueColorsDesc:
        'A colour for one value of this property. Anything not named here uses the badge colour above.',
      valueColorPlaceholder: 'Value, e.g. Fleisch',
      valueColorAdd: 'Add',
      valueColorRemove: 'Remove this value',
      colorDefault: 'Default',
      colorGreen: 'Green',
      colorBlue: 'Blue',
      colorPurple: 'Purple',
      colorYellow: 'Yellow',
      colorRed: 'Red',
      valueType: 'Value',
      valueTypeDesc: 'Minutes are shown the way a meal states a time: 1 h 15 min, not 75.',
      valueAuto: 'As written',
      valueMinutes: 'As a duration',
      splitArray: 'One chip per value',
      splitArrayDesc: 'For a list property such as diet, so each value gets its own chip.',
      hideLabel: 'Hide the label',
      hideLabelDesc:
        'Shows the icon and the value alone. Without a label a badge stays a chip, since a column in the figure strip needs a heading.',
      prefix: 'Prefix',
      suffix: 'Suffix',
      chipOnlyDesc:
        'Applies to the chip form only. A figure in the strip has neither an icon nor a colour.',
    },
    propertyNames: {
      unlock: 'Allow editing property names',
      unlockDesc:
        'Off, because renaming a property here does not rename it in your notes. The plugin would then look for a property none of them carries, and the gallery, the filters and the plan would come up empty with nothing to say why. Turn this on only to match names a vault already uses, and turn it off again afterwards. Folder settings are not covered: repointing a folder is reversible in a way renaming a property is not.',
      locked: 'Locked. Turn on "Allow editing property names" above to change this.',
    },
    status: {
      adoptedFrom: 'CRM settings adopted from {plugin} on first load',
      adoptedNothing: 'nothing recognised',
      title: 'What CULItrail currently sees',
      note: 'A note counts only if it is in the folder AND carries the type value. If a count is zero, this says which of the two to check.',
      detail: 'in {folders}, type {type}',
      noFolder: 'no folder set',
      noType: 'no type set',
      meals: 'Meals',
      orders: 'Orders',
      deliveries: 'Deliveries',
      mealPlans: 'Meal plans',
      people: 'People',
      companies: 'Companies',
    },
    library: {
      folders: 'Folders',
      foldersNote:
        'Each root moves as a unit: change it and its sub-folders follow. A blank folder is skipped rather than treated as the vault root.',
      rootFolder: 'Root folder',
      rootFolderDesc: 'An optional common parent above everything. Empty means the vault root.',
      eatingFolder: 'Eating folder',
      mealsFolder: 'Meals folder',
      additionalMealFolders: 'Further meal folders',
      additionalMealFoldersDesc:
        'One per line. Read-only scope: new meals always land in the meals folder above.',
      mealPlansFolder: 'Meal plans folder',
      ordersFolder: 'Orders folder',
      vocabularies: 'Meal vocabularies',
      vocabulariesNote:
        'What the meal editor offers for diet, allergens and product line. Leave a list empty to offer only what your notes already use; anything a note already says stays selectable either way.',
      mealDietOptions: 'Diets',
      mealAllergenOptions: 'Allergens',
      mealLineOptions: 'Product lines',
      mealLineOptionsDesc:
        "A supplier's own published lines are offered first on a meal from that supplier.",
      mealSupplierRole: 'Only suppliers with this role',
      mealSupplierRoleDesc:
        'Leave empty to offer every company. Set it to a role, such as meals, and only companies whose roles property carries it are offered as a supplier -- including in the product-lines command. A company with no roles is then not offered, so fill this in once your suppliers are marked.',
      notePaths: 'Note paths',
      notePathsNote:
        "Full path templates, because the filename carries the week and the person. {GGGG} and {WW} are ISO week-year and week number; {person} is the person's note title with spaces removed.",
      mealPlanPath: 'Meal plan note path',
      identification: 'Identification',
      identificationNote:
        'A note counts as a meal only if it is in scope by folder AND carries this type value. A blank type value matches nothing rather than everything.',
      typePropertyName: 'Type property name',
      mealTypeValue: 'Meal type value',
      noteHeader: 'Note header',
      noteHeaderNote:
        'Every note CULItrail writes is stamped with when it was made, and every change it makes to an existing note is stamped with when. Leave a name blank to write that stamp nowhere.',
      createdProperty: 'Created property name',
      createdPropertyDesc:
        'Written once, when the note is created. Never added to a note that arrived without one.',
      modifiedProperty: 'Modified property name',
      modifiedPropertyDesc: 'Rewritten on every change CULItrail makes to an existing note.',
      browsing: 'Browsing',
      enableDashboard: 'Show the dashboard',
      enableDashboardDesc:
        'Also decides the ribbon: on, one dashboard icon; off, an icon each for the gallery and the meal plan.',
      showRibbonIcons: 'Show ribbon icons',
      dashboardActivityRange: 'Activity range',
      dashboardActivityRangeDesc:
        'What "recently" means for the dashboard\'s eaten-recently count.',
      weeks: '{count} weeks',
      openGalleryOnFolderClick: 'Open the gallery from the file explorer',
      openGalleryOnFolderClickDesc:
        'Clicking the meal folder opens the gallery. The folder still expands.',
      openGalleryOnFolderClickSubfolders: 'Subfolders too',
      openGalleryOnFolderClickSubfoldersDesc:
        'Clicking a subfolder filters the gallery to it. This overwrites the folder filter you last set by hand.',
      autoOpenMealView: 'Open meals in the meal view',
      autoOpenMealViewDesc:
        'Off, and a meal opens as ordinary Markdown until you ask for the meal view from its file menu.',
    },
    mealView: {
      headings: 'Section headings',
      headingsNote:
        'What the parser looks for in a note body. These have to match what your notes actually say, or a meal shows as empty.',
      notesHeading: 'Notes heading',
      readOnly: 'Read, never written',
      readOnlyNote:
        'The two body sections meals used to keep their per-100 g figures in. The editor writes those figures into frontmatter now and emits neither section, so these names only decide whether a meal written before the move can still be read. Leave them as they are unless your notes use other words.',
      nutritionHeading: 'Per-100g nutrition heading',
      micronutrientHeading: 'Per-100g micronutrient heading',
      rendering: 'Rendering',
      cleanNoteBody: 'Tidy the note body',
      cleanNoteBodyDesc:
        'Hides a title line and a hero image embed that the view is already showing above.',
      useFirstBodyImage: 'Use the first body image',
      useFirstBodyImageDesc:
        "When the image property is empty, take the note's first embedded image instead.",
      defaultMealImage: 'Default image',
      defaultMealImageDesc: 'Shown when a meal has no image of its own. A vault path or a URL.',
      tags: 'Tags',
      showTagsInHeader: 'Show tags in the header',
      prefixTagsWithHash: 'Show the leading #',
      showFullTagPath: 'Show the full tag path',
      showFullTagPathDesc: 'Off, and Family/Close shows as Close.',
      nutrition: 'Nutrition',
      nutritionNote:
        'Two settings that are easily confused. The first says what the numbers in your notes mean; the second says how you want to read them. CULItrail converts between the two.',
      nutritionSource: 'What the notes hold',
      nutritionSourceDesc: 'The basis the figures in your meals are written on.',
      nutritionDisplay: 'What to show',
      nutritionDisplayDesc:
        'A meal stating nutrition but no servings cannot be converted, and says so.',
      perServing: 'Per serving',
      wholeMeal: 'Whole meal',
      allergens: 'Allergens',
      allergensNote:
        'What a meal declares is matched against this list, so a note can carry an allergen a company names and you do not, and the other way round.',
      myAllergens: 'My allergens',
      myAllergensDesc: 'One per line. Also drives the gallery\'s "hide my allergens" filter.',
      properties: 'Frontmatter property names',
      propertiesNote:
        'Every property CULItrail reads has a configurable name. If your notes already use a convention, change the setting rather than the notes. A few well-known aliases are accepted as a fallback after the configured name.',
      imageProperty: 'Image',
      servingsProperty: 'Servings',
      servingSizeProperty: 'Serving size',
      favoriteProperty: 'Favorite',
      prepTimeProperty: 'Prep time',
      reheatTimeProperty: 'Reheat time',
      totalTimeProperty: 'Total time',
      dietProperty: 'Diet',
      allergensProperty: 'Allergens',
      caloriesProperty: 'Calories',
      proteinProperty: 'Protein',
      fatProperty: 'Fat',
      carbsProperty: 'Carbohydrates',
      priceProperty: 'Meal price',
      lineProperty: 'Product line',
      priceCurrencyProperty: 'Price currency',
      per100g: 'Per-100 g nutrition',
      per100gNote:
        'What the label on the packet says, held as frontmatter rather than as a section in the note body. Two energy properties and two lists, one entry per nutrient. Separate from the figures above, which are per serving: a meal can carry both, and neither says what the other does.',
      caloriesPer100gProperty: 'Calories per 100 g',
      kjPer100gProperty: 'Kilojoules per 100 g',
      macronutrientsProperty: 'Macronutrients list',
      micronutrientsProperty: 'Micronutrients list',
      nutrientFields: 'What one nutrient says',
      nutrientFieldsNote:
        'Sub-keys inside a list entry, not top-level properties. An entry names the nutrient, the unit it is stated in and the figure itself. The unit is stored rather than assumed, because a label states it and the usual one is not always the one on the packet.',
      nutrientNameField: 'Nutrient name field',
      nutrientUnitField: 'Unit field',
      nutrientValueField: 'Value field',
      writtenOnly: 'Written, never read back',
      writtenOnlyNote:
        'The meal editor writes this one and nothing ever reads it back, not even the editor. It still gets a name, because every property this plugin writes gets one.',
      kjProperty: 'Kilojoules',
    },
    planning: {
      mealPlan: 'Plan notes',
      mealPlanNote:
        'A plan is one note per person per ISO week, holding its entries as a property list the way an order holds its selections. The week and the person are also in the filename; the property wins over it.',
      mealPlanTypeValue: 'Plan type value',
      weekProperty: 'Week property',
      personProperty: 'Person property',
      entriesProperty: 'Entries property',
      entryFields: 'What one entry says',
      entryFieldsNote:
        'Sub-keys inside an entry, not top-level properties. A wikilink under the meal field is a meal note; plain text there is an entry that is not one, such as leftovers.',
      entryMealField: 'Meal field',
      entryDayField: 'Day field',
      entrySlotField: 'Meal slot field',
      entryEatenField: 'Eaten field',
      entryRatingField: 'Rating field',
      entryTimeField: 'Time field',
      entryNoteField: 'Note field',
      entryLeftoversField: 'Leftovers field',
      entryIdField: 'Id field',
      reading: 'Reading',
      readingNote:
        'How a plan note is opened, and what is still understood from notes written before the entries were properties.',
      autoOpenMealPlanView: 'Open plan notes as a week',
      mealSlotFieldName: 'Old meal slot field name',
      mealSlotFieldNameDesc:
        'Read only. Nothing writes a checklist line any more, but a note nobody has converted still carries #meal/lunch or [meal:: lunch], and this names that field.',
      eatingHistory: 'Eating history',
      eatingHistoryNote:
        "The log a meal's last-eaten date and eaten count are derived from. An explicit value in a note always wins over the derived one.",
      eatingHistoryEnabled: 'Keep an eating history',
      eatingHistoryHeading: 'Eating history heading',
      eatingHistoryProperty: 'Eating history property',
      lastEatenProperty: 'Last eaten property',
      eatenCountProperty: 'Times eaten property',
    },
    // Reheating a meal that arrived ready rather than one made from scratch.
    // The appliance labels seed a fresh install's setting, so they follow the
    // locale rather than freezing as English literals. See §G.1.
    reheating: {
      section: 'Ready meals',
      sectionNote:
        'A meal carries reheating instructions, one block per appliance under this heading. A supplier can hold the wording once on its company note, and each meal supplies only the numbers.',
      heading: 'Reheating heading',
      tempField: 'Temperature field',
      tempFieldDesc: 'The inline field a meal uses for temperature, as in [temp:: 95 °C].',
      timeField: 'Time field',
      timeFieldDesc: 'The inline field a meal uses for duration, as in [time:: 25 min].',
      appliances: 'Appliances',
      appliancesNote:
        'What a reheating block can be headed with. The name is matched against the sub-heading in a note; the id beside it is what the match falls back to and what a rename keeps, so correcting a name never orphans a note.',
      noAppliances: 'No appliances. Nothing will be recognised as a reheating block.',
      addAppliance: 'Add appliance',
      appliancePlaceholder: 'Air fryer',
      applianceLabels: {
        microwave: 'Microwave',
        oven: 'Oven',
        steamer: 'Steamer',
        skillet: 'Skillet',
      },
    },
    display: {
      displayLocale: 'Number and date format',
      displayLocaleDesc:
        "A locale tag such as `de-CH` or `en-GB`, deciding how figures are grouped and dates ordered. Separate from the interface language: German writes 100.120,20 and Swiss German 100'120.20. Leave empty to follow this computer.",
    },
    orders: {
      orderNote: 'Order notes',
      orderNoteNote:
        'The order number is not among these: it lives in the filename (yyyy-mm-dd-number.md), and that is the contract.',
      orderTypeValue: 'Order type value',
      companyProperty: 'Supplier property',
      orderDateProperty: 'Order date property',
      deliveryDateProperty: 'Delivery date property',
      priceProperty: 'Price property',
      priceCurrencyProperty: 'Currency property',
      defaultCurrency: 'Default currency',
      defaultCurrencyDesc: 'Prefilled on a new order, because a household orders in one currency.',
      selections: 'Who ordered what',
      selectionsNote:
        'One list, one entry per person. The two field names below are sub-keys within an entry, not top-level properties.',
      vat: 'VAT',
      vatNote:
        'Prices in an order note are gross: every figure is what was charged, tax included. These two let an order additionally say how much of that was tax, which the invoice then shows as an included line. Nothing is computed from them, and an order that states neither means what it always did.',
      vatRateProperty: 'VAT rate property',
      vatAmountProperty: 'VAT amount property',
      itemDiscountField: 'Item discount field',
      itemDiscountFieldDesc:
        'A discount on one line, on top of whatever comes off the whole order. A sub-key inside an item, not a property of the note.',
      deliveries: 'Deliveries',
      deliveriesNote:
        'A delivery says what actually arrived and when, which an order cannot: one order can come in two boxes a week apart, and one box can settle two orders. The meal picker offers the last delivered meals first.',
      deliveriesFolder: 'Deliveries folder',
      deliveryTypeValue: 'Delivery type value',
      deliveryNoteDateProperty: 'Delivery date property',
      deliveryOrdersProperty: 'Orders property',
      deliveryItemsProperty: 'Items property',
      deliveryItemMealField: 'Item meal field',
      deliveryItemQuantityField: 'Item quantity field',
      companyTerms: 'What a company charges',
      companyTermsNote:
        'Read off the Company note and never written to it, the same way its reheating instructions are. An order is pre-filled from these, but what lands in the note is a plain number: an order stays a record of what was actually charged.',
      companyCurrencyProperty: 'Currency property',
      companyPaymentMethodProperty: 'Payment method property',
      companyInvoiceTimingProperty: 'Invoice timing property',
      companyShippingFeeProperty: 'Shipping fee property',
      companyFreeShippingFromProperty: 'Free shipping from property',
      companyFreeShippingFromPropertyDesc: 'How many meals in one order earn free delivery.',
      companyDiscountTableProperty: 'Discount table property',
      companyDiscountTablePropertyDesc:
        'A ladder of rows, counted in meals. Write a row either as "from: 12" with "percent: 10", or on one line as "12: 10". The highest row at or below the count wins.',
      companyLinesProperty: 'Product lines property',
      companyLinesPropertyDesc:
        "The ranges a company sells the same dish under, such as Alltag, Sport and Weightloss. Offered when setting a meal's line.",
      selectionsProperty: 'Selections property',
      selectionPersonField: 'Person field',
      selectionMealsField: 'Meals field',
      selectionItemsField: 'Selection items field',
      selectionItemsFieldDesc:
        'The priced line list, used instead of the meals field once a line carries a price or a quantity. An order with neither stays in the older shape.',
      itemMealField: 'Item meal field',
      itemPriceField: 'Item price field',
      itemQuantityField: 'Item quantity field',
      discountProperty: 'Discount property',
      discountPropertyDesc: 'Taken off the whole order, not off any one meal.',
      shippingProperty: 'Shipping property',
      legacyPrefix: 'Old per-person prefix',
      legacyPrefixDesc:
        'Read only, for orders written before the list above existed. Saving such an order once upgrades it.',
      autoOpenOrderView: 'Open orders as an invoice',
      autoOpenOrderViewDesc:
        'Off, and an order opens as ordinary Markdown until you ask for the order view from its file menu.',
      autoOpenDeliveryView: 'Open deliveries as a document',
      autoOpenDeliveryViewDesc:
        'A delivery note says everything in its properties, so off leaves you looking at an empty note.',
      crm: 'People and companies',
      crmNote:
        "CULItrail reads these notes and writes neither. These names and type values are copied verbatim from APERtrail's own defaults, which is the whole mechanism behind both plugins reading the same notes. Changing one here without changing it there breaks that silently.",
      crmFolder: 'CRM folder',
      personsFolder: 'People folder',
      companiesFolder: 'Companies folder',
      personTypeValue: 'Person type value',
      companyTypeValue: 'Company type value',
      personTagProperty: 'Person tag property',
      personRolesProperty: 'Person roles',
      companyRolesProperty: 'Company roles',
      companyTagProperty: 'Company tag property',
      supplierProperty: 'Supplier property',
      supplierPropertyDesc:
        'Which company sells a meal, when it is not the company on the most recent order naming it. A wikilink to a company note.',
      eligiblePersonTags: 'Household tags',
      eligiblePersonTagsDesc:
        'Which people are offered for meal plans and orders. Empty means everyone, never nobody. A parent tag admits its nested children.',
    },
    about: {
      title: 'CULItrail',
      credits: 'Credits',
      vendor: 'Technosoftware GmbH',
      vendorLink: 'technosoftware.com',
      originalProject: 'View the original project',
      mealBox: 'Built on Recipe Box by Arcane Tech / AdamArcane.',
      licence: 'GPL-3.0-or-later. See NOTICE.md in the repository for the full attribution.',
    },
    folders: {
      defaults: {
        // The vault-root path above everything else. Empty means the vault
        // root itself, which is the shape the sample vault ships in.
        rootFolderPath: '',
        eatingFolderName: 'Eating',
        mealsFolderName: 'Meals',
        mealPlansFolderName: 'Meal Plans',
        ordersFolderName: 'Orders',
        deliveriesFolderName: 'Deliveries',
        // Copied verbatim from APERtrail's own table, in both locales, so a
        // fresh install of either plugin lands on the same two folders. This
        // is the whole mechanism behind the shared-CRM contract; changing
        // one of these without changing APERtrail breaks it silently.
        crmFolderName: 'CRM',
        personsFolderName: 'People',
        companiesFolderName: 'Companies',
      },
    },
    // Body headings CULItrail looks for when parsing a meal note, and writes
    // when adding an eating-history entry. Localized defaults rather than
    // English literals, because a German vault's notes say "Aufwärmen" and the
    // plugin parsing nothing until three settings are found by hand is a poor
    // first five minutes.
    headings: {
      defaults: {
        notes: 'Notes',
        reheating: 'Reheating',
        eatingHistory: 'Eating History',
      },
    },
  },

  meals: {
    // Durations read the way a meal states one: "1 h 15 min", not "75 min"
    // and not "1.25 h".
    time: {
      minutes: '{m} min',
      hours: '{h} h',
      hoursMinutes: '{h} h {m} min',
    },

    // The meal view's own chrome: the tab, the header actions, kitchen mode.
    view: {
      untitled: 'Meal',
      editAsMarkdown: 'Edit as Markdown',
      kitchenModeOn: 'Kitchen mode on, screen stays awake',
      kitchenModeOff: 'Kitchen mode off',
      kitchenModeOnNotice: 'Kitchen mode on. The screen will stay awake.',
      kitchenModeOffNotice: 'Kitchen mode off.',
      wakeLockUnsupported: 'This device cannot keep the screen awake.',
      wakeLockFailed: 'Could not keep the screen awake.',
    },

    header: {
      serves: 'Serves',
      supplierFromOrder: 'from your last order',
      toggleFavorite: 'Favorite',
      addToPlan: 'Add to meal plan',
      onThePlan: 'On the meal plan',
      markEaten: 'Mark as eaten',
      editMeal: 'Edit meal',
    },

    markEaten: {
      title: 'Mark as eaten',
      when: 'When',
      who: 'Who ate it',
      nobody: 'Not recorded',
      rating: 'How was it',
      note: 'Notes',
      notePlaceholder: 'What you would want to remember next time.',
      confirm: 'Mark as eaten',
    },

    eatingHistory: {
      title: 'Eating history',
      empty: 'Nothing logged yet.',
    },
    create: {
      title: 'New meal',
      subtitle: 'The name is the note, so it is the one thing asked for here.',
      name: 'Name',
      namePlaceholder: 'Spinach lasagne',
      create: 'Create',
      failed: 'Could not create the meal: {error}',
    },

    lines: {
      title: 'Product lines',
      hint: "The ranges this supplier publishes. They are offered on a meal's Product line field, and a meal already naming a line keeps it whether or not it is listed here.",
      add: 'Add a line',
      empty: 'This supplier publishes no lines yet.',
      placeholder: 'Balance',
      save: 'Save lines',
      edit: "Edit this supplier's lines",
      noProperty: "No property is configured for a company's lines.",
      noSuppliers: 'No company is marked as a meal supplier yet.',
      notSaved: 'The lines could not be saved: {reason}',
    },
    editor: {
      title: 'Edit meal',
      description: 'Description',
      basicInfo: 'Basic info',
      timing: 'Timing (minutes)',
      prep: 'Prep',
      cook: 'Reheat',
      total: 'Total',
      servings: 'Servings',
      price: 'Price',
      readyMeal: 'Ready meal',
      supplier: 'Bought from',
      noSupplier: 'Nobody in particular',
      line: 'Product line',
      noDiet: 'No diet stated',
      image: 'Picture',
      imageNone: 'No picture',
      imageFromVault: 'Choose a picture from the vault',
      imageFromDevice: 'Add a picture from this device',
      imageNotSaved: 'The picture could not be saved: {reason}',
      noLine: 'No line',
      unknownSupplier: '{name} (no company note)',
      diet: 'Diet',
      allergens: 'Allergens',
      nutrition: 'Nutrition',
      perServingLabel: 'Per serving',
      per100gLabel: 'Per 100 g',
      calories: 'Calories',
      protein: 'Protein',
      fat: 'Fat',
      carbs: 'Carbs',
      energy: 'Energy (kJ)',
      // The nutrients themselves are named under `meals.nutrients` below, one
      // key per id, because the two lists are lists now: a fixed label per box
      // could only ever name the boxes one form happened to have.
      macronutrients: 'Macronutrients',
      micronutrients: 'Micronutrients',
      addNutrient: 'Add nutrient',
      noNutrients: 'Nothing declared yet.',
      nutrientName: 'Nutrient',
      nutrientUnit: 'Unit',
      nutrientValue: 'Per 100 g',
      servingGrams: 'Serving (g)',
      computedTotals:
        'Per serving: {calories} kcal, {protein} g protein, {fat} g fat, {carbs} g carbs',
      addPer100g: 'Add per-100 g breakdown',
      save: 'Save changes',
      saving: 'Saving...',
      saveFailed: 'Could not save the meal: {error}',
    },

    // What a nutrient id is called on screen, keyed by the id a note is written
    // in. Reached as `meals.nutrients.{id}` rather than by literal key, so
    // `tests/translation-keys.test.ts` derives the list from the same two id
    // constants the form iterates: a nutrient added to `trail-core` without a
    // label fails there rather than showing a raw key in the editor.
    //
    // The wording follows a UK/EU declaration, which is why saturates and sugars
    // read as "of which": that is how the two sit on a packet, under the fat and
    // the carbohydrate they are part of. Deliberately not the same table as
    // `trail-core`'s `nutrientLabel()`, which exists to match what a note wrote
    // and must go on saying `Saturated Fat`.
    nutrients: {
      fat: 'Fat',
      saturatedFat: 'of which saturates',
      carbs: 'Carbohydrate',
      sugar: 'of which sugars',
      fibre: 'Fibre',
      protein: 'Protein',
      // Salt, not Sodium. The figure under it is grams of salt, which is what a
      // label declares and what this vault's meals state: 0.5 to 1.3 g per
      // 100 g. Read as sodium those same numbers are about two and a half times
      // the truth. Sodium is its own row below, and nothing converts between them.
      salt: 'Salt',
      sodium: 'Sodium',
      potassium: 'Potassium',
      chloride: 'Chloride',
      calcium: 'Calcium',
      phosphorus: 'Phosphorus',
      magnesium: 'Magnesium',
      iron: 'Iron',
      zinc: 'Zinc',
      copper: 'Copper',
      manganese: 'Manganese',
      fluoride: 'Fluoride',
      selenium: 'Selenium',
      chromium: 'Chromium',
      molybdenum: 'Molybdenum',
      iodine: 'Iodine',
      vitaminA: 'Vitamin A',
      vitaminD: 'Vitamin D',
      vitaminE: 'Vitamin E',
      vitaminK: 'Vitamin K',
      vitaminC: 'Vitamin C',
      thiamin: 'Thiamin',
      riboflavin: 'Riboflavin',
      niacin: 'Niacin',
      vitaminB6: 'Vitamin B6',
      folicAcid: 'Folic acid',
      vitaminB12: 'Vitamin B12',
      biotin: 'Biotin',
      pantothenicAcid: 'Pantothenic acid',
    },

    gallery: {
      title: 'Meal gallery',
      searchPlaceholder: 'Search meals',
      addMeal: 'Add meal',
      emptyNoMeals: 'No meals found. Check the meal folder and type settings.',
      emptyNoMatches: 'No meals match the current filters.',
      card: {
        eatenLabel: 'Eaten',
        lastEatenLabel: 'Last',
        actions: 'Meal actions',
        addToMealPlan: 'Add to meal plan',
      },
      sort: {
        title: 'Sort',
        titleField: 'Title',
        dateAdded: 'Date added',
        dateModified: 'Date modified',
        lastEaten: 'Last eaten',
        timesEaten: 'Times eaten',
        ascending: 'Ascending',
        descending: 'Descending',
      },
      filters: {
        title: 'Filter',
        hide: 'Hide filters',
        clear: 'Clear filters',
        allFolders: 'All folders',
        allTags: 'All tags',
        allDiets: 'Any diet',
        favoritesOnly: 'Favorites only',
        neverEaten: 'Never eaten',
        excludeAllergens: 'Hide my allergens',
      },
      stats: {
        oneMeal: ' meal',
        manyMeals: ' meals',
        inFolder: 'in {folder}',
        tagged: 'tagged {tag}',
        sortedBy: 'Sorted by {field}, {direction}',
      },
    },

    reheating: {
      // The section's own name, used only when the heading setting has been
      // cleared. Normally the section calls itself whatever the notes call it.
      title: 'Reheating',
    },
    // The mobile layout, which is a different arrangement rather than a
    // narrower one, and therefore has wording of its own.
    mobile: {
      lastEaten: 'Last eaten',
      prep: 'Prep',
      cook: 'Reheat',
      total: 'Total',
      source: 'Source',
      more: 'more',
      tabs: {
        reheating: 'Reheating',
        // Just "Nutrition" rather than the section's own "per 100 g", because a
        // tab label is a name and not a caption. The basis stays on the heading
        // inside the panel, which is why that heading is not hidden on mobile
        // the way the reheating one is.
        nutrition: 'Nutrition',
        info: 'Info',
      },
    },

    // The declaration table off the packet: energy, then the nutrients the note
    // names, per 100 g. Two words of its own rather than reuse of the strip's
    // below, because these two surfaces answer different questions and the
    // wording should be free to move apart.
    breakdown: {
      title: 'Nutrition per 100 g',
      calories: 'Calories',
      // Spelled out rather than "Energy (kJ)", as the editor's field is: here
      // the unit sits with the figure in the next column, so a label carrying
      // it as well would print it twice on one line.
      kilojoules: 'Kilojoules',
    },

    // The nutrition figures, and the caption saying what they are figures of.
    // The caption is not decoration: the same four numbers mean different
    // things under different settings, and a meal stating nutrition but no
    // servings cannot be converted at all.
    nutrition: {
      calories: 'Calories',
      protein: 'Protein',
      fat: 'Fat',
      carbs: 'Carbs',
      // These name nutrition explicitly because the caption now sits under a
      // strip that also carries times, and "Per serving" alone would read as
      // describing every column rather than the nutrition figures to its left.
      // Abbreviated, for a gallery card. Four columns across a 190px card is
      // 42px each, which "Calories" does not fit on one line, and a label that
      // wraps makes the card taller than its neighbours.
      shortCalories: 'kcal',
      shortProtein: 'prot',
      shortFat: 'fat',
      shortCarbs: 'carb',
      perServing: 'Nutrition per serving',
      total: 'Nutrition for the whole meal',
      storedPerServing: 'Nutrition per serving, as written',
      storedTotal: 'Nutrition for the whole meal, as written',
    },
  },

  // The shared UI kit: the widgets every area builds on rather than any one
  // area's own wording.
  ui: {
    modal: {
      cancel: 'Cancel',
    },
    lightbox: {
      close: 'Close',
    },
    fieldPicker: {
      none: 'Choose a property',
      derived: {
        // A field computed from the note rather than read off it, `@`-prefixed in
        // a saved filter the way a tag filter is `#`-prefixed.
        reheating: 'Has reheating instructions',
      },
      custom: 'Type a property name...',
      customTitle: 'Property name',
      customNote:
        'For a property no meal carries yet. A filter on one matches nothing until a meal has it.',
      customPlaceholder: 'property name',
      customConfirm: 'Use',
    },
  },

  // The planning area: meal plans, per person and per week. Note headings
  // written by the plugin are NOT here: those are stable English keys in
  // src/lang/vocabulary.ts, so a locale change never rewrites a heading in a
  // note that already exists.
  planning: {
    slotPopover: {
      question: 'What meal is this?',
      anytime: 'Anytime',
      dismiss: 'Dismiss',
    },
    mealPlan: {
      title: 'Meal plan',
      person: 'Whose plan',
      addMeal: 'Add a meal',
      clearWeek: 'Clear week',
      noWeek: 'This note does not say which week it is, and its filename does not either.',
      openNote: 'Open this week as Markdown',
      confirmClear: 'Remove all {count} meals from this week?',
      cleared: 'Cleared {count} meals.',
    },
    weekNav: {
      previous: 'Previous week',
      next: 'Next week',
      thisWeek: 'This week',
      weekOf: 'Week of {date}',
      jumpToThisWeek: 'Back to this week',
    },
    grid: {
      queue: 'Queue',
      dropHere: 'Drop a meal here',
      addTo: 'Add to {day}',
    },
    card: {
      actions: 'Meal actions',
      remove: 'Remove from plan',
      eaten: 'Eaten',
      leftovers: 'Leftovers',
      untitledMeal: 'Meal',
    },
    picker: {
      placeholder: 'Search meals, or type a meal',
      addAsMeal: 'Add "{name}" as a meal',
      lastDelivered: 'Just delivered',
    },
    planMeal: {
      title: 'Plan {name}',
      scope: 'Week {week}',
      scopeWithPerson: 'Week {week}, {person}',
      day: 'Day',
      queue: 'No day yet',
      meal: 'Meal',
      noSlot: 'No meal slot',
      confirm: 'Add to plan',
      added: 'Added {name} to week {week}',
      failed: 'Could not write the meal-plan note',
    },
  },

  // The Obsidian-facing half of meal detection.
  // Orders: where the meals come from. Reads Person and Company notes and
  // writes neither.
  orders: {
    // The `culi-related-orders` block, rendered inside a shared CRM note.
    related: {
      noDate: 'No date',
      nothingChosen: 'Nothing chosen yet',
      emptyPerson: 'No orders name this person yet.',
      emptyCompany: 'Nothing ordered from this company yet.',
      notASubject:
        'This block belongs in a Person or Company note. Check the People and Companies folders and type values in settings if this note is one.',
      total: '{count} orders, {amount} {currency}',
    },
    title: 'Orders',
    searchPlaceholder: 'Search orders...',
    emptyNoMatches: 'No order matches the search and filters.',
    sort: {
      title: 'Sort',
      orderDate: 'Order date',
      deliveryDate: 'Delivery date',
      company: 'Supplier',
      total: 'Total',
    },
    filters: {
      allCompanies: 'Every supplier',
      allYears: 'Every year',
      withoutDelivery: 'No delivery logged',
    },
    newOrder: 'New order',
    editOrder: 'Edit order',
    create: 'Create',
    save: 'Save',
    empty: 'No orders yet.',
    orderNumber: 'Order number',
    orderDate: 'Ordered on',
    deliveryDate: 'Delivered on',
    company: 'From',
    noCompany: 'No supplier',
    ordered: 'Ordered',
    delivered: 'Delivered',
    whoOrderedWhat: 'Who ordered what',
    whatItCost: 'What it cost',
    pricePlaceholder: 'price',
    discount: 'Discount',
    discountDesc: 'Taken off the whole order, not off any one meal.',
    shipping: 'Shipping',
    totalDesc:
      'Added up from the meal lines below. Typed by hand only for an order whose lines carry no prices.',
    // An order note read as a document rather than as a row in a list. The
    // column headings are short because the numeric columns are narrow on a
    // phone.
    invoice: {
      document: 'Order',
      dish: 'Meal',
      quantity: 'Qty',
      unitPrice: 'Unit price',
      lineTotal: 'Amount',
      total: 'Total',
      vatIncluded: 'incl. VAT',
      vatIncludedAt: 'incl. {rate}% VAT',
    },
    noPeople: 'No people are configured, so there is nobody to record picks for.',
    searchMeals: 'Filter meals',
    couldNotCreate: 'Could not save the order. Check the Orders folder setting.',
  },

  // Deliveries: what arrived, as against what was asked for.
  deliveries: {
    title: 'Deliveries',
    new: 'Record a delivery',
    edit: 'Edit this delivery',
    recordForOrder: 'Record a delivery for this order',
    date: 'Arrived',
    orders: 'Orders this settles',
    // The delivery note rendered as a document: the order invoice without the
    // money, so it needs its own name for the document and for two columns.
    invoice: {
      document: 'Delivery',
      dish: 'Meal',
      quantity: 'Qty',
      portions: 'Portions',
    },
    ordersHint:
      'Ticking an order fills in what it is still waiting for. Unticking leaves the list alone, because by then it may have been corrected by hand.',
    noOrders: 'No orders yet, so there is nothing to settle. A box can still be recorded.',
    whatArrived: 'What arrived',
    nothingYet: 'Nothing listed yet. Tick an order above, or add a dish.',
    addMeal: 'Add a dish',
    removeItem: 'Remove this dish',
    portions: '{count} portions',
    save: 'Save',
    create: 'Record',
    couldNotCreate: 'Could not save the delivery. Check the Deliveries folder setting.',
  },

  // The dashboard: the one view that reads all four areas. Every panel here
  // summarizes a view that owns its data, and links through to it.
  dashboard: {
    title: 'Kitchen',
    greeting: {
      morning: 'Good morning',
      afternoon: 'Good afternoon',
      evening: 'Good evening',
    },
    actions: {
      searchPlaceholder: 'Search meals...',
      viewMeals: 'View meals',
      viewOrders: 'View orders',
    },
    today: {
      title: 'Meal plan this week',
      openPlan: 'View and edit the meal plan',
      nothingPlanned: 'Your meal plan is empty.',
      planAMeal: 'Plan a meal',
      customMeal: 'Something else',
      more: '+{count} more',
    },
    library: {
      browse: 'Browse all meals',
      empty: 'No meals found. Check the Meals folder and the meal type setting.',
      mealsInVault: 'meals in your vault',
      addFirstMeal: 'Add your first meal',
      mostEaten: 'Most eaten',
      nothingEaten: 'Mark a meal as eaten to see it here.',
      eatenCount: '{count}x',
    },
    newMeals: {
      title: 'New meals',
    },
    activity: {
      title: 'Eating activity',
      recentlyMade: 'Recently eaten',
      nothingEaten: 'Nothing marked eaten yet.',
      oneWeek: '1 week',
      weeks: '{count} weeks',
      weekOf: 'Week of {date}',
      hover: '{prefix}: {count} eaten',
      eatenTimes: '{name} ({count}x)',
    },
  },

  // The one food-safety note that survives: a keyword match over the meal's
  // own allergen list, phrased as information rather than as a verdict.
  safety: {
    allergen: 'Contains something on your allergen list: {allergens}',
  },

  // The command palette. A command is a name pointing at something that
  // already exists, so these are deliberately plain.
  commands: {
    openDashboard: 'Open the kitchen dashboard',
    openGallery: 'Open the meal gallery',
    openMealPlan: 'Open the meal plan',
    openOrders: 'Open orders',
    newMeal: 'New meal',
    editSupplierLines: "Edit a supplier's product lines",
    newDelivery: 'Record a delivery',
    planAMeal: 'Plan a meal',
    resyncMealPlan: 'Resync this week from its notes',
    addToMealPlan: 'Add this meal to the meal plan',
    openInMealView: 'Open in meal view',
    openAsMarkdown: 'Open as Markdown',
    openInOrderView: 'Open in order view',
    openOrderAsMarkdown: 'Open this order as Markdown',
    openInDeliveryView: 'Open in delivery view',
    openDeliveryAsMarkdown: 'Open this delivery as Markdown',
    openInPlanView: 'Open this plan as a week',
    openPlanAsMarkdown: 'Open this plan as Markdown',
    createSampleVault: 'Create the sample notes',
  },

  // The sample vault. The note content itself is English only and is never
  // translated; these are the command, the preview around it and its notices.
  sample: {
    title: 'Create the sample notes',
    subtitle: 'A small, complete set of example notes',
    intro:
      "This writes notes into your vault. Nothing already in it is changed, except that a contact note shared with another plugin gains this plugin's orders block.",
    create: 'Create {count} notes',
    createHeading: 'Would be created',
    skipHeading: 'Already there, left alone',
    augmentHeading: 'Would gain the orders block',
    occupiedHeading: 'These folders hold notes this command did not put there',
    occupiedFolder: '{folder}: {strangers}',
    // Neither a warning nor a refusal: the contact folders belong to every
    // plugin that reads them, so this says what the new notes will sit beside.
    sharedHeading: 'Folders shared with your other plugins',
    sharedFolder:
      '{folder} already holds {count} notes of its own, and the new ones are written beside them: {others}',
    unconfiguredHeading: 'These notes have no folder or no type value configured',
    folderCount: '{folder} ({count})',
    nothingToDo: 'Every sample note is already in this vault.',
    written: 'Created {created} notes, and added the orders block to {augmented}.',
    failed: 'These notes could not be written: {titles}',
    refused: 'Nothing was written: those folders already hold notes of their own.',
  },

  lifecycle: {
    contextMenu: {
      openInMealView: 'Open in meal view',
      openInPlanView: 'Open as a week',
      openInOrderView: 'Open in order view',
      openInDeliveryView: 'Open in delivery view',
    },
  },

  // The fixed vocabularies CULItrail writes into notes. Every one is stored as
  // a stable English key and displayed through these labels, so a locale
  // change never rewrites a `##` heading in a note that already exists. See
  // src/lang/vocabulary.ts, and §G.2 and §G.3 of the split plan.
  vocabulary: {
    weekdays: {
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday',
    },
    mealSlots: {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      snack: 'Snack',
    },
  },

  // Built-in badge labels resolve through these keys rather than being frozen
  // into data.json as strings. A user-defined badge carries its own label.
  badges: {
    builtin: {
      diet: 'Diet',
      prep: 'Prep',
      cook: 'Reheat',
      total: 'Total',
      lastEaten: 'Last eaten',
      streak: 'Streak',
    },
    // The unit lives here rather than in the badge's `suffix`, so it follows the
    // locale instead of freezing into data.json on first save.
    streakWeeks: '{count} weeks',
  },
};
