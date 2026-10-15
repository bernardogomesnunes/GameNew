# Status and testing

Two lists, kept up to date as things land:

1. **Everything asked for** since batch 4 began, and whether it's done.
2. **What to test.** Features that exist but you haven't told me you've tried.
   Some I've never seen working in a real game either. Those are marked
   *(not seen in a browser)*: they're covered by tests only.

## 1. Everything asked for

### Done

| What | PR |
|---|---|
| Notification centre (menu → Notices) | #167 |
| Long "your buildings kept working" toast cut off | #167 |
| Farms make half as much | #167 |
| Storage pop-up: bigger list, bag folds below | #167 |
| Quarry makes more stone; kiln slower | #167 |
| People talk when tapped | #167 |
| 12 ages; goals that make sense; an age needs all its goals | #168 |
| Tree tribes | #169 |
| "Craft what's missing" button | #170, fixed #184 |
| Lanterns lighting a whole street | #171, fixed again #183 |
| Living and abandoned cities | #172 |
| Diamonds, rubies, diamond gear | #173 |
| Stone Kingdom outposts | #174 |
| Train passengers and fares | #175 |
| Collection book in the market | #176 |
| The god's cube, his stash and the wand | #177 |
| Loading screen on create, open and leave; save spinner | #178 |
| Rails curve round corners | #179 |
| Train on a phone: tap adds coal, hold takes it apart | #180 |
| Sky lift in Creative; the "What is this?" pop-up | #180 |
| A blockier train | #181 |
| Look for a 3D-modelling skill: none exists, modelled by hand | — |
| Flying machine → the Plainer, worn on the chest | #182 |
| The Helix: a helicopter that flies like Creative | #182 |
| Old lanterns stopped lighting | #183 |
| Craft button missing on mobile | #184 |
| Pop-ups with search keep one size | #184 |
| Ages 11 and 12 goals: Conquest, and The God | #185 |
| Markets: a rare shelf that changes every two days | #186 |
| Time travel, part one: the machine, the Past, dinosaurs, eggs | #187 |
| Time travel, part two: the dinosaur army (the whistle), the Basilisk | #188 |
| Time travel, part three: the Future (the city, trams and flying cars, the university's Archive, ten new blocks) | #189 |
| Battle mode, step 1: a new world type with three computer rivals; their armies come once you've a barracks; take a city's standard to weaken them | #192 |

### Not done yet

| What | Where it's from | When |
|---|---|---|
| Two or three more new peoples to raid | Batch 4, D1 | Later |
| Places you've taken marked on the map; new ones appearing over time | Batch 4, D1 | Later |
| Battle mode, step 2: AI rivals via an API key, through our server | Batch 4, E | Later |
| Battle mode, step 3: real multiplayer (needs a game server) | Batch 4, E | Later |
| Composting | Batch 3, #9 | Last |

Batches 2 and 3 are otherwise done; see their docs.

## 2. What to test

Ordered roughly by how far into the game it is. *(not seen in a browser)*
means only the automated tests have checked it.

### Early and middle game

- [ ] **Notification centre.** Menu → Notices. Do the old toasts show, and does Clear work?
- [ ] **People talk.** Tap a settler, the messenger, the explorer or a trader. Tap again for the next line.
- [ ] **Quests.** In the Goals panel, hand one in from anywhere. The hermit's six fruit is the first.
- [ ] **Secrets and daily challenges** in the Goals panel.
- [ ] **Rare goods at the market:** two hard-to-get items per trader, new every two game days.
- [ ] **Collection book.** Goals → Book. Coins at 10%, 25%, 50% and 75%; the Collector's Crown at 100%.
- [ ] **Stone mill** and **wood mill**: stand by one at the bench, and the cheaper recipes appear.
- [ ] **Backpacks** (Back slot): leather +10 slots, reinforced +20.
- [ ] **Bow:** hold to draw, let go to shoot. Hemp → fibre → string.
- [ ] **Horse and cart:** tame a horse with fruit or vegetables, ride it, put a cart on it.
- [ ] **Drinks:** beer, kombucha and coffee boosts, with the countdown chip.
- [ ] **University studies** and their skills.
- [ ] **Storage controller:** every storehouse in one list.
- [ ] **Barracks:** train each kind of soldier, including the catapult crew. Hungry soldiers hit softer.
- [ ] **Evolving buildings** with the Evolve button, and "Craft what's missing" on a card *(#184 is new)*.

### Vehicles

- [ ] **Trains:** rail and curves, engine, cars, coal; drive it; open a car's 1,000 slots.
- [ ] **Passengers:** stop near a living city with cars on. Do people get off and pay, and get on?
- [ ] **Sky lift of your own:** two lifts joined by a straight run of chain.
- [ ] **Plainer:** wear it, Fly, then turn Fly off in the air. Its wings should glide you down *(the glide is not seen in a browser)*.
- [ ] **Helix:** set it down, climb in, fly it, land, get out with Sneak.

### Late game: your god and the war (Ages 7 to 10)

- [ ] **Temple:** choose your god; devotion; temple upgrades.
- [ ] **Rings:** Sunstone or Nightstone ore deep in caves; forge the White or Black Ring.
- [ ] **Sanctuary and guardian:** Aurelion heals you, Umbra scares enemies. Tap it to cycle follow, stay, attack. Downed, it returns a day later.
- [ ] **The Ten Rounds (white path):** the wall comes down, ten raids, the Warlord. Defence buildings help.
- [ ] **Swear the oath (dark path):** Black Ring on, Place on the Nightstone in the Stone Kingdom's dark temple. You get 1,000 warriors.
- [ ] **The march:** camp, or send the army ahead as an expedition.
- [ ] **Cut the chains:** break a link of an anchor tower's chain. Cut all four and the island sinks; two days later the King comes down.
- [ ] **Disguise:** full Sky armour; the suspicion eye and bar; your first blow unseen hits three times as hard.
- [ ] **Storm the palace:** the Sky King's glowing heavy blow (step back and it misses); royal guards replaced every 18 seconds.
- [ ] **Losing an attack:** taxes of 25%, 35%, 45%, then 50%; the Stone King replaces lost warriors.
- [ ] **The endings,** each with its own picture.

### After the war: the endless world

- [ ] **Cities:** two living, two abandoned, past the old border. Merchants; guards if you steal.
- [ ] **City lanterns** at night *(dark until #183; now lit, not seen in a browser)*.
- [ ] **Tree tribes:** villages in the giant trees. They shoot from the decks if you rob them.
- [ ] **Stone Kingdom outposts:** a dark-brick fort with four guards and an armoury.
- [ ] **Gems:** diamond ore deep (below y 32), ruby in the high peaks. Diamond tools and armour; a ruby strikes 25 coins at the foundry.
- [ ] **The god's cube:** from your Sanctuary's pop-up.
  - Taking the stash and leaving is seen in a browser.
  - **Killing the god** is not seen.
- [ ] **The wand:** Break to pick a block, Place to copy it for a coin, Break at open air for a beam.

### Time travel (new)

- [ ] **The time machine:** make one (Age 11), set it down, Place on it, To the Past.
- [ ] **The Past:** jungle and fern plains. Look for eggs lying in the ferns.
- [ ] **Raptors** hunt you; **triceratops** charge if you hit them; **long-necks** graze.
- [ ] **Tame:** raw meat for a raptor, fruit or vegetables for the others. Then tap to ride.
- [ ] **Eggs:** bring one home, set it down; two game days later it hatches, tame.
- [ ] **Home:** Place on the machine by your landing spot.
- [ ] **The whistle:** make one (hide, string), blow it near your dinosaurs. They follow and fight; blow again to make them stay.
- [ ] **The Basilisk:** rare in the Past's jungle. It hunts, and hits hard.
- [ ] **The Future:** Place on the machine, To the Future. Towers, trams, flying cars; look at it at night.
- [ ] **The Archive:** walk east from the plaza into the university and tap the glowing block. Then, at home, make Neon or Steel Panel at an engineering centre.
- [ ] **Futurians** in the plaza: tap one to talk.
- [ ] **Frame rate in the city** on your phone *(not measured: the test browser runs at 2–3 fps whatever it draws)*.

### Battle mode (new)

- [ ] **Create a Battle world.** The welcome names the three rivals and their directions; open the map to see them.
- [ ] **Build a barracks.** A toast says the rivals have noticed. Their first army comes about half a game day later, with a warning.
- [ ] **Beat an army** at home: gold, and a toast.
- [ ] **March on a city** (about 5,000 blocks, so take a horse or the Helix). Beat its garrison, then tap the gold standard in the plaza.
- [ ] **Come back** to a city you took: nobody guards it for 3 days.
- [ ] **Balance:** how strong rivals feel, how often they come *(guesses: a rival gains 0.6 strength a game day, and attacks every 2 days)*.

### Fixes worth a quick look

- [ ] **Old lanterns** in a world from your account light again after reopening it *(#183; the account path isn't seen in a browser, I test signed out)*.
- [ ] **Search pop-ups** keep their size with the keyboard up *(#184; a real iPhone keyboard not seen)*.
- [ ] **The loading screen** when you create a world, open one, and leave.
