(function () {
  'use strict';

  var R = window.Readability;
  var $ = function (id) { return document.getElementById(id); };

  // grade = U.S. school grade range, ease = Flesch Reading Ease range
  var TARGETS = {
    middle:   { label: 'middle grade',     grade: [4, 6],  ease: [80, 90] },
    ya:       { label: 'young adult',      grade: [6, 8],  ease: [70, 80] },
    adult:    { label: 'general adult',    grade: [7, 9],  ease: [60, 70] },
    literary: { label: 'literary fiction', grade: [9, 12], ease: [40, 60] }
  };
  var MAX_GRADE = 16;

  var SAMPLE = [
    'Chapter Seven',
    '',
    'The ferry to Hollis Point left at 6 a.m., and by the time Mrs. Aldous reached the pier the fog had already swallowed the far shore. She stood with her suitcase between her feet and counted the gulls. There were eleven. There had always been eleven, or so her father used to say, as though the harbour kept a quota.',
    '"You\'re early," said the ticket clerk.',
    '"No."',
    '"The boat doesn\'t board until half past."',
    '"I know." She set down the case. "I\'ll wait."',
    'Dr. Venn arrived a few minutes later, carrying a leather satchel that he held against his chest the way other men hold a sleeping child. He nodded to her but said nothing, and she was grateful, because the letter in her coat pocket demanded all of her attention, and because the particular silence of two people who have each decided not to speak is a kind of courtesy.',
    'What she could not have explained to anyone, least of all to the man now pretending to study the tide tables, was that the inheritance, which the solicitors had described in language so deliberately impersonal that it seemed designed to discourage grief, represented not merely a house and its unreasonable debts but the unresolved correspondence of three generations, every one of whom had believed that the others would eventually forgive them.',
    '"Is it true?" he asked at last.',
    '"Is what true?"',
    '"That you mean to sell."',
    'She looked at him. Then she looked at the water. The fog was lifting, slowly, in sheets.',
    '"Ask me on the other side."',
    'The ferry horn sounded twice. Somewhere below the deck an engine caught, coughed, and settled into a steady grumble that she felt in her teeth. People shuffled forward with their umbrellas and their paper cups. A boy ran past, then back, then past again.',
    'Dr. Venn finally spoke. "My father crossed on this boat every Sunday for forty years, and I never once saw him enjoy it."',
    '"Why did he go?"',
    '"Obligation, mostly. Habit. The conviction that somebody ought to."',
    'She turned that over. It was exactly the sort of answer she distrusted, because it was true, and because truth delivered so plainly always seemed to ask for something in return.'
  ].join('\n');

  var input = $('input'), marked = $('marked');
  var audience = $('audience'), merge = $('merge');
  var view = 'marked';
  var isSample = false;
  var current = null;
  var timer = null;

  /* ---------- helpers ---------- */

  function fmt(n, d) { return (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function easeBand(e) {
    if (e >= 90) return 'very easy';
    if (e >= 80) return 'easy';
    if (e >= 70) return 'fairly easy';
    if (e >= 60) return 'plain';
    if (e >= 50) return 'fairly hard';
    if (e >= 30) return 'hard';
    return 'very hard';
  }
  function excerpt(t, n) {
    t = t.replace(/\s+/g, ' ').trim();
    if (t.length <= n) return t;
    var cut = t.slice(0, n);
    return cut.slice(0, cut.lastIndexOf(' ')) + '…';
  }

  /* ---------- view switching ---------- */

  function setView(v) {
    view = v;
    input.hidden = v !== 'paste';
    marked.hidden = v !== 'marked';
    $('tab-paste').setAttribute('aria-pressed', String(v === 'paste'));
    $('tab-marked').setAttribute('aria-pressed', String(v === 'marked'));
  }

  /* ---------- rendering ---------- */

  function renderMarked(a, rankOf) {
    marked.textContent = '';
    a.paragraphs.forEach(function (p) {
      var node = el('p');
      node.id = 'p-' + p.index;
      if (p.skip) node.className = 'skip';
      var cursor = 0;
      p.sentences.forEach(function (s, si) {
        var rank = rankOf[p.index + ':' + si];
        if (!rank) return;
        node.appendChild(document.createTextNode(p.text.slice(cursor, s.start)));
        var span = el('span', 'hard');
        span.id = 's-' + p.index + '-' + si;
        span.appendChild(el('b', 'rank', String(rank)));
        span.appendChild(document.createTextNode(s.text));
        node.appendChild(span);
        cursor = s.end;
      });
      node.appendChild(document.createTextNode(p.text.slice(cursor)));
      marked.appendChild(node);
    });
  }

  function renderHardest(a) {
    var list = $('hardest');
    list.textContent = '';
    if (!a.hardest.length) {
      list.appendChild(el('li', 'empty', 'Paste a few paragraphs to see the sentences that read hardest.'));
      return {};
    }
    var rankOf = {};
    a.hardest.forEach(function (h, i) {
      var s = a.paragraphs[h.pi].sentences[h.si];
      rankOf[h.pi + ':' + h.si] = i + 1;
      var li = el('li');
      li.appendChild(el('b', 'rank', String(i + 1)));
      li.appendChild(el('p', 'excerpt', excerpt(s.text, 170)));
      var meta = el('div', 'meta');
      meta.appendChild(el('span', null, 'Grade ' + fmt(Math.max(0, s.grade), 0)));
      meta.appendChild(el('span', null, plural(s.words, 'word', 'words')));
      if (s.poly) meta.appendChild(el('span', null, plural(s.poly, 'long word', 'long words')));
      if (s.commas) meta.appendChild(el('span', null, plural(s.commas, 'pause', 'pauses')));
      var btn = el('button', 'link', 'Show in text');
      btn.type = 'button';
      btn.addEventListener('click', function () { jump('s-' + h.pi + '-' + h.si); });
      meta.appendChild(btn);
      li.appendChild(meta);
      list.appendChild(li);
    });
    return rankOf;
  }

  function renderStrip(a, target) {
    var strip = $('strip');
    strip.textContent = '';
    var band = $('strip-band');
    band.style.bottom = (target.grade[0] / MAX_GRADE * 100) + '%';
    band.style.height = ((target.grade[1] - target.grade[0]) / MAX_GRADE * 100) + '%';
    a.paragraphs.forEach(function (p) {
      if (p.skip || p.grade == null) return;
      var b = el('button', 'bar' + (p.counts.words < 8 ? ' thin' : ''));
      b.type = 'button';
      b.style.height = Math.max(3, clamp(p.grade, 0, MAX_GRADE) / MAX_GRADE * 100) + '%';
      var label = 'Paragraph ' + (p.index + 1) + ', grade ' + fmt(Math.max(0, p.grade), 1) + ', ' + plural(p.counts.words, 'word', 'words');
      b.title = label;
      b.setAttribute('aria-label', label);
      b.addEventListener('click', function () { jump('p-' + p.index); });
      strip.appendChild(b);
    });
  }

  function renderMeasures(a) {
    var body = $('measures');
    body.textContent = '';
    var s = a.scores;
    var t = a.totals;
    var rows = [
      ['Gunning Fog', fmt(Math.max(0, s.fog), 1), 'Years of schooling; leans on long words'],
      ['SMOG', fmt(Math.max(0, s.smog), 1), t.sentences < 30 ? 'Built for 30+ sentences; rough here' : 'Long-word density'],
      ['Coleman-Liau', fmt(Math.max(0, s.cli), 1), 'Letters per word, no syllables'],
      ['Automated Readability', fmt(Math.max(0, s.ari), 1), 'Letters per word and sentence length'],
      ['Words per sentence', fmt(s.wps, 1), 'After merging short quoted lines'],
      ['Syllables per word', fmt(s.spw, 2), ''],
      ['Long words (3+ syllables)', fmt(t.poly / t.words * 100, 1) + '%', '']
    ];
    rows.forEach(function (r) {
      var tr = el('tr');
      var th = el('th');
      th.appendChild(document.createTextNode(r[0]));
      if (r[2]) th.appendChild(el('span', 'sub', r[2]));
      tr.appendChild(th);
      tr.appendChild(el('td', null, r[1]));
      body.appendChild(tr);
    });
    var bits = [];
    if (a.skipped) bits.push(plural(a.skipped, 'heading or scene break', 'headings and scene breaks') + ' left out');
    $('measures-note').textContent = bits.join('. ');
  }

  function renderScore(a, target) {
    var s = a.scores;
    var grade = Math.max(0, s.grade);
    $('ease').textContent = fmt(s.ease, 0);
    $('ease-band').textContent = easeBand(s.ease);
    $('grade').textContent = fmt(grade, 1);
    $('grade-band').textContent = grade < 1 ? 'below first grade' : 'U.S. school grade';

    var tick = clamp(s.ease, 0, 100);
    $('ruler-tick').style.left = tick + '%';
    var tgt = $('ruler-target');
    tgt.style.left = target.ease[0] + '%';
    tgt.style.width = (target.ease[1] - target.ease[0]) + '%';

    var v = $('verdict');
    var lo = target.grade[0], hi = target.grade[1];
    var rounded = Math.round(grade * 10) / 10;
    if (rounded > hi) {
      v.className = 'verdict off';
      v.textContent = 'Reads ' + fmt(rounded - hi, 1) + ' grades above ' + target.label + ' (grade ' + lo + ' to ' + hi + ').';
    } else if (rounded < lo) {
      v.className = 'verdict off';
      v.textContent = 'Reads ' + fmt(lo - rounded, 1) + ' grades below ' + target.label + ' (grade ' + lo + ' to ' + hi + ').';
    } else {
      v.className = 'verdict ok';
      v.textContent = 'On target for ' + target.label + ' (grade ' + lo + ' to ' + hi + ').';
    }

    var vs = $('vs-basic');
    if (a.naive) {
      var diff = a.naive.grade - s.grade;
      var tail = Math.abs(diff) >= 0.5
        ? ' That is ' + fmt(Math.abs(diff), 1) + ' grades ' + (diff < 0 ? 'easier' : 'harder') + ' than the reading above.'
        : ' Close to the reading above.';
      vs.textContent = 'A basic calculator (every full stop ends a sentence, syllables guessed from vowel clusters) gives grade '
        + fmt(Math.max(0, a.naive.grade), 1) + ' and ease ' + fmt(a.naive.ease, 0) + '.' + tail;
    } else {
      vs.textContent = '';
    }
  }

  function renderEmpty() {
    $('ease').textContent = '–';
    $('grade').textContent = '–';
    $('ease-band').textContent = '';
    $('grade-band').textContent = '';
    $('ruler-tick').style.left = '0%';
    $('verdict').className = 'verdict';
    $('verdict').textContent = 'Paste at least a page of your chapter to see its score.';
    $('vs-basic').textContent = '';
    $('hardest').textContent = '';
    $('hardest').appendChild(el('li', 'empty', 'The five hardest sentences will appear here.'));
    $('strip').textContent = '';
    $('measures').textContent = '';
    $('measures-note').textContent = '';
    $('counts').textContent = 'Nothing to check yet.';
    marked.textContent = '';
    current = null;
  }

  function update() {
    var text = input.value;
    var target = TARGETS[audience.value];
    var a = R.analyze(text, { mergeFragments: merge.checked });
    if (!a.scores || a.totals.words < 30) {
      renderEmpty();
      if (text.trim() && a.totals.words) {
        $('counts').textContent = plural(a.totals.words, 'word', 'words') + ' so far. Needs about 30 to score.';
      }
      return;
    }
    current = { a: a, target: target };
    var rankOf = renderHardest(a);
    renderMarked(a, rankOf);
    renderScore(a, target);
    renderStrip(a, target);
    renderMeasures(a);
    var counts = a.totals.words.toLocaleString() + ' words · ' + plural(a.rawSentences, 'sentence', 'sentences');
    if (merge.checked && a.fragments) counts += ' · ' + plural(a.fragments, 'short quoted line', 'short quoted lines') + ' merged';
    $('counts').textContent = counts;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(update, 200);
  }

  function jump(id) {
    setView('marked');
    var node = document.getElementById(id);
    if (!node) return;
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
    node.classList.remove('pulse');
    void node.offsetWidth;
    node.classList.add('pulse');
  }

  /* ---------- actions ---------- */

  function setText(t, sample) {
    input.value = t;
    isSample = !!sample;
    $('sample-note').hidden = !isSample;
    update();
    setView(current ? 'marked' : 'paste');
  }

  input.addEventListener('input', function () {
    isSample = false;
    $('sample-note').hidden = true;
    schedule();
  });
  input.addEventListener('paste', function () {
    setTimeout(function () { update(); if (current) setView('marked'); }, 0);
  });
  audience.addEventListener('change', update);
  merge.addEventListener('change', update);
  $('tab-paste').addEventListener('click', function () { setView('paste'); input.focus(); });
  $('tab-marked').addEventListener('click', function () { update(); setView(current ? 'marked' : 'paste'); });
  $('sample').addEventListener('click', function () { setText(SAMPLE, true); });
  $('clear').addEventListener('click', function () { setText('', false); setView('paste'); input.focus(); });
  $('file').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () { setText(String(reader.result), false); };
    reader.readAsText(f);
    e.target.value = '';
  });

  $('copy').addEventListener('click', function () {
    if (!current) return;
    var a = current.a, t = current.target, s = a.scores;
    var lines = [
      'Blue Pencil readability summary',
      'Reading ease ' + fmt(s.ease, 0) + ' (' + easeBand(s.ease) + '), grade ' + fmt(Math.max(0, s.grade), 1)
        + '. Target: ' + t.label + ', grade ' + t.grade[0] + ' to ' + t.grade[1] + '.',
      a.totals.words.toLocaleString() + ' words, ' + a.rawSentences + ' sentences.',
      '',
      'Five hardest sentences:'
    ];
    a.hardest.forEach(function (h, i) {
      var sn = a.paragraphs[h.pi].sentences[h.si];
      lines.push((i + 1) + '. ' + excerpt(sn.text, 200) + ' (grade ' + fmt(Math.max(0, sn.grade), 0) + ', ' + sn.words + ' words)');
    });
    var text = lines.join('\n');
    var btn = $('copy');
    var done = function (msg) {
      btn.textContent = msg;
      setTimeout(function () { btn.textContent = 'Copy summary'; }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done('Copied'); }, function () { done('Copy not allowed here'); });
    } else {
      done('Copy not allowed here');
    }
  });

  /* ---------- start with a worked example ---------- */
  setText(SAMPLE, true);
})();
