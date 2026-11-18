;
/* PKCard: the character card shared by the 3D page and the pixel king demo.
   Front: the drawing of him, his name, title, stats and a short description.
   Back (turn the card over): a page kept for a poem by Richard Sale for the game. While POEM.lines is empty it shows ruled blank lines;
   to put the poem in, fill POEM below (one string per line, '' for a stanza break) and rebuild. */
(function () {
  'use strict';
  // the back of his card: a poem attributed to Plato, to Aster (whose name means star), in Rennell Rodd's rendering (1916).
  // A poem by Richard Sale can go here instead (only with his permission): title, by, tr ('' for none), lines.
  var POEM = {
    title: 'Starworship',
    by: 'Plato',
    tr: 'Rennell Rodd',
    lines: ["Thou gazest starward, star of mine, whose heaven I fain would be,", "That all my myriad starry eyes might only gaze on thee."]           // one string per line of the poem; '' leaves a blank line between stanzas
  };
  var STATS = [['Wisdom', 10], ['Curiosity', 10], ['Patience', 8], ['Kindness', 9], ['Speed', 2]];
  var $ = function (id) { return document.getElementById(id); };

  function build() {
    var A = window.PKCardAssets;
    $('cardArt').src = A.art; $('cardSprite').src = A.sprite;
    var ul = $('cardStats');
    STATS.forEach(function (s) {
      var li = document.createElement('li'), pips = '';
      for (var i = 0; i < 10; i++) pips += '<i' + (i < s[1] ? ' class="on"' : '') + '></i>';
      li.innerHTML = '<span>' + s[0] + '</span><b aria-label="' + s[1] + ' out of 10">' + pips + '</b><em>' + s[1] + '</em>';
      ul.appendChild(li);
    });
    // the poem page: his poem when there is one, otherwise ruled blank lines kept for it
    var page = $('poemPage'), filled = POEM.lines.length > 0;
    $('poemTitle').textContent = POEM.title || 'A poem for the creek';
    $('poemBy').textContent = 'by ' + POEM.by + (POEM.tr ? ' \u00b7 translated by ' + POEM.tr : '');
    page.classList.toggle('blank', !filled);
    if (filled) {
      POEM.lines.forEach(function (t) { var p = document.createElement('p'); p.className = t ? 'ln' : 'ln gap'; p.textContent = t || ' '; page.appendChild(p); });
    } else {
      for (var k = 0; k < 11; k++) { var r = document.createElement('p'); r.className = 'ln rule'; r.setAttribute('aria-hidden', 'true'); r.textContent = ' '; page.appendChild(r); }
      var note = document.createElement('p'); note.className = 'kept'; note.textContent = 'This page is kept for a poem by ' + POEM.by + '.'; page.appendChild(note);
    }
    // turning the card over
    var wrap = $('cardWrap'), card = wrap.querySelector('.card'), front = $('cardFront'), back = $('cardBack'), busy = false;
    function turn(toBack) {
      if (busy) return; busy = true;
      card.classList.add('turning');
      setTimeout(function () {
        front.hidden = toBack; back.hidden = !toBack; card.scrollTop = 0;
        card.classList.remove('turning');
        (toBack ? $('cardTurnBack') : $('cardTurn')).focus();
        busy = false;
      }, 170);
    }
    $('cardTurn').addEventListener('click', function () { turn(true); });
    $('cardTurnBack').addEventListener('click', function () { turn(false); });
    function open() { front.hidden = false; back.hidden = true; wrap.hidden = false; requestAnimationFrame(function () { wrap.classList.add('on'); }); $('cardClose').focus(); }
    function close() { wrap.classList.remove('on'); setTimeout(function () { wrap.hidden = true; }, 260); $('cardBtn').focus(); }
    $('cardBtn').addEventListener('click', open);
    $('cardClose').addEventListener('click', close);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !wrap.hidden) close(); });
    return { open: open, close: close, turn: turn, poem: POEM };
  }
  window.PKCard = { build: build, POEM: POEM };
})();

;
/* PKValley: the creek valley of "What the Water Brings", drawn for the pixel renderer (PKPixel3D).
   A North Texas creek valley about 220 x 150 m:
     King's Creek      the main creek, always flowing west to east; low, normal, high and flood levels
     Dry Fork          a white limestone bed coming down from the bluff over the Dry Falls; dry most days, a torrent in a storm
     Teal Branch       spring-fed, clear and cold, out of a grotto under the south hill; runs even in a drought
     the stock pond    still water behind an earth dam, with a windmill and a stock tank
     the bluff         a limestone escarpment along the north side, with a shallow cave and a lookout reached by a switchback
     the county road   a gravel road with a low-water crossing (it floods); the old railroad on an embankment with a trestle
     Tom's studio      a board shed with his truck at the trailhead, at the west end
   The ground is one height function; the area round him is built in 32 m tiles at the chosen detail (streamed as he walks),
   and the whole valley is always there as a light far version, so a low view still sees the land to the horizon.

     const W = PKValley.create({ detail: 4 });   scene.add(W.group);
     W.ensure(x, z)        build the tiles round a spot now (start, teleport)
     W.stream(x, z, ms)    build / drop tiles as he walks (call each frame with a time budget)
     W.height(x, z, feet)  ground (or deck / stone / log) under a point;  W.water(x, z) water surface or null;  W.wading(x, z, feet)
     W.fast(x, z)          true where the water is running too hard to wade (a flood, or the Dry Fork in a storm)
     W.collide(p, r)       pushes a {x, z} point out of trunks, rocks, posts, rails and walls