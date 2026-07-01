# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Froggy Pomodoro Database MCP Server.

This MCP server acts as the data-access layer ("reach") for the ADK study agent,
exposing tools to fetch tasks, create tasks, complete tasks, and retrieve pomodoro
statistics from the SQLite database.
"""

import logging
import os
import sqlite3
import sys

from mcp.server.fastmcp import FastMCP

# Setup clean logging to stderr to avoid interfering with stdio communication protocol
logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger("froggy_mcp_server")

# Initialize the FastMCP Server
mcp = FastMCP("Froggy Pomodoro Database Server")

# Resolve SQLite database path
PARENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.environ.get("DB_PATH", os.path.join(PARENT_DIR, "tasks.db"))

def get_db():
    """Establish connection to SQLite database with Row mapping."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ─── SECURITY FEATURES: INPUT SANITIZATION & SAFE SQL ───────────────────
def sanitize_string(value: str) -> str:
    """Sanitizes input strings to prevent SQL Injection and other exploits.

    Args:
        value: Input string.

    Returns:
        A cleaned string allowing only basic printable text characters.
    """
    if not value:
        return ""
    # Retain standard letters, numbers, spaces, and safe punctuation/markdown symbols
    return "".join(c for c in value if c.isalnum() or c in " -_.,!?@()[]:;/*+=\n\r")

@mcp.tool()
def get_user_tasks(username: str) -> list[dict]:
    """Get all tasks (to-do items) for a specific username.

    Args:
        username: The name of the user whose tasks to retrieve.
    """
    username = sanitize_string(username)
    logger.info(f"MCP tool get_user_tasks called for username: {username}")

    with get_db() as conn:
        cursor = conn.execute("SELECT id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        if not user:
            return []

        user_id = user["id"]
        cursor = conn.execute(
            "SELECT id, title, completed, due_date, category, urgency, notes FROM tasks WHERE user_id = ?",
            (user_id,)
        )
        tasks = [dict(row) for row in cursor.fetchall()]
        return tasks

@mcp.tool()
def create_user_task(
    username: str,
    title: str,
    due_date: str | None = None,
    category: str | None = None,
    urgency: str = "Medium",
    notes: str | None = None
) -> dict:
    """Create a new task in the database for a specific user.

    Args:
        username: The name of the user to assign the task to.
        title: The title of the task.
        due_date: The optional target completion date (YYYY-MM-DD).
        category: The optional task category (e.g. School, Work).
        urgency: The urgency level (Low, Medium, High).
        notes: Optional details or notes description for the task.
    """
    username = sanitize_string(username)
    title = sanitize_string(title)
    due_date = sanitize_string(due_date) if due_date else None
    category = sanitize_string(category) if category else None
    urgency = sanitize_string(urgency) if urgency else "Medium"
    notes = sanitize_string(notes) if notes else None

    logger.info(f"MCP tool create_user_task creating task '{title}' for '{username}'")

    with get_db() as conn:
        cursor = conn.execute("SELECT id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        if not user:
            # Safe guest fallback: auto-create username if it does not exist (no password login yet)
            default_hash = "scrypt:32768:8:1$defaulthash$somehashval"
            cursor = conn.execute(
                "INSERT INTO users (username, password) VALUES (?, ?)",
                (username, default_hash)
            )
            user_id = cursor.lastrowid
        else:
            user_id = user["id"]

        cursor = conn.execute(
            """
            INSERT INTO tasks (title, completed, user_id, due_date, category, urgency, notes)
            VALUES (?, 0, ?, ?, ?, ?, ?)
            """,
            (title, user_id, due_date, category, urgency, notes)
        )
        task_id = cursor.lastrowid
        conn.commit()

        return {
            "status": "success",
            "task_id": task_id,
            "title": title,
            "due_date": due_date,
            "category": category,
            "urgency": urgency
        }

@mcp.tool()
def complete_user_task(username: str, task_id: int) -> dict:
    """Mark an existing task as completed.

    Args:
        username: The name of the user who owns the task.
        task_id: The unique ID of the task to mark completed.
    """
    username = sanitize_string(username)
    logger.info(f"MCP tool complete_user_task completing task {task_id} for '{username}'")

    with get_db() as conn:
        cursor = conn.execute("SELECT id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        if not user:
            return {"status": "error", "message": "User not found"}

        user_id = user["id"]
        # Secure mutation: check ownership to prevent horizontal privilege escalation
        cursor = conn.execute(
            "UPDATE tasks SET completed = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            (task_id, user_id)
        )
        if cursor.rowcount == 0:
            return {"status": "error", "message": "Task not found or unauthorized"}

        conn.commit()
        return {"status": "success", "message": f"Task {task_id} successfully marked completed"}

@mcp.tool()
def get_pomodoro_stats(username: str) -> dict:
    """Retrieve Pomodoro timer tracking stats for a specific user.

    Args:
        username: The name of the user whose stats to fetch.
    """
    username = sanitize_string(username)
    logger.info(f"MCP tool get_pomodoro_stats requested for: {username}")

    with get_db() as conn:
        cursor = conn.execute("SELECT id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        if not user:
            return {"total_sessions": 0, "total_minutes": 0, "categories": {}}

        user_id = user["id"]

        # Aggregate totals
        stats_cursor = conn.execute(
            "SELECT COUNT(*) as total_count, SUM(duration_minutes) as total_min FROM pomodoro_logs WHERE user_id = ?",
            (user_id,)
        )
        stats = stats_cursor.fetchone()
        total_count = stats["total_count"] or 0
        total_min = stats["total_min"] or 0

        # Breakdown by work session categories
        cat_cursor = conn.execute(
            "SELECT category, COUNT(*) as count, SUM(duration_minutes) as min FROM pomodoro_logs WHERE user_id = ? GROUP BY category",
            (user_id,)
        )
        categories = {}
        for row in cat_cursor.fetchall():
            categories[row["category"]] = {
                "count": row["count"],
                "minutes": row["min"]
            }

        return {
            "total_sessions": total_count,
            "total_minutes": total_min,
            "categories": categories
        }

if __name__ == "__main__":
    mcp.run(transport="stdio")
