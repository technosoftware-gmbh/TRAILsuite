/**
 * German translation table.
 *
 * Structurally identical to `en.ts`; tests/translation-keys.test.ts asserts
 * that, because a key present in one table and missing from the other fails
 * silently at runtime (t() falls back to English, then to the key itself).
 */

export const deTranslations = {
  settings: {
    nav: {
      back: 'Zurück',
    },
    header: {
      whatsNew: {
        name: 'Neu in CULItrail {version}',
        desc: 'Aktuelle Neuerungen und Verbesserungen ansehen.',
        button: 'Neuerungen ansehen',
      },
      support: {
        name: 'Entwicklung unterstützen',
        desc: 'Wenn sich CULItrail seinen Platz in deinem Vault verdient hat, hältst du damit die Entwicklung am Laufen.',
        sponsor: 'Sponsor werden',
        coffee: 'Einen Kaffee spendieren',
      },
      help: {
        name: 'Hilfe und Kontakt',
        desc: 'Die Dokumentation, der Issue-Tracker und ein Weg zu einem Menschen.',
        docs: 'Dokumentation',
        issues: 'Problem melden',
        contact: 'Support kontaktieren',
      },
    },
    whatsNew: {
      title: 'Neu in CULItrail {version}',
      empty: 'Dieser Build enthält keine Versionshinweise.',
      close: 'Schliessen',
      allReleases: 'Alle Releases auf GitHub',
    },
    vault: {
      title: 'Vault einrichten',
      intro:
        'Wo deine Notizen liegen und wie die Felder darin heissen. Beides wird einmal beim Einrichten gesetzt und danach in Ruhe gelassen.',
      folders: {
        name: 'Ordner',
        desc: 'Die Ordner für Mahlzeiten, Pläne, Bestellungen, Lieferungen und Kontakte, dazu der eine Notizpfad, der eine Datei statt eines Ordners ist.',
        value: '{count} Ordner',
      },
      properties: {
        name: 'Eigenschaftsnamen',
        desc: 'Alle Frontmatter-Namen, die CULItrail liest und schreibt, gruppiert nach dem Notiztyp, der sie trägt.',
        valueLocked: '{count} Namen, gesperrt',
        valueUnlocked: '{count} Namen, änderbar',
      },
    },
    propertyKeys: {
      intro:
        'Die Frontmatter-Namen, die CULItrail liest und schreibt. Ändere einen nur, um einen Namen zu treffen, den deine Notizen bereits verwenden: auf der Festplatte wird nichts mitumbenannt.',
      search: 'Eigenschaft suchen',
      searchNote: 'Filtert die Zeilen unten nach Name oder aktuellem Wert.',
      searchPlaceholder: 'z. B. diet, vat, entry',
    },
    page: {
      itemCount: '{count} Einträge',
    },
    people: {
      title: 'Personen',
      intro: 'Welche deiner Personen-Notizen eine Bestellung überhaupt anbietet.',
    },
    views: {
      title: 'Ansichten öffnen',
      intro: 'Was Obsidian von sich aus tut, wenn du eine Notiz dieser Arten öffnest.',
    },
    list: {
      moveUp: 'Nach oben',
      moveDown: 'Nach unten',
      remove: 'Entfernen',
      edit: 'Bearbeiten',
      save: 'Speichern',
    },
    badges: {
      title: 'Kopfzeilen-Chips',
      note: 'Die Reihenfolge dieser Liste ist das Layout der Kopfzeile. Die beiden Anordnungs-Einträge, Trenner und Zeilenumbruch, dienen dazu, die Chips dazwischen zu verteilen. Ein eingebauter Chip kann bearbeitet und ausgeschaltet, aber nicht entfernt werden.',
      add: 'Chip hinzufügen',
      newBadge: 'Neuer Chip',
      editBadge: 'Chip bearbeiten',
      enabled: 'Sichtbar',
      noProperty: 'keine Eigenschaft',
      separator: 'Trenner',
      newline: 'Zeilenumbruch',
      type: 'Art',
      typeBadge: 'Chip',
      label: 'Beschriftung',
      labelBuiltinDesc:
        'Leer lassen, um den übersetzten Namen zu behalten. Jede Eingabe legt die Beschriftung genau so fest, in jeder Sprache.',
      property: 'Frontmatter-Eigenschaft',
      propertyDesc: 'Was der Chip anzeigt. Leer lassen für einen Chip, der nur eine Formel ist.',
      derivedDesc:
        'Dieser Chip berechnet seinen Wert selbst aus dem Essverlauf und hat daher keine Eigenschaft und keine Formel. Beschriftung, Symbol und Farbe lassen sich weiterhin ändern.',
      formula: 'Formel',
      formulaDesc:
        'Ein Ausdruck über die Eigenschaften der Notiz, etwa (prepTime || 0) + (reheatTime || 0) || null. Ergibt er null, wird der Chip ausgeblendet.',
      icon: 'Symbol',
      color: 'Farbe',
      valueColors: 'Farbe pro Wert',
      valueColorsDesc:
        'Eine Farbe für einen einzelnen Wert dieser Eigenschaft. Alles, was hier nicht steht, nutzt die Farbe oben.',
      valueColorPlaceholder: 'Wert, z. B. Fleisch',
      valueColorAdd: 'Hinzufügen',
      valueColorRemove: 'Diesen Wert entfernen',
      colorDefault: 'Standard',
      colorGreen: 'Grün',
      colorBlue: 'Blau',
      colorPurple: 'Violett',
      colorYellow: 'Gelb',
      colorRed: 'Rot',
      valueType: 'Wert',
      valueTypeDesc:
        'Minuten werden so gezeigt, wie eine Mahlzeit eine Zeit angibt: 1 Std. 15 Min., nicht 75.',
      valueAuto: 'Wie notiert',
      valueMinutes: 'Als Dauer',
      splitArray: 'Ein Chip pro Wert',
      splitArrayDesc:
        'Für eine Listen-Eigenschaft wie Ernährungsform, damit jeder Wert einen eigenen Chip bekommt.',
      hideLabel: 'Beschriftung ausblenden',
      hideLabelDesc:
        'Zeigt nur Symbol und Wert. Ohne Beschriftung bleibt ein Chip immer ein Chip, denn eine Spalte in der Werteleiste braucht eine Überschrift.',
      prefix: 'Präfix',
      suffix: 'Suffix',
      chipOnlyDesc:
        'Gilt nur für die Chip-Darstellung. Ein Wert in der Werteleiste hat weder Symbol noch Farbe.',
    },
    propertyNames: {
      unlock: 'Ändern von Eigenschaftsnamen erlauben',
      unlockDesc:
        'Aus, denn ein hier geänderter Name wird in den Notizen nicht mitgeändert. Das Plugin sucht dann eine Eigenschaft, die keine Notiz trägt, und Galerie, Filter und Plan bleiben leer, ohne zu sagen warum. Nur einschalten, um Namen zu treffen, die eine Vault bereits verwendet, und danach wieder ausschalten. Ordner sind ausgenommen: Ein Ordner lässt sich zurückzeigen, ein Eigenschaftsname nicht.',
      locked:
        'Gesperrt. Oben „Ändern von Eigenschaftsnamen erlauben“ einschalten, um dies zu ändern.',
    },
    status: {
      adoptedFrom: 'CRM-Einstellungen beim ersten Start von {plugin} übernommen',
      adoptedNothing: 'nichts erkannt',
      title: 'Was CULItrail gerade sieht',
      note: 'Eine Notiz zählt nur, wenn sie im Ordner liegt UND den Typwert trägt. Bei null zeigt dies, welches von beidem zu prüfen ist.',
      detail: 'in {folders}, Typ {type}',
      noFolder: 'kein Ordner gesetzt',
      noType: 'kein Typ gesetzt',
      meals: 'Mahlzeiten',
      orders: 'Bestellungen',
      deliveries: 'Lieferungen',
      mealPlans: 'Essenspläne',
      people: 'Personen',
      companies: 'Firmen',
    },
    library: {
      folders: 'Ordner',
      foldersNote:
        'Jede Wurzel bewegt sich als Einheit: Wird sie geändert, folgen ihre Unterordner. Ein leerer Ordner wird übersprungen, nicht als Vault-Wurzel behandelt.',
      rootFolder: 'Wurzelordner',
      rootFolderDesc:
        'Ein optionaler gemeinsamer Ordner über allem. Leer bedeutet die Vault-Wurzel.',
      eatingFolder: 'Essensordner',
      mealsFolder: 'Mahlzeitenordner',
      additionalMealFolders: 'Weitere Mahlzeitenordner',
      additionalMealFoldersDesc:
        'Einer pro Zeile. Nur zum Lesen: Neue Mahlzeiten landen immer im Mahlzeitenordner oben.',
      mealPlansFolder: 'Essensplan-Ordner',
      ordersFolder: 'Bestellordner',
      vocabularies: 'Vokabulare fuer Gerichte',
      vocabulariesNote:
        'Was der Editor fuer Ernaehrung, Allergene und Produktlinie anbietet. Leer bedeutet: nur das, was die Notizen ohnehin verwenden. Ein Wert, der in einer Notiz steht, bleibt in jedem Fall waehlbar.',
      mealDietOptions: 'Ernaehrungsformen',
      mealAllergenOptions: 'Allergene',
      mealLineOptions: 'Produktlinien',
      mealLineOptionsDesc:
        'Bei einem Gericht eines Lieferanten stehen dessen eigene Linien zuoberst.',
      mealSupplierRole: 'Nur Lieferanten mit dieser Rolle',
      mealSupplierRoleDesc:
        'Leer bedeutet: alle Firmen anbieten. Mit einer Rolle, etwa meals, werden nur Firmen angeboten, deren Eigenschaft roles sie traegt -- auch im Befehl fuer die Produktlinien. Eine Firma ohne Rollen wird dann nicht mehr angeboten; trage das also ein, sobald deine Lieferanten markiert sind.',
      notePaths: 'Notizpfade',
      notePathsNote:
        'Vollständige Pfadvorlagen, weil der Dateiname Woche und Person trägt. {GGGG} und {WW} sind ISO-Wochenjahr und Wochennummer; {person} ist der Notiztitel der Person ohne Leerzeichen.',
      mealPlanPath: 'Pfad der Essensplan-Notiz',
      identification: 'Erkennung',
      identificationNote:
        'Eine Notiz gilt nur als Mahlzeit, wenn sie im Ordner liegt UND diesen Typwert trägt. Ein leerer Typwert passt auf nichts statt auf alles.',
      typePropertyName: 'Name der Typ-Eigenschaft',
      mealTypeValue: 'Typwert für Mahlzeiten',
      noteHeader: 'Notizkopf',
      noteHeaderNote:
        'Jede Notiz, die CULItrail anlegt, hält fest, wann sie entstanden ist, und jede Änderung an einer bestehenden Notiz hält fest, wann sie geschah. Ein leerer Name schreibt den jeweiligen Stempel nirgends hin.',
      createdProperty: 'Name der Eigenschaft „Erstellt“',
      createdPropertyDesc:
        'Wird einmal beim Anlegen geschrieben. Eine Notiz, die ohne diesen Wert kam, bekommt ihn nicht nachträglich.',
      modifiedProperty: 'Name der Eigenschaft „Geändert“',
      modifiedPropertyDesc:
        'Wird bei jeder Änderung neu geschrieben, die CULItrail an einer bestehenden Notiz vornimmt.',
      browsing: 'Navigation',
      enableDashboard: 'Dashboard anzeigen',
      enableDashboardDesc:
        'Bestimmt auch die Seitenleiste: an, ein Dashboard-Symbol; aus, je ein Symbol für Galerie und Essensplan.',
      showRibbonIcons: 'Symbole in der Seitenleiste zeigen',
      dashboardActivityRange: 'Zeitraum für Aktivität',
      dashboardActivityRangeDesc:
        'Was „kürzlich“ für die Zählung der zuletzt gegessenen Mahlzeiten bedeutet.',
      weeks: '{count} Wochen',
      openGalleryOnFolderClick: 'Galerie aus der Dateiliste öffnen',
      openGalleryOnFolderClickDesc:
        'Ein Klick auf den Mahlzeitenordner öffnet die Galerie. Der Ordner klappt trotzdem auf.',
      openGalleryOnFolderClickSubfolders: 'Auch Unterordner',
      openGalleryOnFolderClickSubfoldersDesc:
        'Ein Klick auf einen Unterordner filtert die Galerie darauf. Das überschreibt den zuletzt von Hand gesetzten Ordnerfilter.',
      autoOpenMealView: 'Mahlzeiten in der Mahlzeitenansicht öffnen',
      autoOpenMealViewDesc:
        'Aus, und eine Mahlzeit öffnet als gewöhnliches Markdown, bis du die Mahlzeitenansicht über das Dateimenü aufrufst.',
    },
    mealView: {
      headings: 'Abschnittsüberschriften',
      headingsNote:
        'Wonach der Parser im Notiztext sucht. Diese müssen zu deinen Notizen passen, sonst erscheint eine Mahlzeit leer.',
      notesHeading: 'Überschrift Notizen',
      readOnly: 'Nur gelesen, nie geschrieben',
      readOnlyNote:
        'Die beiden Textabschnitte, in denen Mahlzeiten früher ihre Werte pro 100 g führten. Der Editor schreibt diese Werte jetzt ins Frontmatter und erzeugt keinen der beiden Abschnitte mehr. Diese Namen entscheiden also nur noch, ob eine vor der Umstellung geschriebene Mahlzeit weiterhin gelesen werden kann. Lass sie stehen, außer deine Notizen verwenden andere Wörter.',
      nutritionHeading: 'Überschrift Nährwerte (pro 100 g)',
      micronutrientHeading: 'Überschrift Mikronährstoffe (pro 100 g)',
      rendering: 'Darstellung',
      cleanNoteBody: 'Notiztext aufräumen',
      cleanNoteBodyDesc:
        'Blendet eine Titelzeile und ein Titelbild aus, die die Ansicht bereits oben zeigt.',
      useFirstBodyImage: 'Erstes Bild im Text verwenden',
      useFirstBodyImageDesc:
        'Wenn die Bild-Eigenschaft leer ist, das erste eingebettete Bild der Notiz nehmen.',
      defaultMealImage: 'Standardbild',
      defaultMealImageDesc:
        'Wird gezeigt, wenn eine Mahlzeit kein eigenes Bild hat. Ein Vault-Pfad oder eine URL.',
      tags: 'Tags',
      showTagsInHeader: 'Tags im Kopf anzeigen',
      prefixTagsWithHash: 'Führendes # anzeigen',
      showFullTagPath: 'Vollständigen Tag-Pfad anzeigen',
      showFullTagPathDesc: 'Aus, und Family/Close erscheint als Close.',
      nutrition: 'Nährwerte',
      nutritionNote:
        'Zwei leicht zu verwechselnde Einstellungen. Die erste sagt, was die Zahlen in den Notizen bedeuten; die zweite, wie du sie lesen willst. CULItrail rechnet dazwischen um.',
      nutritionSource: 'Was in den Notizen steht',
      nutritionSourceDesc: 'Die Grundlage, auf der die Werte in deinen Mahlzeiten notiert sind.',
      nutritionDisplay: 'Was angezeigt wird',
      nutritionDisplayDesc:
        'Eine Mahlzeit mit Nährwerten, aber ohne Portionsangabe, kann nicht umgerechnet werden und sagt das.',
      perServing: 'Pro Portion',
      wholeMeal: 'Ganze Mahlzeit',
      allergens: 'Allergene',
      allergensNote:
        'Was eine Mahlzeit angibt, wird mit dieser Liste abgeglichen. So kann eine Notiz ein Allergen nennen, das du nicht führst, und umgekehrt.',
      myAllergens: 'Meine Allergene',
      myAllergensDesc:
        'Eines pro Zeile. Steuert auch den Galerie-Filter "Meine Allergene ausblenden".',
      properties: 'Namen der Frontmatter-Eigenschaften',
      propertiesNote:
        'Jede Eigenschaft, die CULItrail liest, hat einen konfigurierbaren Namen. Wenn deine Notizen bereits einer Konvention folgen, ändere die Einstellung statt der Notizen. Einige bekannte Alternativnamen werden nach dem konfigurierten Namen als Rückfall akzeptiert.',
      imageProperty: 'Bild',
      servingsProperty: 'Portionen',
      servingSizeProperty: 'Portionsgröße',
      favoriteProperty: 'Favorit',
      prepTimeProperty: 'Vorbereitungszeit',
      reheatTimeProperty: 'Aufwärmzeit',
      totalTimeProperty: 'Gesamtzeit',
      dietProperty: 'Ernährungsform',
      allergensProperty: 'Allergene',
      caloriesProperty: 'Kalorien',
      proteinProperty: 'Eiweiß',
      fatProperty: 'Fett',
      carbsProperty: 'Kohlenhydrate',
      priceProperty: 'Preis der Mahlzeit',
      lineProperty: 'Produktlinie',
      priceCurrencyProperty: 'Währung des Preises',
      per100g: 'Nährwerte pro 100 g',
      per100gNote:
        'Was auf der Packung steht, als Frontmatter statt als Abschnitt im Notiztext. Zwei Energie-Eigenschaften und zwei Listen mit je einem Eintrag pro Nährstoff. Getrennt von den Werten oben, die pro Portion gelten: Eine Mahlzeit kann beides führen, und keines sagt, was das andere sagt.',
      caloriesPer100gProperty: 'Kalorien pro 100 g',
      kjPer100gProperty: 'Kilojoule pro 100 g',
      macronutrientsProperty: 'Liste der Makronährstoffe',
      micronutrientsProperty: 'Liste der Mikronährstoffe',
      nutrientFields: 'Was ein Nährstoff angibt',
      nutrientFieldsNote:
        'Unterschlüssel innerhalb eines Listeneintrags, keine Eigenschaften der obersten Ebene. Ein Eintrag nennt den Nährstoff, die Einheit und den Wert selbst. Die Einheit wird mitgeschrieben statt angenommen, weil die Packung sie angibt und die übliche nicht immer die aufgedruckte ist.',
      nutrientNameField: 'Feld für den Namen',
      nutrientUnitField: 'Feld für die Einheit',
      nutrientValueField: 'Feld für den Wert',
      writtenOnly: 'Nur geschrieben, nie gelesen',
      writtenOnlyNote:
        'Der Mahlzeiten-Editor schreibt diese eine, und nichts liest sie je zurück, auch der Editor nicht. Sie bekommt trotzdem einen Namen, weil jede von diesem Plugin geschriebene Eigenschaft einen bekommt.',
      kjProperty: 'Kilojoule',
    },
    planning: {
      mealPlan: 'Plannotizen',
      mealPlanNote:
        'Ein Plan ist eine Notiz pro Person und ISO-Woche und führt seine Einträge als Eigenschaftsliste, so wie eine Bestellung ihre Auswahl führt. Woche und Person stehen auch im Dateinamen; die Eigenschaft gewinnt.',
      mealPlanTypeValue: 'Typwert für Pläne',
      weekProperty: 'Eigenschaft Woche',
      personProperty: 'Eigenschaft Person',
      entriesProperty: 'Eigenschaft Einträge',
      entryFields: 'Was ein Eintrag sagt',
      entryFieldsNote:
        'Unterschlüssel innerhalb eines Eintrags, keine Eigenschaften der Notiz. Ein Wikilink im Mahlzeitenfeld ist eine Mahlzeitennotiz; einfacher Text dort ist ein Eintrag ohne Notiz, etwa Resten.',
      entryMealField: 'Feld Mahlzeit',
      entryDayField: 'Feld Tag',
      entrySlotField: 'Feld Essenszeit',
      entryEatenField: 'Feld Gegessen',
      entryRatingField: 'Feld Bewertung',
      entryTimeField: 'Feld Uhrzeit',
      entryNoteField: 'Feld Notiz',
      entryLeftoversField: 'Feld Resten',
      entryIdField: 'Feld Kennung',
      reading: 'Lesen',
      readingNote:
        'Wie eine Plannotiz geöffnet wird und was an Notizen von vor der Umstellung weiterhin verstanden wird.',
      autoOpenMealPlanView: 'Plannotizen als Woche öffnen',
      mealSlotFieldName: 'Alter Feldname der Essenszeit',
      mealSlotFieldNameDesc:
        'Nur lesend. Es wird keine Checklistenzeile mehr geschrieben, aber eine noch nicht umgestellte Notiz trägt weiterhin #meal/lunch oder [meal:: lunch], und dies benennt dieses Feld.',
      eatingHistory: 'Essverlauf',
      eatingHistoryNote:
        'Das Protokoll, aus dem sich das Datum des letzten Essens und die Anzahl ableiten. Ein ausdrücklicher Wert in einer Notiz gewinnt immer gegen den abgeleiteten.',
      eatingHistoryEnabled: 'Essverlauf führen',
      eatingHistoryHeading: 'Überschrift Essverlauf',
      eatingHistoryProperty: 'Eigenschaft Essverlauf',
      lastEatenProperty: 'Eigenschaft zuletzt gegessen',
      eatenCountProperty: 'Eigenschaft Anzahl gegessen',
    },
    reheating: {
      section: 'Fertiggerichte',
      sectionNote:
        'Eine Mahlzeit trägt Aufwärmanweisungen, ein Block je Gerät unter dieser Überschrift. Ein Lieferant kann den Wortlaut einmal auf seiner Firmennotiz halten, und jede Mahlzeit liefert nur die Zahlen.',
      heading: 'Überschrift Aufwärmen',
      tempField: 'Feld Temperatur',
      tempFieldDesc: 'Das Inline-Feld für die Temperatur, etwa [temp:: 95 °C].',
      timeField: 'Feld Dauer',
      timeFieldDesc: 'Das Inline-Feld für die Dauer, etwa [time:: 25 min].',
      appliances: 'Geräte',
      appliancesNote:
        'Womit ein Aufwärmblock überschrieben sein kann. Der Name wird mit der Unterüberschrift in einer Notiz verglichen; die Id daneben ist der Rückfall dafür und bleibt bei einer Umbenennung erhalten, sodass eine Namenskorrektur keine Notiz verwaist.',
      noAppliances: 'Keine Geräte. Es wird kein Aufwärmblock erkannt.',
      addAppliance: 'Gerät hinzufügen',
      appliancePlaceholder: 'Heissluftfritteuse',
      applianceLabels: {
        microwave: 'Mikrowelle',
        oven: 'Backofen',
        steamer: 'Dampfgarer',
        skillet: 'Bratpfanne',
      },
    },
    display: {
      displayLocale: 'Zahlen- und Datumsformat',
      displayLocaleDesc:
        "Ein Locale-Kürzel wie `de-CH` oder `de-DE`, das bestimmt, wie Beträge gruppiert und Daten geordnet werden. Unabhängig von der Oberflächensprache: Deutschland schreibt 100.120,20, die Schweiz 100'120.20. Leer lassen, um diesem Computer zu folgen.",
    },
    orders: {
      orderNote: 'Bestellnotizen',
      orderNoteNote:
        'Die Bestellnummer ist nicht dabei: Sie steht im Dateinamen (jjjj-mm-tt-nummer.md), und das ist die Vereinbarung.',
      orderTypeValue: 'Typwert für Bestellungen',
      companyProperty: 'Eigenschaft Lieferant',
      orderDateProperty: 'Eigenschaft Bestelldatum',
      deliveryDateProperty: 'Eigenschaft Lieferdatum',
      priceProperty: 'Eigenschaft Preis',
      priceCurrencyProperty: 'Eigenschaft Währung',
      defaultCurrency: 'Standardwährung',
      defaultCurrencyDesc:
        'Bei einer neuen Bestellung vorausgefüllt, weil ein Haushalt in einer Währung bestellt.',
      selections: 'Wer hat was bestellt',
      selectionsNote:
        'Eine Liste, ein Eintrag pro Person. Die beiden Feldnamen unten sind Unterschlüssel innerhalb eines Eintrags, keine Eigenschaften oberster Ebene.',
      vat: 'MwSt.',
      vatNote:
        'Preise in einer Bestellnotiz sind Bruttopreise: jeder Betrag ist das, was verrechnet wurde, inklusive Steuer. Mit diesen beiden Feldern kann eine Bestellung zusätzlich angeben, wie viel davon Steuer war; die Rechnung zeigt das dann als enthaltene Position. Es wird nichts daraus berechnet, und eine Bestellung ohne beide Angaben bedeutet weiterhin dasselbe wie bisher.',
      vatRateProperty: 'Eigenschaft MwSt.-Satz',
      vatAmountProperty: 'Eigenschaft MwSt.-Betrag',
      itemDiscountField: 'Feld Rabatt pro Position',
      itemDiscountFieldDesc:
        'Ein Rabatt auf eine einzelne Position, zusätzlich zum Rabatt auf die ganze Bestellung. Ein Unterschlüssel innerhalb einer Position, keine Eigenschaft der Notiz.',
      deliveries: 'Lieferungen',
      deliveriesNote:
        'Eine Lieferung sagt, was tatsächlich angekommen ist und wann, was eine Bestellung nicht kann: eine Bestellung kann in zwei Paketen mit einer Woche Abstand kommen, und ein Paket kann zwei Bestellungen abdecken. Die Mahlzeitenauswahl bietet die zuletzt gelieferten Mahlzeiten zuerst an.',
      deliveriesFolder: 'Ordner Lieferungen',
      deliveryTypeValue: 'Typwert für Lieferungen',
      deliveryNoteDateProperty: 'Eigenschaft Lieferdatum',
      deliveryOrdersProperty: 'Eigenschaft Bestellungen',
      deliveryItemsProperty: 'Eigenschaft Positionen',
      deliveryItemMealField: 'Feld Mahlzeit einer Position',
      deliveryItemQuantityField: 'Feld Menge einer Position',
      companyTerms: 'Was ein Unternehmen verrechnet',
      companyTermsNote:
        'Wird von der Unternehmensnotiz gelesen und nie in sie geschrieben, genau wie deren Aufwärmanweisungen. Eine Bestellung wird daraus vorbelegt, in der Notiz landet aber eine einfache Zahl: eine Bestellung bleibt die Aufzeichnung dessen, was tatsächlich verrechnet wurde.',
      companyCurrencyProperty: 'Eigenschaft Währung',
      companyPaymentMethodProperty: 'Eigenschaft Zahlungsart',
      companyInvoiceTimingProperty: 'Eigenschaft Rechnungszeitpunkt',
      companyShippingFeeProperty: 'Eigenschaft Versandkosten',
      companyFreeShippingFromProperty: 'Eigenschaft Versandfrei ab',
      companyFreeShippingFromPropertyDesc:
        'Ab wie vielen Mahlzeiten in einer Bestellung die Lieferung kostenlos ist.',
      companyDiscountTableProperty: 'Eigenschaft Rabatttabelle',
      companyDiscountTablePropertyDesc:
        'Eine Staffel aus Zeilen, gezählt in Mahlzeiten. Schreibe eine Zeile entweder als "from: 12" mit "percent: 10" oder einzeilig als "12: 10". Die höchste Zeile bis zur Anzahl gewinnt.',
      companyLinesProperty: 'Eigenschaft Produktlinien',
      companyLinesPropertyDesc:
        'Die Linien, unter denen ein Unternehmen dasselbe Gericht anbietet, etwa Alltag, Sport und Weightloss. Wird bei der Auswahl der Linie einer Mahlzeit angeboten.',
      selectionsProperty: 'Eigenschaft Auswahl',
      selectionPersonField: 'Feld Person',
      selectionMealsField: 'Feld Mahlzeiten',
      selectionItemsField: 'Feld für Positionen',
      selectionItemsFieldDesc:
        'Die Liste mit Preisen, die das Mahlzeitenfeld ersetzt, sobald eine Position einen Preis oder eine Menge trägt. Eine Bestellung ohne beides behält die bisherige Form.',
      itemMealField: 'Feld für die Mahlzeit',
      itemPriceField: 'Feld für den Preis',
      itemQuantityField: 'Feld für die Menge',
      discountProperty: 'Eigenschaft für den Rabatt',
      discountPropertyDesc:
        'Wird von der ganzen Bestellung abgezogen, nicht von einer einzelnen Mahlzeit.',
      shippingProperty: 'Eigenschaft für den Versand',
      legacyPrefix: 'Altes Präfix pro Person',
      legacyPrefixDesc:
        'Wird nur gelesen, für Bestellungen von vor der obigen Liste. Einmaliges Speichern rüstet sie um.',
      autoOpenOrderView: 'Bestellungen als Rechnung öffnen',
      autoOpenOrderViewDesc:
        'Aus, und eine Bestellung öffnet als gewöhnliches Markdown, bis du die Bestellansicht über das Dateimenü aufrufst.',
      autoOpenDeliveryView: 'Lieferungen als Dokument öffnen',
      autoOpenDeliveryViewDesc:
        'Eine Liefernotiz sagt alles in ihren Eigenschaften, aus siehst du also eine leere Notiz.',
      crm: 'Personen und Firmen',
      crmNote:
        'CULItrail liest diese Notizen und schreibt keine davon. Diese Namen und Typwerte sind wörtlich aus APERtrails eigenen Vorgaben übernommen, und genau das ist der Mechanismus, über den beide Plugins dieselben Notizen lesen. Eine Änderung hier ohne dieselbe dort bricht das stillschweigend.',
      crmFolder: 'CRM-Ordner',
      personsFolder: 'Personenordner',
      companiesFolder: 'Firmenordner',
      personTypeValue: 'Typwert für Personen',
      companyTypeValue: 'Typwert für Firmen',
      personTagProperty: 'Eigenschaft Personen-Tag',
      personRolesProperty: 'Rollen der Person',
      companyRolesProperty: 'Rollen der Firma',
      companyTagProperty: 'Eigenschaft Firmen-Tag',
      supplierProperty: 'Eigenschaft Lieferant',
      supplierPropertyDesc:
        'Welche Firma eine Mahlzeit verkauft, wenn es nicht die Firma der neuesten Bestellung dazu ist. Ein Wikilink auf eine Firmennotiz.',
      eligiblePersonTags: 'Haushalts-Tags',
      eligiblePersonTagsDesc:
        'Welche Personen für Essenspläne und Bestellungen angeboten werden. Leer heißt alle, nie niemand. Ein übergeordneter Tag schließt seine untergeordneten ein.',
    },
    about: {
      title: 'CULItrail',
      credits: 'Danksagung',
      vendor: 'Technosoftware GmbH',
      vendorLink: 'technosoftware.com',
      originalProject: 'Das Originalprojekt ansehen',
      mealBox: 'Aufbauend auf Recipe Box von Arcane Tech / AdamArcane.',
      licence: 'GPL-3.0-or-later. Die vollständige Zuschreibung steht in NOTICE.md im Repository.',
    },
    folders: {
      defaults: {
        rootFolderPath: '',
        eatingFolderName: 'Essen',
        mealsFolderName: 'Mahlzeiten',
        mealPlansFolderName: 'Essenspläne',
        ordersFolderName: 'Bestellungen',
        deliveriesFolderName: 'Lieferungen',
        // Verbatim from APERtrail's German table. Do not "improve" these.
        crmFolderName: 'CRM',
        personsFolderName: 'Personen',
        companiesFolderName: 'Firmen',
      },
    },
    headings: {
      defaults: {
        notes: 'Notizen',
        reheating: 'Aufwärmen',
        eatingHistory: 'Essverlauf',
      },
    },
  },

  meals: {
    time: {
      minutes: '{m} Min.',
      hours: '{h} Std.',
      hoursMinutes: '{h} Std. {m} Min.',
    },

    view: {
      untitled: 'Mahlzeit',
      editAsMarkdown: 'Als Markdown bearbeiten',
      kitchenModeOn: 'Küchenmodus an, Bildschirm bleibt an',
      kitchenModeOff: 'Küchenmodus aus',
      kitchenModeOnNotice: 'Küchenmodus an. Der Bildschirm bleibt an.',
      kitchenModeOffNotice: 'Küchenmodus aus.',
      wakeLockUnsupported: 'Dieses Gerät kann den Bildschirm nicht anlassen.',
      wakeLockFailed: 'Der Bildschirm konnte nicht angelassen werden.',
    },

    header: {
      serves: 'Portionen',
      supplierFromOrder: 'aus deiner letzten Bestellung',
      toggleFavorite: 'Favorit',
      addToPlan: 'Zum Essensplan hinzufügen',
      onThePlan: 'Im Essensplan',
      markEaten: 'Als gegessen markieren',
      editMeal: 'Mahlzeit bearbeiten',
    },

    markEaten: {
      title: 'Als gegessen markieren',
      when: 'Wann',
      who: 'Wer hat gegessen',
      nobody: 'Nicht erfasst',
      rating: 'Wie war es',
      note: 'Notizen',
      notePlaceholder: 'Was du dir für das nächste Mal merken willst.',
      confirm: 'Als gegessen markieren',
    },

    eatingHistory: {
      title: 'Essverlauf',
      empty: 'Noch nichts erfasst.',
    },
    create: {
      title: 'Neue Mahlzeit',
      subtitle: 'Der Name ist die Notiz, deshalb wird hier nur er gefragt.',
      name: 'Name',
      namePlaceholder: 'Spinatlasagne',
      create: 'Anlegen',
      failed: 'Die Mahlzeit konnte nicht angelegt werden: {error}',
    },

    lines: {
      title: 'Produktlinien',
      hint: 'Die Linien, die dieser Lieferant fuehrt. Sie werden beim Feld Produktlinie eines Gerichts angeboten; ein Gericht behaelt seine Linie in jedem Fall, auch wenn sie hier fehlt.',
      add: 'Linie hinzufuegen',
      empty: 'Dieser Lieferant fuehrt noch keine Linien.',
      placeholder: 'Balance',
      save: 'Linien speichern',
      edit: 'Linien dieses Lieferanten bearbeiten',
      noProperty: 'Fuer die Linien einer Firma ist keine Eigenschaft konfiguriert.',
      noSuppliers: 'Noch keine Firma ist als Essenslieferant markiert.',
      notSaved: 'Die Linien konnten nicht gespeichert werden: {reason}',
    },
    editor: {
      title: 'Mahlzeit bearbeiten',
      description: 'Beschreibung',
      basicInfo: 'Eckdaten',
      timing: 'Zeiten (Minuten)',
      prep: 'Vorbereitung',
      cook: 'Aufwärmen',
      total: 'Gesamt',
      servings: 'Portionen',
      price: 'Preis',
      readyMeal: 'Fertiggericht',
      supplier: 'Gekauft bei',
      noSupplier: 'Niemandem bestimmten',
      line: 'Produktlinie',
      noDiet: 'Keine Angabe',
      image: 'Bild',
      imageNone: 'Kein Bild',
      imageFromVault: 'Bild aus dem Vault waehlen',
      imageFromDevice: 'Bild von diesem Geraet hinzufuegen',
      imageNotSaved: 'Das Bild konnte nicht gespeichert werden: {reason}',
      noLine: 'Keine Linie',
      unknownSupplier: '{name} (keine Firmennotiz)',
      diet: 'Ernährung',
      allergens: 'Allergene',
      nutrition: 'Nährwerte',
      perServingLabel: 'Pro Portion',
      per100gLabel: 'Pro 100 g',
      calories: 'Kalorien',
      protein: 'Eiweiss',
      fat: 'Fett',
      carbs: 'Kohlenhydrate',
      energy: 'Energie (kJ)',
      // Die Nährstoffe selbst stehen unter `meals.nutrients`, ein Schlüssel je
      // Kennung, weil die beiden Listen jetzt Listen sind: eine feste
      // Beschriftung pro Feld könnte nur die Felder benennen, die ein
      // bestimmtes Formular zufällig hatte.
      macronutrients: 'Makronährstoffe',
      micronutrients: 'Mikronährstoffe',
      addNutrient: 'Nährstoff hinzufügen',
      noNutrients: 'Noch nichts angegeben.',
      nutrientName: 'Nährstoff',
      nutrientUnit: 'Einheit',
      nutrientValue: 'Pro 100 g',
      servingGrams: 'Portion (g)',
      computedTotals:
        'Pro Portion: {calories} kcal, {protein} g Eiweiss, {fat} g Fett, {carbs} g Kohlenhydrate',
      addPer100g: 'Aufschlüsselung pro 100 g ergänzen',
      save: 'Änderungen speichern',
      saving: 'Speichern...',
      saveFailed: 'Die Mahlzeit konnte nicht gespeichert werden: {error}',
    },

    // Wie eine Nährstoffkennung auf dem Bildschirm heisst, geschlüsselt nach der
    // Kennung, in der eine Notiz geschrieben ist. Wird als
    // `meals.nutrients.{id}` erreicht und nicht als fester Schlüssel, damit
    // `tests/translation-keys.test.ts` die Liste aus denselben beiden Konstanten
    // ableitet, über die das Formular läuft: Ein Nährstoff, der in `trail-core`
    // ohne Beschriftung ergänzt wird, fällt dort auf und nicht erst als roher
    // Schlüssel im Editor.
    //
    // Die Wortwahl folgt der Packungsangabe, deshalb "davon". Bewusst nicht
    // dieselbe Tabelle wie `nutrientLabel()` in `trail-core`: die dient dem
    // Abgleich mit dem, was eine Notiz geschrieben hat.
    nutrients: {
      fat: 'Fett',
      saturatedFat: 'davon gesättigte Fettsäuren',
      carbs: 'Kohlenhydrate',
      sugar: 'davon Zucker',
      fibre: 'Ballaststoffe',
      // Eiweiss statt Eiweiß, wie in `meals.editor` daneben.
      protein: 'Eiweiss',
      // Salz, nicht Natrium. Darunter stehen Gramm Salz, so wie es die Packung
      // angibt und wie es die Mahlzeiten in diesem Vault führen: 0,5 bis 1,3 g
      // pro 100 g. Als Natrium gelesen wären dieselben Zahlen rund das
      // Zweieinhalbfache der Wahrheit. Natrium hat unten seine eigene Zeile, und
      // nichts rechnet zwischen beiden um.
      salt: 'Salz',
      sodium: 'Natrium',
      potassium: 'Kalium',
      chloride: 'Chlorid',
      calcium: 'Calcium',
      phosphorus: 'Phosphor',
      magnesium: 'Magnesium',
      iron: 'Eisen',
      zinc: 'Zink',
      copper: 'Kupfer',
      manganese: 'Mangan',
      fluoride: 'Fluorid',
      selenium: 'Selen',
      chromium: 'Chrom',
      molybdenum: 'Molybdän',
      iodine: 'Jod',
      vitaminA: 'Vitamin A',
      vitaminD: 'Vitamin D',
      vitaminE: 'Vitamin E',
      vitaminK: 'Vitamin K',
      vitaminC: 'Vitamin C',
      thiamin: 'Thiamin',
      riboflavin: 'Riboflavin',
      niacin: 'Niacin',
      vitaminB6: 'Vitamin B6',
      folicAcid: 'Folsäure',
      vitaminB12: 'Vitamin B12',
      biotin: 'Biotin',
      pantothenicAcid: 'Pantothensäure',
    },

    gallery: {
      title: 'Mahlzeitengalerie',
      searchPlaceholder: 'Mahlzeiten suchen',
      addMeal: 'Mahlzeit hinzufügen',
      emptyNoMeals: 'Keine Mahlzeiten gefunden. Bitte Mahlzeitenordner und Typwert prüfen.',
      emptyNoMatches: 'Keine Mahlzeiten passen zu den aktuellen Filtern.',
      card: {
        eatenLabel: 'Gegessen',
        lastEatenLabel: 'Zuletzt',
        actions: 'Aktionen',
        addToMealPlan: 'Zum Essensplan hinzufügen',
      },
      sort: {
        title: 'Sortieren',
        titleField: 'Titel',
        dateAdded: 'Erstellt am',
        dateModified: 'Geändert am',
        lastEaten: 'Zuletzt gegessen',
        timesEaten: 'Anzahl gegessen',
        ascending: 'Aufsteigend',
        descending: 'Absteigend',
      },
      filters: {
        title: 'Filtern',
        hide: 'Filter ausblenden',
        clear: 'Filter zurücksetzen',
        allFolders: 'Alle Ordner',
        allTags: 'Alle Tags',
        allDiets: 'Alle Ernährungsformen',
        favoritesOnly: 'Nur Favoriten',
        neverEaten: 'Noch nie gegessen',
        excludeAllergens: 'Meine Allergene ausblenden',
      },
      stats: {
        oneMeal: ' Mahlzeit',
        manyMeals: ' Mahlzeiten',
        inFolder: 'in {folder}',
        tagged: 'mit Tag {tag}',
        sortedBy: 'Sortiert nach {field}, {direction}',
      },
    },

    reheating: {
      // Der eigene Name des Abschnitts, nur verwendet, wenn die Einstellung für
      // die Überschrift geleert wurde. Normalerweise heisst der Abschnitt so,
      // wie die Notizen ihn nennen.
      title: 'Aufwärmen',
    },
    mobile: {
      lastEaten: 'Zuletzt gegessen',
      prep: 'Vorbereitung',
      cook: 'Aufwärmzeit',
      total: 'Gesamt',
      source: 'Quelle',
      more: 'mehr',
      tabs: {
        reheating: 'Aufwärmen',
        // Nur "Nährwerte", nicht "pro 100 g": ein Tab-Titel ist ein Name und
        // keine Beschriftung. Die Bezugsgrösse steht auf der Überschrift im
        // Panel, die deshalb auf dem Handy anders als beim Aufwärmen sichtbar
        // bleibt.
        nutrition: 'Nährwerte',
        info: 'Info',
      },
    },

    // Die Nährwerttabelle von der Packung: Energie, dann die Nährstoffe, die
    // die Notiz nennt, pro 100 g. Eigene Wörter statt der Leiste unten, weil
    // die beiden Flächen verschiedene Fragen beantworten.
    breakdown: {
      title: 'Nährwerte pro 100 g',
      calories: 'Kalorien',
      // Ausgeschrieben statt "Energie (kJ)" wie im Editor: hier steht die
      // Einheit in der Spalte daneben, ein Label mit Einheit würde sie in
      // derselben Zeile zweimal nennen.
      kilojoules: 'Kilojoule',
    },

    nutrition: {
      calories: 'Kalorien',
      protein: 'Eiweiß',
      fat: 'Fett',
      carbs: 'Kohlenhydrate',
      // Nennen die Nährwerte ausdrücklich, weil die Beschriftung jetzt unter
      // einer Leiste steht, die auch Zeiten trägt.
      // Abgekürzt, für eine Karte in der Galerie. Vier Spalten auf 190px sind
      // 42px pro Spalte; ein umbrechendes Label macht die Karte höher als ihre
      // Nachbarn.
      shortCalories: 'kcal',
      shortProtein: 'eiw',
      shortFat: 'fett',
      shortCarbs: 'kh',
      perServing: 'Nährwerte pro Portion',
      total: 'Nährwerte für die ganze Mahlzeit',
      storedPerServing: 'Nährwerte pro Portion, wie notiert',
      storedTotal: 'Nährwerte für die ganze Mahlzeit, wie notiert',
    },
  },

  ui: {
    modal: {
      cancel: 'Abbrechen',
    },
    lightbox: {
      close: 'Schließen',
    },
    fieldPicker: {
      none: 'Eigenschaft wählen',
      derived: {
        reheating: 'Hat Aufwärmanweisungen',
      },
      custom: 'Eigenschaftsnamen eingeben ...',
      customTitle: 'Eigenschaftsname',
      customNote:
        'Für eine Eigenschaft, die noch keine Mahlzeit hat. Ein Filter darauf trifft auf nichts zu, bis eine Mahlzeit sie besitzt.',
      customPlaceholder: 'Eigenschaftsname',
      customConfirm: 'Verwenden',
    },
  },

  planning: {
    slotPopover: {
      question: 'Zu welcher Essenszeit?',
      anytime: 'Jederzeit',
      dismiss: 'Schliessen',
    },
    mealPlan: {
      title: 'Essensplan',
      person: 'Für wen',
      addMeal: 'Mahlzeit hinzufügen',
      clearWeek: 'Woche leeren',
      noWeek: 'Diese Notiz sagt nicht, welche Woche sie ist, und ihr Dateiname auch nicht.',
      openNote: 'Diese Woche als Markdown öffnen',
      confirmClear: 'Alle {count} Mahlzeiten dieser Woche entfernen?',
      cleared: '{count} Mahlzeiten entfernt.',
    },
    weekNav: {
      previous: 'Vorherige Woche',
      next: 'Nächste Woche',
      thisWeek: 'Diese Woche',
      weekOf: 'Woche vom {date}',
      jumpToThisWeek: 'Zurück zu dieser Woche',
    },
    grid: {
      queue: 'Warteschlange',
      dropHere: 'Mahlzeit hierher ziehen',
      addTo: 'Zu {day} hinzufügen',
    },
    card: {
      actions: 'Aktionen',
      remove: 'Aus dem Plan entfernen',
      eaten: 'Gegessen',
      leftovers: 'Reste',
      untitledMeal: 'Mahlzeit',
    },
    picker: {
      placeholder: 'Mahlzeiten suchen oder eine eingeben',
      addAsMeal: '„{name}“ als Mahlzeit hinzufügen',
      lastDelivered: 'Gerade geliefert',
    },
    planMeal: {
      title: '{name} einplanen',
      scope: 'Woche {week}',
      scopeWithPerson: 'Woche {week}, {person}',
      day: 'Tag',
      queue: 'Noch kein Tag',
      meal: 'Essenszeit',
      noSlot: 'Keine Essenszeit',
      confirm: 'Einplanen',
      added: '{name} zu Woche {week} hinzugefügt',
      failed: 'Die Essensplan-Notiz konnte nicht geschrieben werden',
    },
  },

  orders: {
    related: {
      noDate: 'Kein Datum',
      nothingChosen: 'Noch nichts ausgewählt',
      emptyCompany: 'Bei dieser Firma wurde noch nichts bestellt.',
      emptyPerson: 'Noch keine Bestellung nennt diese Person.',
      notASubject:
        'Dieser Block gehört in eine Personen- oder Firmennotiz. Bitte Ordner und Typwerte für Personen und Firmen in den Einstellungen prüfen, falls diese Notiz eine ist.',
      total: '{count} Bestellungen, {amount} {currency}',
    },
    title: 'Bestellungen',
    searchPlaceholder: 'Bestellungen durchsuchen ...',
    emptyNoMatches: 'Keine Bestellung passt zu Suche und Filtern.',
    sort: {
      title: 'Sortieren',
      orderDate: 'Bestelldatum',
      deliveryDate: 'Lieferdatum',
      company: 'Lieferant',
      total: 'Summe',
    },
    filters: {
      allCompanies: 'Alle Lieferanten',
      allYears: 'Alle Jahre',
      withoutDelivery: 'Keine Lieferung erfasst',
    },
    newOrder: 'Neue Bestellung',
    editOrder: 'Bestellung bearbeiten',
    create: 'Anlegen',
    save: 'Speichern',
    empty: 'Noch keine Bestellungen.',
    orderNumber: 'Bestellnummer',
    orderDate: 'Bestellt am',
    deliveryDate: 'Geliefert am',
    company: 'Von',
    noCompany: 'Kein Lieferant',
    ordered: 'Bestellt',
    delivered: 'Geliefert',
    whoOrderedWhat: 'Wer hat was bestellt',
    whatItCost: 'Was es gekostet hat',
    pricePlaceholder: 'Preis',
    discount: 'Rabatt',
    discountDesc: 'Wird von der ganzen Bestellung abgezogen, nicht von einer einzelnen Mahlzeit.',
    shipping: 'Versand',
    totalDesc:
      'Wird aus den Positionen unten aufsummiert. Nur bei einer Bestellung ohne Positionspreise von Hand eingetragen.',
    invoice: {
      document: 'Bestellung',
      dish: 'Mahlzeit',
      quantity: 'Anz.',
      unitPrice: 'Einzelpreis',
      lineTotal: 'Betrag',
      total: 'Gesamtbetrag',
      vatIncluded: 'inkl. MwSt.',
      vatIncludedAt: 'inkl. {rate}% MwSt.',
    },
    noPeople: 'Es sind keine Personen konfiguriert, also gibt es niemanden zu erfassen.',
    searchMeals: 'Mahlzeiten filtern',
    couldNotCreate: 'Bestellung konnte nicht gespeichert werden. Bitte den Bestellordner prüfen.',
  },

  deliveries: {
    title: 'Lieferungen',
    new: 'Lieferung erfassen',
    edit: 'Diese Lieferung bearbeiten',
    recordForOrder: 'Lieferung zu dieser Bestellung erfassen',
    date: 'Angekommen',
    orders: 'Zugehörige Bestellungen',
    invoice: {
      document: 'Lieferung',
      dish: 'Mahlzeit',
      quantity: 'Anz.',
      portions: 'Portionen',
    },
    ordersHint:
      'Eine angehakte Bestellung füllt ein, was noch aussteht. Das Entfernen des Hakens lässt die Liste stehen, denn sie kann inzwischen von Hand korrigiert worden sein.',
    noOrders:
      'Noch keine Bestellungen, also gibt es nichts zuzuordnen. Eine Lieferung lässt sich trotzdem erfassen.',
    whatArrived: 'Was angekommen ist',
    nothingYet: 'Noch nichts erfasst. Oben eine Bestellung anhaken oder ein Gericht hinzufügen.',
    addMeal: 'Gericht hinzufügen',
    removeItem: 'Dieses Gericht entfernen',
    portions: '{count} Portionen',
    save: 'Speichern',
    create: 'Erfassen',
    couldNotCreate: 'Lieferung konnte nicht gespeichert werden. Bitte den Lieferordner prüfen.',
  },

  dashboard: {
    title: 'Küche',
    greeting: {
      morning: 'Guten Morgen',
      afternoon: 'Guten Tag',
      evening: 'Guten Abend',
    },
    actions: {
      searchPlaceholder: 'Mahlzeiten suchen...',
      viewMeals: 'Mahlzeiten ansehen',
      viewOrders: 'Bestellungen ansehen',
    },
    today: {
      title: 'Essensplan diese Woche',
      openPlan: 'Essensplan ansehen und bearbeiten',
      nothingPlanned: 'Dein Essensplan ist leer.',
      planAMeal: 'Mahlzeit einplanen',
      customMeal: 'Etwas anderes',
      more: '+{count} weitere',
    },
    library: {
      browse: 'Alle Mahlzeiten ansehen',
      empty: 'Keine Mahlzeiten gefunden. Prüfe den Mahlzeitenordner und den Typwert.',
      mealsInVault: 'Mahlzeiten in deinem Vault',
      addFirstMeal: 'Erste Mahlzeit anlegen',
      mostEaten: 'Am häufigsten gegessen',
      nothingEaten: 'Markiere eine Mahlzeit als gegessen, damit sie hier erscheint.',
      eatenCount: '{count}x',
    },
    newMeals: {
      title: 'Neue Mahlzeiten',
    },
    activity: {
      title: 'Essaktivität',
      recentlyMade: 'Zuletzt gegessen',
      nothingEaten: 'Noch nichts als gegessen markiert.',
      oneWeek: '1 Woche',
      weeks: '{count} Wochen',
      weekOf: 'Woche vom {date}',
      hover: '{prefix}: {count} gegessen',
      eatenTimes: '{name} ({count}x)',
    },
  },

  safety: {
    allergen: 'Enthält etwas von deiner Allergenliste: {allergens}',
  },

  commands: {
    openDashboard: 'Küchen-Dashboard öffnen',
    openGallery: 'Mahlzeitengalerie öffnen',
    openMealPlan: 'Essensplan öffnen',
    openOrders: 'Bestellungen öffnen',
    newMeal: 'Neue Mahlzeit',
    editSupplierLines: 'Produktlinien eines Lieferanten bearbeiten',
    newDelivery: 'Lieferung erfassen',
    planAMeal: 'Mahlzeit einplanen',
    resyncMealPlan: 'Diese Woche aus den Notizen neu abgleichen',
    addToMealPlan: 'Diese Mahlzeit zum Essensplan hinzufügen',
    openInMealView: 'In der Mahlzeitenansicht öffnen',
    openAsMarkdown: 'Als Markdown öffnen',
    openInOrderView: 'In der Bestellansicht öffnen',
    openInPlanView: 'Diesen Plan als Woche öffnen',
    openPlanAsMarkdown: 'Diesen Plan als Markdown öffnen',
    openOrderAsMarkdown: 'Diese Bestellung als Markdown öffnen',
    openInDeliveryView: 'In der Lieferansicht öffnen',
    openDeliveryAsMarkdown: 'Diese Lieferung als Markdown öffnen',
    createSampleVault: 'Beispielnotizen anlegen',
  },

  // Das Beispiel-Vault. Die Notizen selbst sind ausschliesslich englisch und
  // werden nicht übersetzt; hier stehen der Befehl, die Vorschau und die
  // Meldungen darum herum.
  sample: {
    title: 'Beispielnotizen anlegen',
    subtitle: 'Ein kleiner, vollständiger Satz Beispielnotizen',
    intro:
      'Damit werden Notizen in dein Vault geschrieben. An vorhandenen Notizen ändert sich nichts, ausser dass eine mit einem anderen Plugin geteilte Kontaktnotiz den Bestellblock dieses Plugins erhält.',
    create: '{count} Notizen anlegen',
    createHeading: 'Wird angelegt',
    skipHeading: 'Schon vorhanden, bleibt unverändert',
    augmentHeading: 'Erhält den Bestellblock',
    occupiedHeading: 'In diesen Ordnern liegen Notizen, die dieser Befehl nicht angelegt hat',
    occupiedFolder: '{folder}: {strangers}',
    // Weder Warnung noch Ablehnung: Die Kontaktordner gehören jedem Plugin,
    // das sie liest, also steht hier, woneben die neuen Notizen landen.
    sharedHeading: 'Ordner, die du mit deinen anderen Plugins teilst',
    sharedFolder:
      'In {folder} liegen bereits {count} eigene Notizen, die neuen kommen daneben: {others}',
    unconfiguredHeading: 'Für diese Notizen ist kein Ordner oder kein Typwert konfiguriert',
    folderCount: '{folder} ({count})',
    nothingToDo: 'Alle Beispielnotizen liegen bereits in diesem Vault.',
    written: '{created} Notizen angelegt und bei {augmented} den Bestellblock ergänzt.',
    failed: 'Diese Notizen konnten nicht geschrieben werden: {titles}',
    refused: 'Es wurde nichts geschrieben: In diesen Ordnern liegen bereits eigene Notizen.',
  },

  lifecycle: {
    contextMenu: {
      openInMealView: 'In Mahlzeitenansicht öffnen',
      openInPlanView: 'Als Woche öffnen',
      openInOrderView: 'In Bestellansicht öffnen',
      openInDeliveryView: 'In Lieferansicht öffnen',
    },
  },

  vocabulary: {
    weekdays: {
      monday: 'Montag',
      tuesday: 'Dienstag',
      wednesday: 'Mittwoch',
      thursday: 'Donnerstag',
      friday: 'Freitag',
      saturday: 'Samstag',
      sunday: 'Sonntag',
    },
    mealSlots: {
      breakfast: 'Frühstück',
      lunch: 'Mittagessen',
      dinner: 'Abendessen',
      snack: 'Snack',
    },
  },

  badges: {
    builtin: {
      diet: 'Ernährung',
      prep: 'Vorbereitung',
      cook: 'Aufwärmzeit',
      total: 'Gesamt',
      lastEaten: 'Zuletzt gegessen',
      streak: 'Serie',
    },
    streakWeeks: '{count} Wochen',
  },
};
