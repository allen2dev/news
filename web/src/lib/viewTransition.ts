/** Wrap DOM updates in View Transitions when supported */
export function runViewTransition(update: () => void): Promise<void> {
  if (typeof document !== "undefined" && document.startViewTransition) {
    return document.startViewTransition(update).finished;
  }
  update();
  return Promise.resolve();
}
