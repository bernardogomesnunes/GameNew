export class UndoRedo {
  constructor(limit = 200) {
    this.stack = [];
    this.pointer = -1;
    this.limit = limit;
  }

  /** action: array of { x, y, z, prev, next } */
  push(action) {
    if (!action.length) return;
    this.stack.length = this.pointer + 1;
    this.stack.push(action);
    if (this.stack.length > this.limit) this.stack.shift();
    this.pointer = this.stack.length - 1;
  }

  canUndo() {
    return this.pointer >= 0;
  }

  canRedo() {
    return this.pointer < this.stack.length - 1;
  }

  undo() {
    if (!this.canUndo()) return null;
    const action = this.stack[this.pointer];
    this.pointer--;
    return action;
  }

  redo() {
    if (!this.canRedo()) return null;
    this.pointer++;
    return this.stack[this.pointer];
  }
}
