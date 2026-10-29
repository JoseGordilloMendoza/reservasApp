import unicodedata


def normalize_for_search(text):
    """Lowercase, without accents, one space between words: "  Consultorio  LUCÍA " -> "consultorio lucia".

    Stored on the business and applied to what is typed, so a search finds "Lucía" when someone
    writes "lucia". Done here rather than with a database extension: some hosts do not offer
    `unaccent`, and this needs nothing from the database.
    """
    decomposed = unicodedata.normalize("NFKD", text)
    plain = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(plain.lower().split())
