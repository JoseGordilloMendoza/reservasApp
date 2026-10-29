/** The server answers nothing below this many letters, so the page does not ask. */
export const MIN_LETTERS = 2;

/** Whether what is typed is enough to look for. Spaces do not count. */
export const isSearchable = (typed: string) => typed.trim().length >= MIN_LETTERS;
