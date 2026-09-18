"""What the Page has already said, and whether it is about to repeat itself.

Duplicate detection is deliberately *deterministic*. The temptation is to ask
the model "is this too similar to what we posted last week?", and that is both
expensive and unreliable — it costs a call on every candidate and it will
happily say no to something it produced itself three days earlier.

Instead: normalise, hash, and check in SQL. The check is exact rather than
fuzzy, which means it catches the case that actually happens — the same animal
and the same fact, phrased slightly differently — because normalisation strips
the phrasing away before hashing.

This runs *before* image generation. Rejecting a duplicate topic after
spending a generation on it is the expensive ordering.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata

#: Words that carry no topical meaning. Removing them means "the snow leopard"
#: and "a snow leopard" hash identically, which is the whole point.
_STOPWORDS = frozenset("""
a an the this that these those is are was were be been being am
do does did doing done have has had having will would shall should
can could may might must of in on at to for from by with without
and or but nor so yet as if than then there here it its it's
you your yours we our ours they their theirs he she his her him
about into over under between during through above below
did you know fact facts amazing incredible interesting
""".split())

#: Phrases that are engagement scaffolding rather than subject matter. They
#: appear in a large share of wildlife captions and would otherwise make every
#: caption look similar to every other one.
_FILLER_PATTERNS = (
    r"\bdid you know\b",
    r"\bfun fact\b",
    r"\bnature'?s?\b",
    r"\bwildlife\b",
    r"\bincredible\b",
    r"\bamazing\b",
)


def normalize(text: str) -> str:
    """Reduce text to its topical core.

    Lowercase, strip accents, drop punctuation and digits, remove filler and
    stopwords, sort nothing (word order matters for meaning), collapse space.
    """
    if not text:
        return ""

    # Decompose accents so "jaguár" and "jaguar" agree.
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()

    for pattern in _FILLER_PATTERNS:
        text = re.sub(pattern, " ", text)

    # Keep letters and spaces only. Digits go because "weighs 300kg" and
    # "weighs 320kg" are the same claim for duplicate purposes.
    text = re.sub(r"[^a-z\s]+", " ", text)

    words = [w for w in text.split() if w and w not in _STOPWORDS and len(w) > 2]
    return " ".join(words)


def content_hash(text: str) -> str:
    """A stable key for the normalised meaning of a piece of text."""
    return hashlib.sha256(normalize(text).encode("utf-8")).hexdigest()


def topic_key(topic: str, animal: str | None = None) -> str:
    """Hash a topic together with its subject.

    "Hunting behaviour" about a leopard and about an owl are different posts;
    "leopard hunting" and "hunting behaviour of leopards" are the same one.
    Combining the two fields before normalising gets both cases right.
    """
    combined = f"{animal or ''} {topic or ''}".strip()
    return content_hash(combined)


def looks_repetitive(candidate: str, recent: list[str], *, threshold: float = 0.6) -> bool:
    """A cheap similarity guard for near-duplicates the hash would miss.

    Token overlap rather than an embedding: no model call, no dependency, and
    it catches the realistic failure — a caption rebuilt from the same handful
    of content words. It is a second line of defence behind the exact hash,
    not a replacement for it.
    """
    words = set(normalize(candidate).split())
    if not words:
        return False
    for previous in recent:
        other = set(normalize(previous).split())
        if not other:
            continue
        overlap = len(words & other) / min(len(words), len(other))
        if overlap >= threshold:
            return True
    return False


def extract_subject(text: str) -> str | None:
    """Best-effort guess at which animal a topic is about.

    Used only to fill the `animal` column for diversity tracking, never to make
    a factual claim. Returns None when it cannot tell, and None is fine — the
    topic hash still does the real work.
    """
    if not text:
        return None
    normalised = normalize(text)
    for word in normalised.split():
        if word in _KNOWN_SUBJECTS:
            return word
    return None


#: Not a taxonomy, and not used for any factual statement — just a lookup so
#: that diversity tracking has a subject to group by. Missing entries degrade
#: to None, which is harmless.
_KNOWN_SUBJECTS = frozenset("""
tiger lion leopard cheetah jaguar puma cougar lynx caracal serval ocelot
elephant rhino rhinoceros hippo hippopotamus giraffe zebra buffalo bison
wolf fox coyote jackal hyena bear panda koala sloth
eagle owl hawk falcon vulture crow raven parrot penguin flamingo pelican
heron stork kingfisher hummingbird peacock ostrich emu cassowary
whale dolphin orca shark ray octopus squid jellyfish turtle tortoise
crocodile alligator snake python cobra viper lizard gecko chameleon iguana
frog toad salamander axolotl
deer moose elk antelope gazelle impala wildebeest okapi tapir
monkey gorilla chimpanzee orangutan gibbon lemur baboon
otter beaver badger wolverine weasel stoat marten mongoose meerkat
bat pangolin armadillo anteater aardvark platypus echidna
camel llama alpaca yak ibex chamois
seal walrus manatee dugong narwhal
bee butterfly moth beetle spider scorpion mantis dragonfly ant termite
""".split())
