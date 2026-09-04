/**
 * The price line, on a card and in a meal header.
 *
 * A thin function for one element, and it exists for the one thing that is easy
 * to get wrong: **the element is created whether or not there is a price.** On a
 * gallery card the rows are a fixed height because a card is a grid item
 * stretched to its row, so a card that skipped this line would be shorter and
 * its neighbours would grow to fill the row instead. Skipping it is exactly the
 * bug the meal-plan week cards had.
 */
export function renderPriceLine(
  container: HTMLElement,
  price: string | null,
  cls: string
): HTMLElement {
  const line = container.createDiv({ cls: ['culi-price', cls] });
  if (price) line.setText(price);
  return line;
}
