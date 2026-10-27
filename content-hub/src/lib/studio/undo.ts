// Undo folds a quick run of changes (a slider being dragged) into one step.
// A one-tap tool (cut the dead space, add a clip, AI zoom) marks its change
// as a step of its own, however soon it follows the last one.
let mark = 0;

export const newUndoStep = () => {
  mark++;
};

export const undoMark = () => mark;
