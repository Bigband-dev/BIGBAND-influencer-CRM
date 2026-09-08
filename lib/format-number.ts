export function formatMan(
  value: number | null | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "-";
  }

  const man = value / 10000;

  if (man >= 100) {
    return `${Math.round(man).toLocaleString()}만`;
  }

  if (man >= 10) {
    return `${Number(
      man.toFixed(1)
    ).toLocaleString()}만`;
  }

  return `${Number(
    man.toFixed(2)
  ).toLocaleString()}만`;
}

export function formatPriceMan(
  value: number | null | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "-";
  }

  return `${Number(value).toLocaleString()}만원`;
}