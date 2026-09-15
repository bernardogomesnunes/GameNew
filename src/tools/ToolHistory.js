/**
 * The last few things a tool did, so one of them can be taken back off.
 *
 * This replaces a general undo stack, which was the wrong idea for this game.
 * Breaking a block is how you take a block back — that is the loop, the blocks
 * go in your bag, and a Ctrl+Z sitting beside it was a second, parallel way to
 * reverse things borrowed from a text editor. Two toolbar buttons for it, at
 * that, in the corner where the things you actually use live.
 *
 * What breaking does not answer is a tool: a roof lays sixty-odd blocks in one
 * press and a stamped design a couple of hundred, and "just break it" is not a
 * reasonable answer to sixty-seven blocks. So the history is only ever tool
 * work — one entry per press, named after what it was, so taking it back can
 * say what it is taking back.
 *
 * Deliberately short. This is "that was not what I wanted", not a document's
 * revision history — and the world keeps real versions every few minutes for
 * the case where you want to go back further.
 */

export class ToolHistory {
  constructor(limit = 8) {
    this.stack = [];
    this.limit = limit;
  }

  /** Remembers one tool action: what it was called, and every block it changed. */
  push(label, changes) {
    if (!changes?.length) return;
    this.stack.push({ label, changes });
    while (this.stack.length > this.limit) this.stack.shift();
  }

  get last() {
    return this.stack[this.stack.length - 1] ?? null;
  }

  /** Takes the most recent one off the stack, or null when there is nothing. */
  pop() {
    return this.stack.pop() ?? null;
  }

  clear() {
    this.stack.length = 0;
  }
}
