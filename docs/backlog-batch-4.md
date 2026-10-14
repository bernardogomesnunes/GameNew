# Backlog batch 4 — an endless game

Asked for directly: "This game should feel like infinite. After beating
whatever army we should have lots of more stories."

The order below puts the quick fixes first, then the goal and age rework
everything else hangs on, then the new stories. Each part ships as its own PR
or PRs and is recorded here when it lands.

## A. Quick improvements (first)

**Done in PR #167:** 1 notification centre, 2 the away toast, 3 farms
halved, 4 the storage panel, 5 the quarry's four stones and a slower kiln,
7 people talk. Number 6 (goals) goes with the 12 ages in B.

What's there now was checked in the code before writing this.

1. **Notification centre.** Every toast is also kept, per world, in a list. It
   opens from the menu as a pop-up, newest first, and you can clear it.
2. **"Your buildings kept working" is cut off.** `.toast` has
   `max-height: 200px`, so a long list is clipped. The toast should show the
   first few lines and "+N more", with the full list in the notification
   centre.
3. **Farms make half as much.**
   - Now: each crop planted (up to 4) gives 1 produce and 1 seed every 2 hours
     (`Crops.farmProduce`), so a full farm makes up to 48 produce and 48 seeds
     a day.
   - Change: half of that. Seeds come every other cycle, and produce comes
     every 4 hours.
4. **The storage panel.** With a storehouse open, its list fills most of the
   screen and your bag folds up below it. Tap to unfold the bag.
5. **Stone vs brick.**
   - Now: a kiln makes 12 brick and 12 glass a day. A first quarry makes about
     7 stone and 3 cobblestone a day.
   - Change: the quarry also gives white stone and dark stone, and makes more
     stone than a kiln makes brick. The kiln slows down.
6. **Goals that make no sense:**
   - Remove "Put it back" (Age 1).
   - Remove the repeated house and residents goals (Ages 3 and up).
   - An age only completes when **all** of its goals are done.
   - Now: only the age's own building goals (2 to 5 of them) move the border.
     The other cards in the same band don't count, so an age can complete
     with cards still open. Cards from later ages can also be ticked early.
   - Change: every card in an age's band counts. A later age's cards stay
     locked, and can't be ticked, until you reach that age.
   - The two Sanctuary cards become one: "Build your Sanctuary". Which one you
     build is your choice.
7. **People talk.** Tapping a person opens a speech bubble with a line or two
   of conversation, chosen by who they are:
   - the messenger brings news;
   - the explorer tells stories of places;
   - the trader talks prices;
   - settlers talk about their day.
   - Tap again for the next line.

## A2. Asked for since

