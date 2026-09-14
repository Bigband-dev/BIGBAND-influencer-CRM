export function formatMan(
  value: number | null | undefined
) {
  if (value === null || value === undefined) {
    return "-";
  }

  // 1억 이상
  if (value >= 100000000) {
    const eok = Math.floor(value / 100000000);
    const remainder = value % 100000000;

    const man = Math.floor(
      remainder / 10000
    );

    if (man === 0) {
      return `${eok.toLocaleString()}억`;
    }

    return `${eok.toLocaleString()}억 ${man.toLocaleString()}만`;
  }

  // 1만 이상
  if (value >= 10000) {
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

  return value.toLocaleString();
}

export function formatPriceMan(
  value: number | null | undefined
) {
  if (value === null || value === undefined) {
    return "-";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "-";
  }

  // 만원 단위 정수
  const safeAmount = Math.round(amount);

  // 1억 미만
  if (safeAmount < 10000) {
    return `${safeAmount.toLocaleString()}만원`;
  }

  // 억 단위
  const eok = Math.floor(safeAmount / 10000);

  // 나머지 만원
  const man = safeAmount - eok * 10000;

  if (man === 0) {
    return `${eok.toLocaleString()}억원`;
  }

  return `${eok.toLocaleString()}억 ${man.toLocaleString()}만원`;
}