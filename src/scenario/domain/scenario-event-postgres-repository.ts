import type { Pool } from "pg";
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

export class PostgresScenarioEventRepository implements ScenarioEventRepository {
  constructor(private readonly pool: Pool) {}

  async save(event: ScenarioEventData): Promise<ScenarioEventData> {
    const createdAt = event.createdAt || new Date().toISOString();
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const inserted = await client.query<{ id: number }>(
        `
          INSERT INTO scenario_event (
            application_id, account_id, action_name, action_type, object_type, object_id,
            object_name, outcome, message, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `,
        [
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
        ]
      );

      await client.query(
        `
          DELETE FROM scenario_event
          WHERE application_id = $1 AND account_id = $2 AND id NOT IN (
            SELECT id FROM scenario_event
            WHERE application_id = $1 AND account_id = $2
            ORDER BY id DESC LIMIT $3
          )
        `,
        [event.appId, event.accountId, SCENARIO_EVENTS_LIMIT]
      );
      await client.query("COMMIT");

      return { ...event, id: inserted.rows[0]!.id, createdAt };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listRecent(appId: string, accountId: string, limit = SCENARIO_EVENTS_LIMIT): Promise<ScenarioEventData[]> {
    const { rows } = await this.pool.query<ScenarioEventRow>(
      `
        SELECT id, application_id, account_id, action_name, action_type, object_type, object_id,
          object_name, outcome, message, created_at
        FROM scenario_event
        WHERE application_id = $1 AND account_id = $2
        ORDER BY id DESC LIMIT $3
      `,
      [appId, accountId, limit]
    );

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