- **Craft what's missing.** A button by Evolve on a building's pop-up (and a
  storehouse's). It crafts what the next level is short of from what's in
  your bag:
  - by hand, or at any station you've built;
  - a step or two down the chain, so it makes the planks for a lantern too;
  - nothing is half-made, and nothing is made by eating something else on
    the list;
  - what can't be made is left, and said.

- **Loading screens** (PR #178). Asked for directly: "a loading on the
  create world like a loading as we have in the beginning and on save the
  loading spinner".
  - The startup loading screen comes back up when you create a world, open
    one, or go back to your worlds. Its bar follows the land round you being
    drawn.
  - Save and leave now shows its spinner. Before, a save to this browser
    held the page before the spinner was ever drawn.

- **Rail bends** (PR #179). Asked for directly: "Rails need to curve in
  this scenario like rounded iron bars". Where rail turns a corner, joining
  one x side and one z side, it's drawn as a quarter circle. The iron bars
  are arcs that run on into the straight rail with no step, and the
  sleepers fan round the bend. Junctions and straight runs are unchanged.

## B. Goals and ages: 12 ages

**Done in PR #168,** with A6 (the goals). As built:
- Age 1 is Exile: wood, water, a pickaxe.
- Ages 2–9: Roots, Settle, Forge, Hearth, Town, Faith, Bastion, Walls.
- Age 10 is Reckoning: the war, the wall down.
- Age 11 is Renown: find a ruin, a forgotten temple, an abandoned mine and
  a monument.
- Age 12 is Legend: a market town, 100 coins, 25 buildings, full armour.
- Ages 11 and 12 will change as C and D land.
- Old saves move up to the age with at least as much land.
- A save keeps at most the central 320 square whole.

The draft it was built from:

Asked for directly: "we need more ages to divide all this, and increase the
terrain available for building ... age 12". Also: 3 goals per age up to
Age 5, then 4 per age. Age 1 teaches how to play. From Age 2 on, the goals
are the ones already tuned, spread out over more ages.

Draft, to be agreed before it's built. Land is the side of the claimed square,
in blocks.

| Age | Land | Goals |
|---|---|---|
| 1 Exile | 32 | Break a tree for wood · Gather water · Make a pickaxe |
| 2 Roots | 64 | Plant and claim a forest · Break ground on a farm · Build a house |
| 3 Settle | 96 | Open a quarry · Raise a storehouse · A second house: somebody moves in |
| 4 Forge | 128 | Build a workshop · Fire up a kiln · Keep animals in a pen |
| 5 Hearth | 192 | Raise a market · Raise a tavern · Raise a foundry |
| 6 Town | 256 | A townhouse · Four houses · A university · An engineering centre |
| 7 Bastion | 320 | Drive a mine · Fill a granary · Raise a garrison · Raise a temple and choose your god |
| 8 Walls | 400 | Build your Sanctuary · A wall · A gatehouse · A watchtower |
| 9 Reckoning | 512 | The wall comes down and the war starts · Win the ten rounds · A village · A monument |
| 10 Conquest | 640 | Take a city's treasure · Take a second civilisation · Craft gem armour · Fill the market's collection to 50% |
| 11 Time | 800 | Build a time machine · Bring back a dinosaur egg · Bring knowledge from the future · Hatch and tame a dinosaur |
| 12 The god | 1024 | Open the way at your Sanctuary · Beat the other god, or steal his stash · (2 more to agree) |

- **Existing saves:** a world keeps the age it's in, mapped onto the new list
  so it never goes backwards and nothing already built has to be done again.
  For example, an old Age 4 becomes the new Age 5 or 6, whichever the
  buildings already standing satisfy.
- After Age 12 the game doesn't stop. See D: the civilisations, the market
  collection and the time trips go on.

## C. Main story: the gods' resolution

**Done in PR #177:**
- On a Sanctuary's pop-up, "Step through to his cube" once the war is won
  (white ring) or the sky has fallen (dark ring).
- A 100×100 hall, 40 tall, of Godstone nothing breaks, far out and high up.
  Pillars, lights, an altar with his stash, and a glowing Way Out in the
  south wall.
- The god: 600 hp, hits hard, no knockback. Every 14 s he calls up to 3
  shades or seraphs (8 at most alive), twice as often below half.
- The Way Out lets you go only once he's dead or his stash is taken.
- The stash: 2,500–3,000 coins, 4–8 diamonds and the God's Wand.
- The wand: Break on a block picks it, Place puts down a copy (1 coin
  each). Break at anyone or at open air fires a beam, 12 damage. On a
  phone, once a block is picked a tap on a block places.

Asked for directly: "No matter which one you'd choose, you need to fight the
other one."

- After the big wars, Place on your Sanctuary's heart to step through to the
  **god's cube**:
  - a closed, unbreakable 100×100×100 room;
  - the other god inside, with creatures that fight for him;
  - on the white path you face the dark god, and on the dark path the white
    one.
- **Two ways out:**
  1. **Kill the god.** He's a boss fight in phases, and his creatures come in
     waves.
  2. **Steal his stash.** Thousands of coins and the **wand**. Grab it and
     reach the exit alive.
- **The wand:**
  - point at a block to pick it, then beam it to place copies of that block
    wherever you point;
  - the beam also does damage.
  - Open question: does copying cost anything, such as coins, a charge or a
    cooldown? If not, it gives unlimited blocks.

## D. After the first end game: an endless world

### D1. Civilisations to raid

**Tree tribes done in PR #169:**
- Villages in giant trees: decks, bridges, huts under the leaves, and a
  stair up to a watchtower on the crown.
- The people never come down. They're neutral until struck or robbed, then
  they shoot from the trees.

**Cities done in PR #172:**
- Two living cities a world, past the old border. Each is walled with
  gates, guards, calçada streets, a plaza with a statue, and two merchants
  with goods a market at home doesn't keep. A dozen houses, each lit.
- The people are neutral. Strike one or take from a house's chest, and the
  guards come for you while the rest run.
- Two abandoned cities: the same plan, crumbled and mossy, empty, with more
  and better chests.

**Gems done in PR #173:**
- Diamond ore deep down, ruby ore in the high peaks.
- Diamond tools, sword and armour, the best there is, from the war's age.
- A ruby strikes 25 coins at the foundry.

**Stone Kingdom outposts done in PR #174:**
- Two a world, far out: a dark-brick fort with four of the Kingdom's guards.
- An armoury of two chests: diamonds, rubies, dark armour, coins.
- The guards treat you as the Kingdom does, and come for you if you rob
  the armoury.

**Train passengers done in PR #175:**
- Stations are your settlement and every living city (each has a name now).
- Stop a train with cars near one and whoever was bound there gets off and
  pays a coin for every 120 blocks they rode. New passengers get on for
  another station, ten seats a car.
- They sit in the windows (the glass is see-through now), and pointing at a
  car says who's aboard and where they're going.

Asked for directly: "villages and different civilisations to attack after the
first end game, collect their valuables ... diamonds and different new
armour".

- New generated places past the old border. Each has its own look, its own
  guards and its own treasure:
  - **tree tribes** in the tallest trees;
  - **abandoned cities** and **living cities**;
  - **Stone Kingdom outposts**;
  - two or three new peoples.
- **New treasure:**
  - diamonds and other gems as ore deep down, and in vaults;
  - gem armour and weapons a tier above what exists now.
- Each one you take is marked on the map. A few new ones appear over time, so
  there's always another.

### D2. The market: every item, and a reward for all of them

**Done in PR #176:**
- A Book tab in the Goals panel.
- Every item you've held in this world is ticked off, by group (246
  items). A test checks every one can be had.
- Rewards at 10/25/50/75%: 50/150/400/800 coins. At 100%: 2,000 coins
  and the Collector's Crown, worn on the head (5 points, never wears out).

- Every item in the game can be had somehow: crafted, dug, dropped, found, or
  bought from a trader. A test checks it, so nothing is ever out of reach.
- Traders stock the hard-to-get items at a price, and their stock rotates.
- **Collection book:** every item you've ever held is ticked off, by category.
  - There are rewards at milestones, and a big one for all of them, given the
    moment you get the last item.
- Open question: what is the full-collection reward? A title, a golden
  statue, the wand?

### D3. Side story: time travel

Unlocked after the first end game.

- **The time machine:** a craftable block you place, sit in, and pick Past or
  Future.
- **Past (the hardest):**
  - a separate world of dinosaurs and mythological creatures;
  - dinosaurs hit hard, so it needs the new gear first;
  - **taming:** feed a dinosaur to tame it, then ride it or have it fight
    beside you;
  - **eggs:** take them home, hatch them, and build an army of dinosaurs.
- **Future:**
  - you arrive in a huge city with flying cars and automated trams;
  - it has its own blocks: glass towers, neon, metal and screens;
  - find their **university** to bring the knowledge home. That unlocks the
    future blocks and tech in the present.
  - Until then, the future blocks exist only there.
- Each era is its own world, saved apart from your home world and reached only
  through the machine.

## E. A third mode: Battle

Asked for directly: "some kind of age of empires".

- A new world type. You start alone with rival players spread about 5,000
  blocks apart. It plays on Duilt or Survival rules, with the dark and white
  kingdoms as the factions for now.
- **Rivals, in steps:**
  1. **Simple computer players** (scripted): they gather, build, raise an
     army and attack. No accounts or keys needed.
  2. **AI players** using an API key, optional. The key should go through
     our server and never sit in the page.
  3. **Real multiplayer:** invite friends. Needs a game server, which is the
     biggest piece in this batch. Plan it on its own once 1 is fun.

## Suggested order

1. A: the quick improvements.
2. B: 12 ages and the goal rework. Everything after hangs off the ages.
3. D1 + D2: the civilisations and the market collection, the core of
   "endless".
4. C: the god's cube and the wand, the end of the main story.
5. D3: time travel. Past first, as asked.
6. E: Battle mode, starting with computer players.
7. Composting (#9 from batch 3), still last.
