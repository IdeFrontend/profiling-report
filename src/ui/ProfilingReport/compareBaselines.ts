/** Next compare baseline after the checked list loses the selected one. */
export function nextCompareBaselineId(
  items: readonly { id: string }[],
  prev: readonly { id: string }[] | undefined,
  selected: string,
): string {
  const removedIndex = (prev ?? []).findIndex((b) => b.id === selected);
  return (removedIndex < 0
    ? items[items.length - 1]!
    : items[Math.min(removedIndex, items.length - 1)]!
  ).id;
}
