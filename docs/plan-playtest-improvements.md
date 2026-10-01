# Playtest improvements

These come from the user's own game session (the "Duild new list of improvements" note). They're separate from the Phase 7 lore (`docs/plan-phase7-lore.md`) and mostly independent of it, so they can go in between lore steps. Each one ships the usual way: tests, a check at phone size in the browser, a PR, then merge.

What's already there to build on:
- **Framed windows, furniture, chests:** the windows are from 7a; tables, chairs and rugs are from Phase 4; chests are from 6a.
- **Loot chests:** they exist since 7c, with loot rolled from where they stand.
- **Armour slots:** head, body and legs, plus the ring, from 7b.
- **Respawn:** you wake in the middle of your land (`Game.respawnPoint`).
- **Camera:** first person only. There's no third-person view and no player model.

---

## P1. Homes worth living in
*"Houses should have windows and furniture. We should have a bed too. Windows and bed should be an item of course. We should have a painting in each house and as an item, that can set the spawn point for when we die."*

- **Bed:** a new block, two cells long, placed the way you face, with a wooden frame, mattress and pillow. Made at the bench from planks and wool.
  - Lying in it at night could skip to morning. That's an idea, not something the user asked for.
- **Painting:** a new block hung flat on a wall, with a few framed scenes that cycle as you place it. Made at the bench.
  - **Place on a painting sets your spawn point:** "You'll wake here when you fall."
  - Dying sends you to that painting instead of the middle of your land.
  - If the painting is broken, you're back to the default spawn.
- **House designs:** the starter cabin and townhouse get framed windows, a bed, a table and chair, a rug, a lantern and a painting.
- **House rules:** a house might need a bed to count, and a painting could add comfort. *To decide with the user.*

## P2. Forests that read as forests
*"When looking at a forest, I think the leaves lack shadows and light because they look like a mesh of green. Maybe some different tones of green and more contrast between surfaces."*

- **Colour per block:** each leaf block varies in tone (lighter, darker, warmer, cooler) from a hash of its position, so a canopy is no longer one flat green.
- **Light and shade:** stronger difference between lit and shaded faces on leaves.
  - Undersides and faces that point down are noticeably darker.
  - Leaves deep inside a canopy are darker than those on its rim (ambient occlusion from how many leaves surround them).
- **Each tree a little different:** a slight hue shift per tree.
- **Check:** before-and-after screenshots of the same forest at noon and at dusk.

## P3. Better mobs, and you
*"All mobs need remodelling for more detailed visuals. And user needs an avatar that can be seen in 3rd person, which can be changed in settings, especially for mobile; in desktop there should be a key."*

- **Mob models:** more detailed models for every animal (legs that walk, heads, tails, ears) and for people (settlers, bandits, wanderers), with arms and legs that swing as they walk.
- **Your avatar:**
  - a player model you see in third person;
  - choose its look in Settings (skin, hair, clothes);
  - the armour you're wearing shows on it.
- **Switching view:**
  - a camera button on mobile cycles first person → behind → in front, and Settings remembers the choice;
  - on desktop, a key does the same (F5, rebindable).
- **Camera behaviour:** the third-person camera pulls in when a wall would block it.

## P4. Places to find: ruins, temples, mines, monuments
*"We need structures. Random temples and ruins. Abandoned mines. And monuments. And all with a chest with goodies: armour, weapons, food, and a super rare ring-crafting item."*

- **New landmarks**, scattered from the seed like the hermit's hut and the camps:
  - **Ruins:** broken walls and pillars, half buried, with moss.
  - **Forgotten temples:** marble and dark stone, an altar, collapsed pillars.
  - **Abandoned mines:** a shaft with timber props and rails going down into a cave, with ore left in the walls.
  - **Monuments:** an obelisk or a statue on a hill.
- **A chest at every one**, using the 7c loot system with a table per kind:
  - armour pieces, weapons (swords), food;
  - the new drinks (P5);
  - **a super rare ring ore** (Sunstone or Nightstone).
- **Finding them:** they show on the map once discovered, and a messenger's news can point the way to one, as it does for camps.

## P5. Drinks that make you better for a while
*"Stats improvement items, found here too and craftable: beer, kombucha and coffee. Beer gives you energy and lets you throw more hits per second; kombucha gives you 2 more points when hitting; coffee gives you speed."*

- **The drinks:** each is drunk like holy water and lasts a few minutes. While it lasts, a small icon by the hearts counts down.
  - **Beer:** strikes come faster, for more hits a second (shorter strike cooldown).
  - **Kombucha:** +2 damage on every hit.
  - **Coffee:** you move faster.
- **Where they come from:**
  - made at a new **brewery** building, or at the workshop;
  - beer from crops, kombucha from fruit, coffee from a new coffee crop or beans found in chests;
  - also found in chests (P4).
- **Stacking:** one of each can be active at a time, so all three together is the strongest combination.

## P6. Enchanted armour and weapons
*"Special effects on armour that do simple stuff: speed on boots, extra defence on chest plate and pants, and night vision on the helmet; and special attacks on the sword, like thunder, fire and ice: paralysing, burning and freezing."*

- **A boots slot:** a fourth armour slot for feet, with boots in each set.
- **Enchantments**, put on at the Temple (devotion plus an ingredient) or found on chest loot:
  - **Boots of Swiftness:** faster movement.
  - **Warded chest plate and leggings:** extra armour points.
  - **Helm of Night Sight:** nights and caves look lit, so you can see in the dark.
- **Elemental swords:**
  - **Thunder:** stuns a struck enemy for a moment, so it can't move or strike.
  - **Fire:** sets it burning, damage over a few seconds.
  - **Ice:** freezes it, which slows it a lot for a few seconds.
- **Visuals:** a coloured shimmer on the item icon, and a visible effect on the target (sparks, flames, frost).

---

## Suggested order

1. **P1 Homes:** bed, painting spawn point, furnished house designs. Small, and you'll feel it at once.
2. **P5 Drinks:** the timed-effect system, which P6 builds on.
3. **P4 Places to find:** ruins, temples, mines and monuments with chests, using loot from P5.
4. **P6 Enchantments:** the boots slot, armour effects, elemental swords.
5. **P2 Forests:** the leaf lighting pass.
6. **P3 Mobs and the avatar:** the biggest visual job — new models, third-person view and the settings.

The lore (7d onwards) can carry on in between. Which comes first is the user's call.
