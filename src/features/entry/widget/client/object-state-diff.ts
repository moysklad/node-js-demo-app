/** Разница между двумя objectState из сообщений Change — чтобы в логе виджета было видно, что именно поменялось. */

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (left && right && typeof left === "object" && typeof right === "object") {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }

  return false;
}

export function diffState(oldState: Record<string, unknown>, newState: Record<string, unknown>): Map<string, unknown> {
  const result = new Map<string, unknown>();

  for (const key in newState) {
    const hasOldValue = Object.prototype.hasOwnProperty.call(oldState, key);

    if (!hasOldValue || !valuesEqual(newState[key], oldState[key])) {
      result.set(key, newState[key]);
    }
  }

  for (const key in oldState) {
    if (!Object.prototype.hasOwnProperty.call(newState, key)) {
      result.set(key, "<deleted>");
    }
  }

  return result;
}

export function formatDiffs(map: Map<string, unknown>): string {
  if (map.size === 0) {
    return "objectState: no changes";
  }

  const lines: string[] = [];

  map.forEach((value, key) => {
    lines.push(value && typeof value === "object" ? `${key} = {...}` : `${key} = ${String(value)}`);
  });

  return `objectState changes:\n${lines.join("\n")}`;
}
