// Интеграционный тест: HTTP-маршруты приложения или PostgreSQL.
import assert from "node:assert/strict";
import test from "node:test";
import { SCENARIO_EVENTS_LIMIT, ScenarioEvent } from "../../src/scenario/domain/scenario-event";
import { PostgresScenarioEventRepository } from "../../src/scenario/domain/scenario-event-postgres-repository";
import { createTestDatabase } from "../db";

test("PostgreSQL хранит последние 50 срабатываний на аккаунт, новые первыми", async () => {
  const db = await createTestDatabase();

  try {
    ScenarioEvent.configureRepository(new PostgresScenarioEventRepository(db.pool));

    for (let index = 1; index <= SCENARIO_EVENTS_LIMIT + 5; index += 1) {
      const event = new ScenarioEvent("app-1", "account-1", "log-event", "MODIFY", "CustomerOrder", `order-${index}`);
      event.message = `событие ${index}`;
      await event.persist();
      assert.ok(event.id);
      assert.ok(event.createdAt);
    }

    const other = new ScenarioEvent("app-1", "account-2", "reject", "ADD", "CustomerOrder", "order-x");
    other.outcome = "rejected";
    await other.persist();

    const recent = await ScenarioEvent.listRecent("app-1", "account-1");

    assert.equal(recent.length, SCENARIO_EVENTS_LIMIT);
    assert.equal(recent[0]?.objectId, `order-${SCENARIO_EVENTS_LIMIT + 5}`);
    assert.equal(recent.at(-1)?.objectId, "order-6");
    assert.equal((await ScenarioEvent.listRecent("app-1", "account-2"))[0]?.outcome, "rejected");
  } finally {
    await db.close();
  }
});
