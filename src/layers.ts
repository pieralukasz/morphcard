// Activation order, scoped to the document. A lower sheet must not handle
// Escape just because its listener was registered first.
const layers = new WeakMap<Document, HTMLElement[]>();

export function activate(sheet: HTMLElement): void {
  deactivate(sheet);
  const stack = layers.get(sheet.ownerDocument) ?? [];
  stack.push(sheet);
  layers.set(sheet.ownerDocument, stack);
}

export function deactivate(sheet: HTMLElement): void {
  const stack = layers.get(sheet.ownerDocument);
  const index = stack?.indexOf(sheet) ?? -1;
  if (index >= 0) stack?.splice(index, 1);
}

export function isTopLayer(sheet: HTMLElement): boolean {
  return layers.get(sheet.ownerDocument)?.at(-1) === sheet;
}
