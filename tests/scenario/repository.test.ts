// Интеграционный тест: HTTP-маршруты приложения или SQLite.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SCENARIO_EVENTS_LIMIT, ScenarioEvent } from "../../src/scenario/domain/scenario-event";
import { SqliteScenarioEventRepository } from "../../src/scenario/domain/scenario-event-sqlite-repository";

test("SQLite хранит последние 50 срабатываний на аккаунт, новые первыми", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "scenario-event-test-"));

  try {
    ScenarioEvent.configureRepository(new SqliteScenarioEventRepository(path.join(directory, "app.sqlite")));

    for (let index = 1; index <= SCENARIO_EVENTS_LIMIT + 5; index += 1) {
      const event = new ScenarioEvent("app-1", "account-1", "log-event", "MODIFY", "CustomerOrder", `order-${index}`);
      event.message = `событие ${index}`;
      event.persist();
      assert.ok(event.id);
      assert.ok(event.createdAt);
    }

    const other = new ScenarioEvent("app-1", "account-2", "reject", "ADD", "CustomerOrder", "order-x");
    other.outcome = "rejected";
    other.persist();

    const recent = ScenarioEvent.listRecent("app-1", "account-1");

    assert.equal(recent.length, SCENARIO_EVENTS_LIMIT);
    assert.equal(recent[0]?.objectId, `order-${SCENARIO_EVENTS_LIMIT + 5}`);
    assert.equal(recent.at(-1)?.objectId, "order-6");
    assert.equal(ScenarioEvent.listRecent("app-1", "account-2")[0]?.outcome, "rejected");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
