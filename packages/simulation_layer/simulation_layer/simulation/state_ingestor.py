from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Iterable, Sequence

from simulation_layer.models.cooperative_state_snapshot import (
    CooperativeStateSnapshot,
    EntropyConcentrationLevel,
    TrustVector,
)


class StateIngestor:
    """
    Loads the current cooperative network state from PostgreSQL/TimescaleDB.
    """

    def __init__(
        self,
        dsn: str | None = None,
        action_lookback_hours: int = 24,
    ) -> None:
        self._dsn = dsn or os.getenv("SIMULATION_DB_DSN") or os.getenv("DATABASE_URL")
        self._action_lookback_hours = max(1, int(action_lookback_hours))

    def load_current_state(
        self,
        simulation_id: str = "live-network",
        capture_step: int = 0,
    ) -> CooperativeStateSnapshot:
        if not self._dsn:
            raise RuntimeError(
                "StateIngestor requires a PostgreSQL DSN via SIMULATION_DB_DSN or DATABASE_URL."
            )

        try:
            import psycopg
            from psycopg import sql
        except ImportError as exc:
            raise RuntimeError(
                "psycopg is required for live state ingestion. Install `psycopg[binary]`."
            ) from exc

        with psycopg.connect(self._dsn) as conn:
            with conn.cursor() as cursor:
                trust_table = self._resolve_table(
                    cursor,
                    ("agent_trust_scores", "trust_scores"),
                )
                if trust_table is None:
                    raise RuntimeError(
                        "No trust score table found. Expected one of: agent_trust_scores, trust_scores."
                    )

                trust_agent_col = self._resolve_column(
                    cursor,
                    trust_table,
                    ("agent_id", "entity_id"),
                )
                trust_value_col = self._resolve_column(
                    cursor,
                    trust_table,
                    ("trust_score", "score", "value"),
                )
                trust_time_col = self._resolve_column(
                    cursor,
                    trust_table,
                    ("recorded_at", "updated_at", "created_at", "ts"),
                )
                if not trust_agent_col or not trust_value_col:
                    raise RuntimeError(
                        f"Table {trust_table} is missing required trust columns."
                    )

                if trust_time_col:
                    cursor.execute(
                        sql.SQL(
                            """
                            SELECT agent_ref, trust_score
                            FROM (
                                SELECT {agent_col} AS agent_ref,
                                       {value_col} AS trust_score,
                                       ROW_NUMBER() OVER (
                                           PARTITION BY {agent_col}
                                           ORDER BY {time_col} DESC
                                       ) AS rn
                                FROM {table}
                                WHERE {value_col} IS NOT NULL
                            ) ranked
                            WHERE rn = 1
                            ORDER BY agent_ref
                            """
                        ).format(
                            table=self._ident(sql, trust_table),
                            agent_col=self._ident(sql, trust_agent_col),
                            value_col=self._ident(sql, trust_value_col),
                            time_col=self._ident(sql, trust_time_col),
                        )
                    )
                else:
                    cursor.execute(
                        sql.SQL(
                            """
                            SELECT {agent_col} AS agent_ref, AVG({value_col}) AS trust_score
                            FROM {table}
                            WHERE {value_col} IS NOT NULL
                            GROUP BY {agent_col}
                            ORDER BY {agent_col}
                            """
                        ).format(
                            table=self._ident(sql, trust_table),
                            agent_col=self._ident(sql, trust_agent_col),
                            value_col=self._ident(sql, trust_value_col),
                        )
                    )
                trust_rows = cursor.fetchall()
                if not trust_rows:
                    raise RuntimeError("Live trust-score ingestion returned no rows.")

                trust_vectors = tuple(
                    TrustVector(entity_id=str(agent_id), values=(float(score),))
                    for agent_id, score in trust_rows
                    if score is not None
                )
                if not trust_vectors:
                    raise RuntimeError("No valid trust scores found in live dataset.")

                action_table = self._resolve_table(
                    cursor,
                    ("agent_actions", "actions"),
                )
                entropy_levels: tuple[EntropyConcentrationLevel, ...] = tuple()
                if action_table:
                    action_agent_col = self._resolve_column(
                        cursor,
                        action_table,
                        ("agent_id", "entity_id"),
                    )
                    action_time_col = self._resolve_column(
                        cursor,
                        action_table,
                        ("recorded_at", "created_at", "event_time", "ts"),
                    )
                    if action_agent_col and action_time_col:
                        since = datetime.now(timezone.utc) - timedelta(
                            hours=self._action_lookback_hours
                        )
                        cursor.execute(
                            sql.SQL(
                                """
                                SELECT {agent_col} AS agent_ref, COUNT(*)::float AS action_count
                                FROM {table}
                                WHERE {time_col} >= %s
                                GROUP BY {agent_col}
                                ORDER BY {agent_col}
                                """
                            ).format(
                                table=self._ident(sql, action_table),
                                agent_col=self._ident(sql, action_agent_col),
                                time_col=self._ident(sql, action_time_col),
                            ),
                            (since,),
                        )
                        action_rows = cursor.fetchall()
                        entropy_levels = self._action_concentrations(action_rows)

        metadata = {
            "state_source": "timescaledb",
            "ingested_at_utc": datetime.now(timezone.utc).isoformat(),
            "action_lookback_hours": self._action_lookback_hours,
        }
        return CooperativeStateSnapshot(
            simulation_id=simulation_id,
            capture_step=capture_step,
            trust_vectors=trust_vectors,
            entropy_concentration_levels=entropy_levels,
            metadata=tuple((k, metadata[k]) for k in sorted(metadata)),
        )

    @staticmethod
    def _ident(sql_module: object, name: str):
        return sql_module.Identifier(*name.split(".", 1)) if "." in name else sql_module.Identifier(name)

    @staticmethod
    def _action_concentrations(
        action_rows: Sequence[tuple[object, object]],
    ) -> tuple[EntropyConcentrationLevel, ...]:
        if not action_rows:
            return tuple()
        counts: list[tuple[str, float]] = []
        total = 0.0
        for agent_id, raw_count in action_rows:
            count = max(0.0, float(raw_count or 0.0))
            if count <= 0.0:
                continue
            counts.append((str(agent_id), count))
            total += count
        if total <= 0.0:
            return tuple()
        return tuple(
            EntropyConcentrationLevel(scope=agent_id, value=count / total)
            for agent_id, count in counts
        )

    @staticmethod
    def _resolve_table(cursor: object, candidates: Iterable[str]) -> str | None:
        for table_name in candidates:
            cursor.execute("SELECT to_regclass(%s)", (table_name,))
            row = cursor.fetchone()
            if row and row[0]:
                return str(row[0])
        return None

    @staticmethod
    def _resolve_column(
        cursor: object,
        table_name: str,
        candidates: Iterable[str],
    ) -> str | None:
        schema, table = StateIngestor._split_table_name(table_name)
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = %s
              AND table_name = %s
            """,
            (schema, table),
        )
        columns = {str(row[0]) for row in cursor.fetchall()}
        for candidate in candidates:
            if candidate in columns:
                return candidate
        return None

    @staticmethod
    def _split_table_name(table_name: str) -> tuple[str, str]:
        if "." in table_name:
            schema, table = table_name.split(".", 1)
            return schema, table
        return "public", table_name
