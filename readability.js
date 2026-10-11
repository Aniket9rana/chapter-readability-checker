/*
 * Blue Pencil readability engine.
 * Pure functions, no DOM. Runs in the browser (window.Readability) and in Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Readability = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- syllables ---------- */

  // Words the rules below get wrong. Values are syllable counts.
  const SYL_EXC = {
    area: 3, areas: 3, idea: 3, ideas: 3, people: 2, peoples: 2, leopard: 2, jeopardy: 3,
    every: 2, everything: 3, everyone: 3, everybody: 4, evening: 2, business: 2, different: 3,
    quiet: 2, quietly: 3, diet: 2, poet: 2, poem: 2, poems: 2, poetry: 3, cruel: 2, fuel: 2, duel: 2,
    jewel: 2, gruel: 2, ruin: 2, ruins: 2, fluid: 2, genuine: 3, suicide: 3, science: 2, client: 2,
    giant: 2, lion: 2, riot: 2, create: 2, created: 3, creating: 3, creature: 2, creatures: 2,
    react: 2, reaction: 3, reality: 4, realize: 3, realise: 3, really: 3, real: 1, idea_: 3,
    persuade: 2, persuaded: 3, being: 2, beings: 2, beyond: 2, area_: 3, coyote: 3, naive: 2,
    aunt: 1, are: 1, were: 1, here: 1, there: 1, where: 1, some: 1, come: 1, done: 1, one: 1,
    once: 1, give: 1, have: 1, live: 1, love: 1, move: 1, above: 2, the: 1, ate: 1, eye: 1, eyes: 1,
    whole: 1, whose: 1, women: 2, woman: 2, queue: 1, scarce: 1, ceiling: 2, doing: 2, going: 2,
    ahead: 2, theatre: 3, theater: 3, violence: 3, violent: 3, family: 3, camera: 3, chocolate: 3,
    comfortable: 4, vegetable: 4, memory: 3, favorite: 3, favourite: 3, several: 3, average: 3,
    interesting: 4, orange: 2, onion: 2, lyric: 2, hour: 1, hours: 1, fire: 1, tire: 1, wire: 1,
    byte: 1, kyle: 1, sure: 1, pure: 1, cure: 1, lure: 1, mature: 2, nature: 2, picture: 2,
    heaven: 2, seven: 2, even: 2, given: 2, driven: 2, broken: 2, golden: 2, children: 2,
    wednesday: 2, february: 4, library: 3, restaurant: 3, jewellery: 3, mischievous: 3
  };

  function countSyllables(word) {
    let w = String(word).toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    if (Object.prototype.hasOwnProperty.call(SYL_EXC, w)) return SYL_EXC[w];
    if (w.length <= 3) return 1;

    // Silent endings: jumped -> jump, makes -> mak, bottled -> bottle, dialogue -> dialog
    if (/(?:[aeiou]|n)gue$/.test(w) || /[aeiou]que$/.test(w)) w = w.slice(0, -2);
    else if (/[^aeiouy]led$/.test(w)) w = w.slice(0, -1);
    else if (/[^aeiouy]les$/.test(w)) w = w.slice(0, -1);
    else if (/[^aeiouy]ed$/.test(w) && !/[td]ed$/.test(w)) w = w.slice(0, -2);
    else if (/[^aeiouy]es$/.test(w) && !/(?:[sxz]|ch|sh|[cg])es$/.test(w)) w = w.slice(0, -2);
    else if (w.endsWith('e') && !/[^aeiouy]le$/.test(w)) w = w.slice(0, -1);
    // Silent e before a suffix: completely, careful, statement
    w = w.replace(/([^aeiouy])e(ly|ful|ness|less|ment)$/, '$1$2');

    let n = (w.match(/[aeiouy]+/g) || []).length;

    // Vowel pairs that are two syllables
    if (/[^aeioucgstxq]ia/.test(w)) n++;
    if (/[^cgstx]io(?![nu])/.test(w)) n++;
    if (/[^aeioucgstxq]iu/.test(w)) n++;
    if (/[^qg]ua(?!y)/.test(w)) n++;
    if (/[^qg]uous$/.test(w)) n++;
    if (/eo(?!n)/.test(w)) n++;
    if (/[aeiouy]ing$/.test(w)) n++;
    if (/(?:^|[^tcgxs])ious$/.test(w)) n++;
    if (/iety$/.test(w)) n++;
    if (/ism$/.test(w)) n++;
    if (/^creat(?!u)/.test(w)) n++;

    return Math.max(1, n);
  }

  // What a quick tool does: vowel clusters, drop a trailing e.
  function naiveSyllables(word) {
    let w = String(word).toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    const groups = (w.match(/[aeiouy]+/g) || []).length;
    return Math.max(1, groups - (w.length > 2 && w.endsWith('e') && groups > 1 ? 1 : 0));
  }

  /* ---------- sentences ---------- */

  const TITLES = new Set(['mr', 'mrs', 'ms', 'mx', 'dr', 'prof', 'sr', 'jr', 'st', 'mt', 'capt', 'gen',
    'col', 'lt', 'sgt', 'rev', 'hon', 'gov', 'sen', 'rep', 'messrs', 'mme', 'mlle', 'fr', 'sra']);
  const ALWAYS_CONT = new Set(['e.g', 'i.e', 'vs', 'cf', 'viz', 'approx', 'fig', 'vol']);
  const TERMS = '.!?…';
  const CLOSERS = '"”’\')]}*_»';
  const OPENERS = '"“‘\'([{«—*_';
  const UPPER = /[A-Z0-9À-ÖØ-Þ]/;

  // Returns [{start, end}] offsets into paragraph text p.
  function splitSentences(p) {
    const out = [];
    const n = p.length;
    let start = 0;
    while (start < n && /\s/.test(p[start])) start++;
    let i = start;
    while (i < n) {
      if (TERMS.indexOf(p[i]) === -1) { i++; continue; }
      let j = i;
      while (j < n && TERMS.indexOf(p[j]) !== -1) j++;
      const run = p.slice(i, j);
      let k = j;
      while (k < n && CLOSERS.indexOf(p[k]) !== -1) k++;
      // "3.5", "a.m" and similar: no whitespace after the stop, so not a boundary.
      if (k < n && !/\s/.test(p[k])) { i = j; continue; }

      let m = k;
      while (m < n && /\s/.test(p[m])) m++;
      let split = true;
      if (m < n) {
        let q = m;
        while (q < n && OPENERS.indexOf(p[q]) !== -1) q++;
        const lead = q < n ? p[q] : '';
        // A lowercase word after the stop is a dialogue tag or a continuation:
        // "Why?" she asked.  /  "I don't know..." she said.
        split = lead === '' || UPPER.test(lead);
        // "Well... I suppose so." keeps going; the pronoun I is capitalised mid-sentence.
        if (split && run !== '.' && !/[!?]/.test(run) && /^I(?:['’]|\s|$)/.test(p.slice(q))) split = false;
        if (split && run === '.') {
          const tm = p.slice(0, i).match(/([A-Za-z][A-Za-z.]*)$/);
          if (tm) {
            const tok = tm[1];
            const lower = tok.toLowerCase();
            if (tok.length === 1 && /[A-Z]/.test(tok)) split = false;          // J. K. Rowling
            else if (TITLES.has(lower) || ALWAYS_CONT.has(lower)) split = false; // Mr. Dr. e.g.
            else if (/^(?:[A-Za-z]\.)*[A-Za-z]$/.test(tok) && tok.indexOf('.') !== -1) {
              // initialisms: U.S. stays joined, a.m. / p.m. can end a sentence
              if (!/^[ap]\.m$/i.test(tok)) split = false;
            }
          }
        }
      }
      if (split) {
        out.push({ start: start, end: k });
        start = m;
        i = m;
      } else {
        i = k;
      }
    }
    if (start < n) {
      let end = n;
      while (end > start && /\s/.test(p[end - 1])) end--;
      if (end > start) out.push({ start: start, end: end });
    }
    return out;
  }

  /* ---------- per-sentence statistics ---------- */

  const L = '[A-Za-z\\u00C0-\\u024F]';
  const WORD_RE = new RegExp(
    L + '+(?:[\'\\u2019]' + L + '+)*(?:-' + L + '+(?:[\'\\u2019]' + L + '+)*)*|\\d+(?:[.,]\\d+)*', 'g');

  function fogSyllables(part) {
    const stem = part.toLowerCase().replace(/(?:es|ed|ing)$/, '');
    return countSyllables(stem || part);
  }

  function sentenceStats(text) {
    let words = 0, syll = 0, letters = 0, complex = 0, poly = 0;
    const re = new RegExp(WORD_RE.source, 'g');
    let m;
    while ((m = re.exec(text))) {
      const tok = m[0];
      const isNum = /^\d/.test(tok);
      let s;
      if (isNum) {
        s = Math.max(1, Math.ceil(tok.replace(/\D/g, '').length / 2));
      } else {
        s = 0;
        const parts = tok.split('-');
        for (let x = 0; x < parts.length; x++) s += countSyllables(parts[x]);
        const proper = words > 0 && /^[A-ZÀ-Þ]/.test(tok);
        if (!proper) {
          for (let x = 0; x < parts.length; x++) {
            if (fogSyllables(parts[x]) >= 3) { complex++; break; }
          }
        }
      }
      words++;
      syll += s;
      letters += tok.replace(/[^A-Za-zÀ-ɏ0-9]/g, '').length;
      if (s >= 3) poly++;
    }
    const commas = (text.match(/[,;:—]/g) || []).length;
    return { words: words, syll: syll, letters: letters, complex: complex, poly: poly, commas: commas };
  }

  function fkGrade(words, syll) {
    return words ? 0.39 * words + 11.8 * (syll / words) - 15.59 : 0;
  }

  /* ---------- formulas ---------- */

  function formulas(c) {
    const W = c.words, S = Math.max(1, c.sentences);
    if (!W) return null;
    const wps = W / S;
    const spw = c.syll / W;
    const L100 = (c.letters / W) * 100;
    const S100 = (S / W) * 100;
    return {
      ease: 206.835 - 1.015 * wps - 84.6 * spw,
      grade: 0.39 * wps + 11.8 * spw - 15.59,
      fog: 0.4 * (wps + 100 * (c.complex / W)),
      smog: 1.043 * Math.sqrt(c.poly * (30 / S)) + 3.1291,
      cli: 0.0588 * L100 - 0.296 * S100 - 15.8,
      ari: 4.71 * (c.letters / W) + 0.5 * wps - 21.43,
      wps: wps,
      spw: spw
    };
  }

  // The "basic tool" calculation: every .!? run ends a sentence, vowel-cluster syllables.
  function naive(text) {
    const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
    const W = words.length;
    const S = text.split(/[.!?]+/).filter(function (x) { return /[A-Za-z]/.test(x); }).length;
    let syll = 0;
    for (let i = 0; i < words.length; i++) syll += naiveSyllables(words[i]);
    if (!W || !S) return null;
    return {
      sentences: S,
      ease: 206.835 - 1.015 * (W / S) - 84.6 * (syll / W),
      grade: 0.39 * (W / S) + 11.8 * (syll / W) - 15.59
    };
  }

  /* ---------- whole chapter ---------- */

  function analyze(text, opts) {
    opts = opts || {};
    const merge = opts.mergeFragments !== false;
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');

    const paragraphs = [];
    const total = { words: 0, syll: 0, letters: 0, complex: 0, poly: 0, sentences: 0 };
    let fragments = 0, skipped = 0, rawSentences = 0;

    for (let li = 0; li < lines.length; li++) {
      const p = lines[li];
      if (!p.trim()) continue;
      const para = { index: paragraphs.length, text: p, skip: false, sentences: [], counts: null, grade: null };
      paragraphs.push(para);

      const trimmed = p.trim();
      const wordCount = (trimmed.match(WORD_RE) || []).length;
      const endsClean = /[.!?…"”’')\]]$/.test(trimmed);
      if (wordCount === 0 || (wordCount <= 8 && !endsClean)) {
        para.skip = true;
        skipped++;
        continue;
      }

      const spans = splitSentences(p);
      let inQuote = false, pos = 0;
      const scan = function (a, b) {
        for (let x = a; x < b; x++) {
          const ch = p[x];
          if (ch === '“') inQuote = true;
          else if (ch === '”') inQuote = false;
          else if (ch === '"') inQuote = !inQuote;
        }
      };
      const c = { words: 0, syll: 0, letters: 0, complex: 0, poly: 0, sentences: 0 };
      for (let si = 0; si < spans.length; si++) {
        const sp = spans[si];
        scan(pos, sp.start);
        const startsInQuote = inQuote;
        scan(sp.start, sp.end);
        pos = sp.end;
        const st = sentenceStats(p.slice(sp.start, sp.end));
        if (st.words === 0) continue;
        const dialogue = startsInQuote || /^[“"]/.test(p.slice(sp.start, sp.end));
        const fragment = st.words <= 4 && dialogue;
        const s = {
          start: sp.start, end: sp.end, text: p.slice(sp.start, sp.end),
          words: st.words, syll: st.syll, poly: st.poly, commas: st.commas,
          dialogue: dialogue, fragment: fragment, grade: fkGrade(st.words, st.syll)
        };
        para.sentences.push(s);
        c.words += st.words; c.syll += st.syll; c.letters += st.letters;
        c.complex += st.complex; c.poly += st.poly;
        rawSentences++;
        if (fragment && merge) fragments++;
        else c.sentences++;
      }
      // c.sentences can be 0 for a paragraph of only quoted fragments. Their words still
      // count, and the sentence they belong to is the one around them in the next paragraph.
      para.counts = c;
      const f = formulas(c);
      para.grade = f ? f.grade : null;
      for (const k in total) total[k] += c[k];
    }

    const scores = formulas(total);

    // Hardest sentences: per-sentence Flesch-Kincaid grade, ignoring fragments and very short lines.
    const pool = [];
    paragraphs.forEach(function (para) {
      para.sentences.forEach(function (s, si) {
        if (s.words >= 6 && !s.fragment) pool.push({ pi: para.index, si: si, grade: s.grade });
      });
    });
    pool.sort(function (a, b) { return b.grade - a.grade; });
    const hardest = pool.slice(0, 5);

    return {
      paragraphs: paragraphs,
      totals: total,
      scores: scores,
      naive: naive(String(text)),
      hardest: hardest,
      fragments: fragments,
      skipped: skipped,
      rawSentences: rawSentences
    };
  }

  return {
    analyze: analyze,
    countSyllables: countSyllables,
    splitSentences: splitSentences,
    sentenceStats: sentenceStats,
    naive: naive
  };
});
