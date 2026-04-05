# Why Memex?

## The Original Memex

In his 1945 essay _As We May Think_, Vannevar Bush described the Memex — a hypothetical device that stores books, records, and communications, and lets a person retrieve any item rapidly through associative indexing. Unlike the rigid hierarchies of filing cabinets and card catalogs, the Memex lets a user forge _trails_ between pieces of information, building a personal web of linked knowledge that mirrors how human memory actually works: by association, not by category.

Bush's Memex was never built. The essay instead became the intellectual seed for hypertext, the World Wide Web, and the broader discipline of knowledge management.

## Why It Fits This Project

This project gives AI agents a persistent, associative memory system — exactly what Bush envisioned for humans. It provides:

- **Short-term memory** (`@memex/stm`) — a scratchpad for the current session, analogous to working memory
- **Long-term memory** (`@memex/ltm`) — a semantic store that survives sessions, indexed for retrieval by meaning
- **Hippocampus** (`@memex/hippocampus`) — a consolidation process that promotes important short-term observations into long-term storage, mirroring the biological hippocampus
- **Amygdala** (`@memex/amygdala`) — an emotional salience filter that decides which memories are worth keeping
- **Memory orchestration** (`@memex/memory`) — a unified interface composing all subsystems

The name is accurate, five characters long, historically resonant, and unclaimed in the TypeScript / npm ecosystem.

## Alternatives Considered

- **`mnemos`** — Greek root of Mnemosyne (goddess of memory); strong meaning but the `mn-` consonant cluster causes persistent spelling friction for non-Greek speakers
- **`cortex`** — taken by cortex.js, a JavaScript testing library, causing immediate namespace confusion
- **`neurite`** — accurate neuroscience term (a projection from a neuron), but obscure enough that discoverability suffers

Memex won on all three axes: brevity, recognizability, and availability.
