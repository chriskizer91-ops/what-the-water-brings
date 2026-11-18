# Handoff: What the Water Brings, version 5 (the upgrade pass)

Nov 18 2026. Read this with claude/handoff-v4-finishing-build.md (everything the game had before today), claude/what-the-water-brings-design.md (how the game works) and claude/business-card.md.

## Links and files
- **Live page (the address on the business card):** https://chriskizer91-ops.github.io/what-the-water-brings/
- **Version 4, kept as it was:** https://chriskizer91-ops.github.io/what-the-water-brings/v4/
- **Repo:** chriskizer91-ops/what-the-water-brings (public). The web page is served from the `gh-pages` branch; `main` holds the same files. Push to both.
- **The Claude artifact:** https://claude.ai/artifact/HQ6XzF52f1FvYWBm7s9NpH, republished with version 5 (private until shared from its Share menu). Its version history still holds v4.
- **Offline file:** what-the-water-brings-v5.html, sent to Chris in the chat.
- **Source:** in the repo. `src/` holds the game in parts (they were cut from the published v4 page, because the old source repo was not to hand). `python3 build.py` glues them into `out/index.html`; copy that over `index.html` to publish.

## The business card
- The Nov 5 card's QR code and printed address already point at the live page, so the card PDF is ready to print as it is.
- Never rename `index.html` or the repo: the QR code would stop working.

## What is new
### Field notes: "Seen along the creek" (a new journal page)
- Eighteen creatures. Each is written down the first time he comes near enough to see it and it is in the picture. A small note appears ("In his field notes: great blue heron. 1 of 18.").
- The journal page shows each one's name and a line once seen, and where to look until then.
- The list, names, hints and lines are in `F.FIELD` in src/31_finds.js, written for the game, for the family to rewrite.
- Saved as `save.seen`. Old saves load and simply start at 0 of 18.
- Who is on it:
  - By day: heron, turtles, minnows, frog, dragonfly, monarch, teal, turkey vulture (afternoon), cardinal, swallows, roadrunner, bass.
  - Evening: deer, bats, armadillo, fireflies.
  - Night: owl, luna moth (needs the lantern).

### Five new creatures (src/32_life.js)
- **Bats.** In the evening they stream out of the cave under the bluff and away down the creek. At night a few hunt over the water near him. They stay away during the cave ending.
- **Armadillo.** By the main trail, between the fallen log and the footbridge, in the evening and at night. It roots about; when he comes within 2.5 m it jumps straight up, then leaves.
- **Roadrunner.** On the county road south of the crossing, by day. It stands, looks about and dashes; within 3 m of him it is off up the road.
- **Bass.** In the Blue Hole it clears the water every 9 to 21 seconds while he is near, with a ring going out and a ring coming in.
- **Luna moth.** At night, once he carries the lantern, a pale green moth comes to it after about 12 seconds and circles him.
- Each has a line the first time (in `LINES` in src/40_main.js).

### Skipping stones
- Flat stones are stacked by four pools: the Heron Pool, the Blue Hole, the stock pond and the spring pool (`F.SKIP_AT`).
- Standing at a stack, the action button says "Skip a stone". He winds up and flings it sidearm (a new move, `skip`, in src/15_king3.js). The stone skips with a ring and a tick each time, then sinks, or fetches up on the far bank.
- Mostly three to five skips; now and then seven or more. The count is said afterwards ("Five skips. Respectable."), from `F.skipLine`.
- His best and his number of throws are kept (`save.skip`) and shown at the foot of the field notes page.
- Not offered in the storm, in Watch the story, in photo mode or in the ending.

### Small things
- Fireflies now start at dusk (they used to wait until about 8 pm game time, so the evening never had them).
- Fish rise on still water at dawn and in the evening: small rings near him.
- The first night without the lantern, a note says "Dark already. Tom keeps a lantern in his studio."
- The controls list mentions skipping a stone.

## What did not change
- Every find, tag, caption, poem, poem stop, the commonplace lines, the credits, the storm, the ending and Watch the story. In src/31_finds.js the only old line touched is a list of colours.
- The HUD has no new counters.

## Voice and music
- Still waiting, as in handoff v4. Nothing in the 171-line recording script changed.
- New lines that could be recorded later if wanted: the 5 new creature lines, the 18 field-note lines, the skip lines, and the lantern note. They are on-screen notes, so they are only spoken once recorded.
- tools/voice_script.js was not in the published page, so it is not in the rebuilt source. The old source zip (v4) still has it.

## Checked
In a software-rendered headless browser:
- tools/flow.py plays the whole game by script: 48 of 48 finds, 5 of 5 solids, 11 of 11 poems, 9 of 9 boxes, a stone skipped, the ending through to the last page in 71 seconds (the same as v4). No errors.
- tools/watchtest.py: Watch the story reaches the cave, with no errors.
- Each new creature seen at its hour and place; skipping tried at all four pools; 17 throws in a row.
- Screenshots at laptop, phone and TV size, in normal and Easy to see.
- Speed (tools/perf.py): triangles 1,176,065 before and 1,178,042 after (0.17% more). Game logic 0.86 ms a frame before, 0.81 after. Drawing time is the same within the noise of the test.
- The live address was fetched after publishing and returned the game's page.
- Not yet tried on a real phone, TV or controller.

## Still open
- Everything in handoff v4's list (songs, voice, Rick's poems, Tom's finds, how openly to name Teal, Chris's name in the credits, real devices).
- The family may want to rewrite the 18 field-note lines.
