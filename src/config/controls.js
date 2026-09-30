/**
 * Controls: which key does what, how far the camera sees round you, how fast
 * the mouse turns it, and how loud the game is.
 *
 * Requested directly: "another thing we are missing is controls settings, in
 * settings we should add controls to change keyboards, sound, FOV would be a
 * nice to have." Kept apart from the graphics settings (render/graphics.js)
 * because these follow the player, not the machine — but stored the same
 * way, in this browser, remembered between visits.
 *
 * A binding is a KeyboardEvent.code, so it names the key's place on the
 * keyboard rather than the letter printed on it: WASD stays in the same
 * spot on an AZERTY keyboard.
 */

const KEY = 'voxelgame:controls';

/** Everything you can rebind, in the order the settings list them. */
export const ACTIONS = [
  { id: 'forward', name: 'Walk forward', key: 'KeyW' },
  { id: 'back', name: 'Walk back', key: 'KeyS' },
  { id: 'left', name: 'Step left', key: 'KeyA' },
  { id: 'right', name: 'Step right', key: 'KeyD' },
  { id: 'jump', name: 'Jump / swim or fly up', key: 'Space' },
  { id: 'sprint', name: 'Sprint', key: 'ShiftLeft' },
  { id: 'down', name: 'Swim or fly down', key: 'ControlLeft' },
  { id: 'fly', name: 'Fly on / off', key: 'KeyF' },
  { id: 'turn', name: 'Turn a roof or design', key: 'KeyR' },
];

export const DEFAULT_CONTROLS = {
  keys: Object.fromEntries(ACTIONS.map((a) => [a.id, a.key])),
  fov: 75,            // degrees, vertical
  sensitivity: 1,     // times the default mouse speed
  volume: 0.7,        // 0..1
  // Phones and tablets: which side walks, and which thumb Break, Place, Fly
  // and More sit beside. See UIManager.applyTouchLayout.
  walkSide: 'left',   // 'left' | 'right'
  actionSide: 'walk', // 'walk' | 'look'
};

/** The body classes a touch layout comes down to (styles.css does the rest). */
export function touchLayoutClasses(controls) {
  return {
    'touch-walk-right': controls?.walkSide === 'right',
    'touch-act-look': controls?.actionSide === 'look',
  };
}

export const FOV_RANGE = [55, 110];
export const SENSITIVITY_RANGE = [0.3, 3];

export function loadControls() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw) return structuredClone(DEFAULT_CONTROLS);
    return { ...DEFAULT_CONTROLS, ...raw, keys: { ...DEFAULT_CONTROLS.keys, ...(raw.keys ?? {}) } };
  } catch {
    return structuredClone(DEFAULT_CONTROLS);
  }
}

export function saveControls(controls) {
  try {
    localStorage.setItem(KEY, JSON.stringify(controls));
  } catch { /* a browser with storage blocked still gets to play */ }
}

/**
 * Binds `action` to `code`. A key does one thing: if another action had it,
 * that action gets this one's old key in exchange, so nothing is left
 * unbound and nothing fires twice.
 */
export function rebind(controls, action, code) {
  const keys = { ...controls.keys };
  const old = keys[action];
  for (const [other, k] of Object.entries(keys)) if (k === code && other !== action) keys[other] = old;
  keys[action] = code;
  return { ...controls, keys };
}

/** A key's name as a person would say it: "W", "Space", "Left Shift". */
export function keyLabel(code) {
  if (!code) return '—';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  const named = {
    Space: 'Space', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Ctrl',
    ControlRight: 'Right Ctrl', AltLeft: 'Left Alt', AltRight: 'Right Alt', Tab: 'Tab', CapsLock: 'Caps Lock',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Backquote: '`',
  };
  return named[code] ?? code;
}
