# Blue Pencil

A free chapter readability checker for fiction writers. Paste a chapter, get a reading score and the five hardest sentences marked in the text. Runs entirely in the browser; nothing is uploaded.

- Flesch Reading Ease and Flesch-Kincaid grade as headline scores, plus Gunning Fog, SMOG, Coleman-Liau and ARI.
- Sentence splitting that understands Mr., Dr., a.m., initials and ellipses.
- Short quoted lines ("No.", "Why?") are counted with the sentence around them, and the page shows what a basic calculator would have said instead.
- Paragraph-by-paragraph chart so pacing swings are visible.

No build step. Open `index.html`. Engine tests: `node test/engine.test.js`.
