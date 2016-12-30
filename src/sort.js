export const SORT_A_B_EQUAL = 0;
export const SORT_A_FIRST = -1;
export const SORT_B_FIRST = 1;

export function comparatorAscending(a, b) {
  if (a === b) {
    return SORT_A_B_EQUAL;
  }
  return a < b ? SORT_A_FIRST : SORT_B_FIRST;
}

export function comparatorDescending(a, b) {
  if (a === b) {
    return SORT_A_B_EQUAL;
  }
  return a > b ? SORT_A_FIRST : SORT_B_FIRST;
}
