export const INTRO = [
  { art: 'sky', text: 'Above the clouds hangs the Sky Kingdom: white halls, gold roofs, and fireflies that light it all night long. Its people follow the white god, who has no name. You were born there.' },
  { art: 'army', text: 'Below it, the Stone Kingdom gathered. Its dark army came to the anchor towers and laid hands on the great chains that hold the island in the sky.' },
  { art: 'fall', text: 'In the fighting at the edge, you fell — through the fireflies, through the clouds, down and down.' },
  { art: 'arrival', text: 'You woke far from anywhere, with thirty-two blocks of land, an axe and a bucket. Build. Grow. And at your Temple\'s height, choose which god you\'ll follow.' },
];

export const ENDINGS = {
  white: [
    { art: 'walls', text: 'Ten times the Stone Kingdom came for you, and ten times it went home with nothing. The Warlord is beaten; the dark army is broken.' },
    { art: 'blessing', text: 'Your walls stand and your people sleep easy. Above your land at night the white god\'s fireflies drift — his blessing on the home you held.' },
    { art: 'dawn', text: 'You never went back to the sky. You built a kingdom of your own on the ground instead, and it is yours.' },
  ],
  dark: [
    { art: 'throne', text: 'The Sky King is fallen. In the white throne room you were born beneath, his crown lies on the steps.' },
    { art: 'dominion', text: 'The island you fell from hangs over land that answers to you now. Black banners fly from its halls; your warriors hold its chains.' },
    { art: 'lord', text: 'The Stone King has named you Lord of the Sky. The dark god has what he wanted — and so, for now, do you.' },
  ],
  yielded: [
    { art: 'sinking', text: 'One by one you cut its four great chains, and the Sky Kingdom began to sink — lower every day, its waterfalls running dry.' },
    { art: 'throne', text: 'Before it could fall, the Sky King came down from his throne and gave up the island. Not a blow was struck at him.' },
    { art: 'lord', text: 'The Stone King has named you Lord of the Sky. The dark god has what he wanted — and so, for now, do you.' },
  ],
};

// Which ending a world has earned lives with the lore book, which tells it too.
export { endingFor } from '../config/lore.js';


