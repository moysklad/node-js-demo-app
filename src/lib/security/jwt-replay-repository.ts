import type { Pool } from "pg";

export interface JwtReplayRepository {
  register(jti: string, expUnixSeconds: number): Promise<boolean>;
}

const PRUNE_INTERVAL_MS = 60_000;
const PRUNE_MAX_ROWS_PER_RUN = 500;

export class JwtReplay {
  private static repository: JwtReplayRepository | null = null;

  static configureRepository(nextRepository: JwtReplayRepository): void {
    JwtReplay.repository = nextRepository;
  }

  static register(jti: string, expUnixSeconds: number): Promise<boolean> {
    if (!JwtReplay.repository) {
      throw new Error("JWT replay repository is not configured");
    }

    return JwtReplay.repository.register(jti, expUnixSeconds);
  }
}

export class PostgresJwtReplayRepository implements JwtReplayRepository {
  private lastPruneAt = 0;

  constructor(private readonly pool: Pool) {}

  async register(jti: string, expUnixSeconds: number): Promise<boolean> {
    await this.maybePruneExpiredJti();

    // Повтор jti упирается в первичный ключ: строка вставится только один раз.
    const { rows } = await this.pool.query(
      "INSERT INTO jwt (jti, expires_at) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING RETURNING jti",
      [jti, expUnixSeconds * 1000]
    );

    return rows.length === 1;
  }

  private async maybePruneExpiredJti(): Promise<void> {
    const now = Date.now();

    if (now - this.lastPruneAt < PRUNE_INTERVAL_MS) {
      return;
    }

    this.lastPruneAt = now;
    // Bounded prune: remove expired JTI rows in small batches to avoid long deletes.
    await this.pool.query("DELETE FROM jwt WHERE jti IN (SELECT jti FROM jwt WHERE expires_at <= $1 LIMIT $2)", [
      now,
      PRUNE_MAX_ROWS_PER_RUN
    ]);
  }
}
