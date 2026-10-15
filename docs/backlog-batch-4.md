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

- **Train and sky lift under a thumb** (PR #180).
  - A tap at a train or a flying machine is Place, whatever you hold: coal
    into the bunker, a car coupled on, the cab. Holding takes one piece
    off. Lift and press again for the next.
  - Your own sky lifts work: a lift rides its chain, straight up or down,
    to the lift at the other end. Tapping a lift's hint rides it too,
    instead of opening the claim panel.
- **A blockier train** (PR #181): square wheels with hubs, a boiler
  stepped round instead of smooth, a box chimney and dome, a lamp, and
  plank walls on the coaches.
- **The Plainer and the Helix** (PR #182).
  - The flying machine is now the Plainer, worn in the Body place like a
    breastplate. Hold it and Place puts it on. Wearing it lets you fly,
    and its wings glide you down when you stop.
  - The Helix is a new helicopter, built at an engineering centre in
    Age 8. Set it down, Place on it to climb in, and it flies as Creative
    does. Land and Sneak to get out.
  - A Plainer an older save left parked is still there. Hit it to pick it
    up, then wear it.

- **Saved lanterns light again** (PR #183). Reported directly: "Old
  lanterns in my world stopped throwing light".
  - A world opened from the account never told the game where its saved
    lanterns were, so only ones placed since lit.
  - The places the land comes with (cities, camps, tribes, outposts) never
    lit either: their lanterns were written straight into the land.
  - Both are scanned now. Lava and glowing ore aren't, so there's no flood
    of lights underground.

- **Craft what's missing, everywhere; search pop-ups that hold still**
  (PR #184).
  - The button is on a ready-made building's card in Buildings too. It
    was only on a level's Evolve, so a house (no levels) never had one.
  - It used to stop at one batch (16 of 25 planks) and say it was done.
    It now makes all of it, and never uses up what the bill takes as it is.
  - Every pop-up with a search keeps one height, pinned as it opens, so a
    phone's keyboard can't shrink it.

## B. Goals and ages: 12 ages

**Done in PR #168,** with A6 (the goals). As built:
- Age 1 is Exile: wood, water, a pickaxe.
- Ages 2–9: Roots, Settle, Forge, Hearth, Town, Faith, Bastion, Walls.
- Age 10 is Reckoning: the war, the wall down.
- Age 11 is Renown: find a ruin, a forgotten temple, an abandoned mine and
  a monument.
- Age 12 is Legend: a market town, 100 coins, 25 buildings, full armour.
- Ages 11 and 12 will change as C and D land. **Done in PR #185:**
  - Age 11 is Conquest: a city's treasure, another people raided,
    diamond armour, half the collection book.
  - Age 12 is The God: into the cube, beat him or take his stash, three
    quarters of the book, forty buildings.
  - The draft's time-travel goals come with time travel.
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

**Rare goods done in PR #186:**
- Each market trader has a rare shelf of hard-to-get goods: things nobody
  can make (clay, snow, obsidian, diamonds, rubies, a jar of fireflies,
  garden vegetables) and things slow or dear to make. Two are out at a
  time, and they change every two game days.
- Each comes from an age, so a young market doesn't sell diamond tools.
- Nothing that decides the story is sold: no Sky or Dark gear, and no ring
  ore.

- Every item in the game can be had somehow: crafted, dug, dropped, found, or
  bought from a trader. A test checks it, so nothing is ever out of reach.
- Traders stock the hard-to-get items at a price, and their stock rotates.
- **Collection book:** every item you've ever held is ticked off, by category.
  - There are rewards at milestones, and a big one for all of them, given the
    moment you get the last item.
- Open question: what is the full-collection reward? A title, a golden
  statue, the wand?

### D3. Side story: time travel

**The Past, part one, done in PR #187:**
- A **time machine** (engineering centre, Age 11: iron, gold, glass, two
  diamonds, two rubies). Set it down and Place on it.
- **The Past** is prehistoric land a long way east (world/past.js):
  - two biomes of its own, Prehistoric Jungle and Fern Plains, and nothing
    else grows there;
  - you land in a clearing beside a machine of its own, the way home;
  - it's nobody's land, so you can dig and build there.
- **Dinosaurs:**
  - the raptor hunts you and bites (3 a bite, armour helps) and goes
    round what's in its way;
  - the triceratops charges once struck;
  - the long-neck grazes, head up on its neck.
  - Tame them by feeding (raw meat for a raptor, fruit or vegetables for
    the others) and ride them. On a phone a tap does it.
- **Eggs** lie in the ferns. Take one home, set it down, and two days later
  a tame one hatches.
- Age 12 now asks for the Past and a hatched dinosaur, as this draft had it.
**Part two, done in PR #188:**
- **The dinosaur army:**
  - A Dinosaur Whistle (by hand, Age 11: hide and string). Blow it (tap)
    and your tamed dinosaurs in earshot follow you; blow again and they
    stay.
  - Following, they keep close and go for whatever comes at you: bandits,
    the Kingdom's soldiers, a wild raptor. A raptor bites for 4, a
    triceratops gores for 6, a long-neck's tail hits for 8.
  - They round what's in their way. One that can't get to you catches you
    up, the way a pet does, and they come through the time machine with
    you.
- **A creature out of legend:** the Basilisk, rare in the deep jungle. It's
  a crowned serpent-lizard that hunts (6 a bite, 120 hp), nobody tames it,
  and it drops Basilisk Scales.

**Part three, done in PR #189: the Future.**
- The time machine's pop-up now offers **To the Past** or **To the Future**.
- **The city:** far west of home (as far as the Past is east). One city, on
  flat ground, all of it:
  - a grid of streets with lane markings; the east–west ones carry two
    maglev rails each;
  - pavements with lamp posts;
  - on almost every block a glass tower, 24 to 80 high: steel frame, blue
    glass, some windows lit, a door in each side, floors inside, a neon
    ring on the roof and a mast. Some step in near the top; some carry a
    big screen. A few blocks are small parks.
- **At night it glows:** neon, screens, lit windows and lamps are drawn with
  their own light, so they stay bright in the dark.
- **Trams** glide along the rails and **flying cars** pass overhead in lanes
  above the streets. They're scenery: you can't ride them or be hit.
- **People:** a dozen futurians about the plaza. They're neutral, and they
  talk (tap).
- **The university** is just east of the plaza; walk straight in through its
  door. Place on (or tap) the **Archive** inside, and you learn the Future's
  blocks.
- **Its blocks:** Pavement, Asphalt, Tinted Glass, Steel Panel, Neon Pink,
  Neon Cyan, Screen, Maglev Rail, Lit Window and Future Lamp. Each is made at
  an engineering centre (Age 11), but only once you've read the Archive.
- The Future isn't your land: the border stops you breaking or building
  there, so its blocks can't simply be carried home. Learning them is the
  way.
- Your following dinosaurs come along. A time machine in the plaza takes you
  home.

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

**Step 1, done in PR #191: computer rivals.** Decided with you: three
rivals; nobody wins (you conquer their cities to weaken them, and they
rebuild); their attacks start once you have a barracks; no sides for now.
- **A new world type, Battle,** on the "Create world" screen. It's Duilt's
  rules with three rival cities about 5,000 blocks out, a third of the way
  round the compass from each other. They're on your map from the start,
  each in its colour.
- **Each rival grows stronger by the day.** Strength decides how many guard
  its city and how big its armies are: soldiers, then archers, a battering
  ram from 4, a catapult from 8.
- **Your first barracks starts the attacks.** One city at a time, with a
  minute's warning, from their direction, in their colours (the Stone
  Kingdom's war system). They only come while you're home.
  - Beat an army: +gold, and they're a little weaker.
  - Lose: they're a little stronger.
- **Conquer a city:** walk there, beat its garrison (they fight on sight),
  then Place on or tap the **War Standard** in the plaza.
  - Tribute in gold, and their strength is halved.
  - The city is yours for 3 days while they rebuild: no garrison, and no
    armies from them.
  - Then they grow back and come again.
- The cloud world list still says "Duilt" for a Battle world. Only this
  device's list says "Battle"; I didn't touch the cloud-save code.

## Suggested order

1. A: the quick improvements.
2. B: 12 ages and the goal rework. Everything after hangs off the ages.
3. D1 + D2: the civilisations and the market collection, the core of
   "endless".
4. C: the god's cube and the wand, the end of the main story.
5. D3: time travel. Past first, as asked.
6. E: Battle mode, starting with computer players.
7. Composting (#9 from batch 3), still last.
