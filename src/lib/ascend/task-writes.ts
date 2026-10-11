/** Serialize persistence per task, without delaying its optimistic screen update. */
const writes = new Map<string, Promise<unknown>>();

export function persistTaskWrite<T>(id: string, write: () => Promise<T>): Promise<T> {
  const previous = writes.get(id) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(write);
  writes.set(id, next);
  void next.finally(() => {
    if (writes.get(id) === next) writes.delete(id);
  }).catch(() => undefined);
  return next;
}