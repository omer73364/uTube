// Keep presentation stable when a fallback restarts the underlying transfer.
// Actual byte events remain unchanged in the engine; only the UI holds its last
// position until the new attempt catches up. A manual retry uses a fresh filter.
export function createProgressFilter() {
  const order = { video: 0, audio: 1, merging: 2, converting: 2 };
  let activeStage;
  let visibleStage;
  let loaded = 0;
  let fraction = 0;
  return (event) => {
    if (event.type === 'retry') activeStage = undefined;
    if (event.type === 'stage') {
      activeStage = event.stage;
      if (visibleStage !== undefined && order[event.stage] <= order[visibleStage]) return false;
      visibleStage = event.stage;
      loaded = 0;
      fraction = 0;
    }
    if (event.type === 'progress') {
      if (activeStage !== visibleStage) return false;
      const nextFraction = event.total > 0 ? event.loaded / event.total : 0;
      if (event.loaded < loaded || nextFraction < fraction) return false;
      loaded = event.loaded;
      fraction = nextFraction;
    }
    return true;
  };
}
