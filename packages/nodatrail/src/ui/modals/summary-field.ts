/**
 * The summary box on the four PARA forms.
 *
 * A free function taking a container and a get/set pair, for the same reason
 * `numberPriorityField` and `imageField` beside it are: an area and a resource
 * share no base class with a goal and a project, and the box is the same box on
 * all four.
 *
 * The label is translated; the callout keyword behind it is not. See
 * `para/summary.ts`.
 */
import { Setting } from 'obsidian';
import { t } from '../../lang/I18nManager';

export function summaryField(
  container: HTMLElement,
  get: () => string,
  set: (value: string) => void
): void {
  new Setting(container)
    .setName(t('para.summary'))
    .setDesc(t('para.summaryHint'))
    // The row as well as the box, which `FormModal.multiline` has always done
    // and this did not. `.nod-form-area` alone sets a height the stylesheet
    // only grants under `.nod-form-multiline`, so the summary box on all four
    // PARA forms was the small square that class exists to prevent -- the
    // defect described in that method's own comment, in the file next door.
    .setClass('nod-form-multiline')
    .addTextArea((input) => {
      input.inputEl.addClass('nod-form-area');
      input.setValue(get()).onChange(set);
    });
}
