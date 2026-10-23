import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ensurePrivateDir } from "../../lib/security/security";
import { SCENARIO_EVENTS_LIMIT, type ScenarioEventData, type ScenarioEventRepository } from "./scenario-event";

type ScenarioEventRow = {
  id: number;
  application_id: string;
  account_id: string;
  action_name: string;
  action_type: string;
  object_type: string;
  object_id: string;
  object_name: string | null;
  outcome: string;
  message: string | null;
  created_at: string;
};

export class SqliteScenarioEventRepository implements ScenarioEventRepository {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    ensurePrivateDir(path.dirname(filename));
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec("PRAGMA busy_timeout=5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scenario_event (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        action_name TEXT NOT NULL,
        action_type TEXT NOT NULL,
        object_type TEXT NOT NULL,
        object_id TEXT NOT NULL,
        object_name TEXT,
        outcome TEXT NOT NULL,
        message TEXT,
        created_at TEXT NOT NULL
      )
    `);
    this.db.exec("CREATE INDEX IF NOT EXISTS scenario_event_account ON scenario_event (application_id, account_id, id)");
  }

  save(event: ScenarioEventData): ScenarioEventData {
    const createdAt = event.createdAt || new Date().toISOString();

    this.db.exec("BEGIN");
    try {
      const inserted = this.db
        .prepare(`
          INSERT INTO scenario_event (
            application_id, account_id, action_name, action_type, object_type, object_id,
            object_name, outcome, message, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          event.appId,
          event.accountId,
          event.actionName,
          event.actionType,
          event.objectType,
          event.objectId,
          event.objectName || null,
          event.outcome,
          event.message || null,
          createdAt
        );

      this.db
        .prepare(`
          DELETE FROM scenario_event
          WHERE application_id = ? AND account_id = ? AND id NOT IN (
            SELECT id FROM scenario_event
            WHERE application_id = ? AND account_id = ?
            ORDER BY id DESC LIMIT ?
          )
        `)
        .run(event.appId, event.accountId, event.appId, event.accountId, SCENARIO_EVENTS_LIMIT);
      this.db.exec("COMMIT");

      return { ...event, id: Number(inserted.lastInsertRowid), createdAt };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  listRecent(appId: string, accountId: string, limit = SCENARIO_EVENTS_LIMIT): ScenarioEventData[] {
    const rows = this.db
      .prepare(`
        SELECT id, application_id, account_id, action_name, action_type, object_type, object_id,
          object_name, outcome, message, created_at
        FROM scenario_event
        WHERE application_id = ? AND account_id = ?
        ORDER BY id DESC LIMIT ?
      `)
      .all(appId, accountId, limit) as ScenarioEventRow[];

    return rows.map(mapRow);
  }
}

function mapRow(row: ScenarioEventRow): ScenarioEventData {
  return {
    id: row.id,
    appId: row.application_id,
    accountId: row.account_id,
    actionName: row.action_name,
    actionType: row.action_type,
    objectType: row.object_type,
    objectId: row.object_id,
    objectName: row.object_name ?? "",
    outcome: row.outcome as ScenarioEventData["outcome"],
    message: row.message ?? "",
    createdAt: row.created_at
  };
}
