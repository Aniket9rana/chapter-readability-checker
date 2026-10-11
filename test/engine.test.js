// Run with: node test/engine.test.js
const R = require('../readability.js');

let failed = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed++; console.log('FAIL ' + label + '\n   got:  ' + JSON.stringify(got) + '\n   want: ' + JSON.stringify(want)); }
}

// Syllables: word -> hand-counted syllables (dictionary pronunciation).
const SYL = {
  cat: 1, table: 2, bottle: 2, jumped: 1, wanted: 2, makes: 1, boxes: 2, houses: 2, changes: 2, tables: 2,
  bottled: 2, agreed: 2, free: 1, agree: 2, hated: 2, completely: 3, careful: 2, statement: 2, movement: 2,
  management: 3, agreement: 3, useful: 2, radio: 3, piano: 3, media: 3, special: 2, social: 2, initial: 3,
  actual: 3, usual: 3, equal: 2, language: 2, quality: 3, serious: 3, curious: 3, delicious: 3, religious: 3,
  anxious: 2, conscious: 2, glorious: 3, society: 4, anxiety: 4, variety: 4, capitalism: 5, going: 2, doing: 2,
  seeing: 2, trying: 2, playing: 2, being: 2, running: 2, understanding: 4, video: 3, theory: 3, violin: 3,
  violent: 3, studio: 3, nation: 2, million: 2, religion: 3, question: 2, beautiful: 3, wonderful: 3,
  remember: 3, difficult: 3, important: 3, reading: 2, readability: 5, sentence: 2, chapter: 2, paragraph: 3,
  novel: 2, author: 2, manuscript: 3, character: 3, narrative: 3, dialogue: 3, imagination: 5, February: 4,
  league: 1, tongue: 1, unique: 2, argue: 2, catalogue: 3, fatigue: 2,
  continuous: 4, virtuous: 3, luxurious: 4, create: 2, creation: 3, creature: 2, area: 3, idea: 3, people: 2,
  the: 1, strength: 1, through: 1, thought: 1, laughed: 1, walked: 1, wanted_: 2, little: 2, middle: 2,
  simple: 2, example: 3, evening: 2, family: 3, again: 2, always: 2, silence: 2, whispered: 2, shadows: 2,
  darkness: 2, breathing: 2, sudden: 2, suddenly: 3, solicitors: 4, impersonal: 4, deliberately: 5,
  inheritance: 4, correspondence: 4, generations: 4, unresolved: 3, unreasonable: 5, eventually: 5,
  harbour: 2, quota: 2, ferry: 2, courtesy: 3, particular: 4, satchel: 2, obligation: 4, conviction: 3
};
Object.keys(SYL).forEach(function (w) {
  check('syllables(' + w + ')', R.countSyllables(w), SYL[w]);
});

// Sentence splitting: input -> expected sentence texts.
function split(p) { return R.splitSentences(p).map(function (s) { return p.slice(s.start, s.end); }); }
check('Mr. Dr.', split('Mr. Smith met Dr. Jones at 6 a.m. today. They talked.'),
  ['Mr. Smith met Dr. Jones at 6 a.m. today.', 'They talked.']);
check('p.m. can end a sentence', split('He left at 9 p.m. Then she cried.'), ['He left at 9 p.m.', 'Then she cried.']);
check('initials', split('J. K. Rowling wrote it. Fine.'), ['J. K. Rowling wrote it.', 'Fine.']);
check('ellipsis lowercase', split('Well... I suppose so. Yes.'), ['Well... I suppose so.', 'Yes.']);
check('ellipsis capital', split('He paused... Then he left.'), ['He paused...', 'Then he left.']);
check('dialogue tag', split('"Why?" she asked. "Because."'), ['"Why?" she asked.', '"Because."']);
check('quote then new sentence', split('"No." She shook her head.'), ['"No."', 'She shook her head.']);
check('decimal', split('It cost 3.5 million. Wow.'), ['It cost 3.5 million.', 'Wow.']);
check('e.g.', split('Use a tool, e.g. a hammer. Then wait.'), ['Use a tool, e.g. a hammer.', 'Then wait.']);
check('curly quotes', split('“Stop!” he said. “Now.”'), ['“Stop!” he said.', '“Now.”']);
check('U.S.', split('The U.S. Army came. It stayed.'), ['The U.S. Army came.', 'It stayed.']);

// Fragment merging: a run of one-word dialogue should not make the chapter look childish.
const dialogue = [
  'The old harbour master had spent forty years watching vessels disappear into the fog without ever once asking where they were going.',
  '"No."', '"Why?"', '"Stop."', '"Please."',
  'She considered the question with the particular seriousness of someone who has already decided the answer.'
].join('\n');
const merged = R.analyze(dialogue, { mergeFragments: true });
const unmerged = R.analyze(dialogue, { mergeFragments: false });
check('fragments merged count', merged.fragments, 4);
if (!(merged.scores.grade > unmerged.scores.grade + 1)) {
  failed++; console.log('FAIL merging fragments should raise grade by >1; got ' + merged.scores.grade + ' vs ' + unmerged.scores.grade);
}

// Headings and scene breaks are skipped.
const doc = R.analyze('Chapter Seven\n\n* * *\n\nThe ferry left early. Nobody waved goodbye to it.');
check('skipped headings', doc.skipped, 2);
check('sentences after skip', doc.rawSentences, 2);

if (failed) { console.log('\n' + failed + ' failing'); process.exit(1); }
console.log('all passed');
