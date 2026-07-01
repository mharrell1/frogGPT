# ruff: noqa
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
Study Agent — ADK 2.0 multi-agent implementation.

Architecture:
  root_agent (coordinator)
  ├── flashcard_agent  → generates Q&A flashcard decks
  ├── study_guide_agent → generates structured study guides
  ├── quiz_agent        → generates multiple-choice practice quizzes
  └── test_agent        → generates mixed-format practice tests
"""

import json
import os

# Force Gemini API / AI Studio key mode and prevent conflict with enterprise setting
os.environ["GOOGLE_GENAI_USE_ENTERPRISE"] = "False"
if not os.environ.get("GOOGLE_GENAI_USE_VERTEXAI"):
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "False")

from dotenv import load_dotenv

# Load .env from project root (study-agent/.env)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from google.adk.agents import Agent
from google.adk.apps import App
from google.adk.models import Gemini
from google.adk.tools.load_web_page import load_web_page
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters
from google.genai import types

from .schemas import FlashcardDeck, PracticeTest, Quiz, StudyGuide, TopicExplanation
from .tools import (
    export_as_docx,
    export_as_pdf,
    format_flashcards_markdown,
    format_practice_test_markdown,
    format_quiz_markdown,
    format_study_guide_markdown,
    format_explanation_markdown,
    read_file_content,
)

# ─── Auth mode ─────────────────────────────────────────────────────────────
# Option A (default, no billing required): set GOOGLE_API_KEY in .env
# Option B (Vertex AI): set GOOGLE_GENAI_USE_VERTEXAI=True + GOOGLE_CLOUD_PROJECT in .env

# ─── Shared model ───────────────────────────────────────────────────────────
_model = Gemini(
    model="gemini-2.5-flash",
    retry_options=types.HttpRetryOptions(attempts=3),
)

# ─────────────────────────────────────────────────────────────────────────────
# Specialist Sub-Agents (mode="task" → typed Pydantic output)
# ─────────────────────────────────────────────────────────────────────────────

flashcard_agent = Agent(
    name="flashcard_agent",
    model=_model,
    mode="task",
    output_schema=FlashcardDeck,
    description="Generates a structured flashcard deck from provided content or a topic.",
    instruction="""
You are an expert educator specialising in active recall and spaced repetition.

Your task: Generate a high-quality flashcard deck from the content or topic provided by the coordinator.

Rules:
- Create between 10 and 25 flashcards depending on the depth of the material.
- Each flashcard must have a clear, specific question on the front and a concise, accurate answer on the back.
- Assign each card to a relevant sub-topic.
- Cover definitions, facts, processes, comparisons, and applied concepts.
- Avoid yes/no questions — prefer "What is...", "Explain...", "How does...", "What is the difference between...".
- Vary difficulty: include basic recall, conceptual understanding, and application questions.

After generating the deck, call finish_task with the FlashcardDeck result.
""",
)

study_guide_agent = Agent(
    name="study_guide_agent",
    model=_model,
    mode="task",
    output_schema=StudyGuide,
    description="Generates a comprehensive, well-structured study guide from provided content or a topic.",
    instruction="""
You are an expert educator and technical writer.

Your task: Create a clear, comprehensive study guide from the content or topic provided by the coordinator.

Rules:
- Organise the guide into logical sections (e.g., Introduction, Core Concepts, Key Processes, Applications, Review).
- Each section must have: a summary paragraph, 3-6 key concepts with definitions and examples, and important bullet points.
- Write the overview to orient the reader in 2-3 sentences.
- End with a concise summary of the most important takeaways.
- Use clear, precise language — assume the reader is a student seeing this topic for the first time.
- Do not pad with generic filler — every sentence should add information value.

After generating the guide, call finish_task with the StudyGuide result.
""",
)

quiz_agent = Agent(
    name="quiz_agent",
    model=_model,
    mode="task",
    output_schema=Quiz,
    description="Generates a multiple-choice practice quiz from provided content or a topic.",
    instruction="""
You are an expert educator and assessment designer.

Your task: Create a challenging, well-crafted multiple-choice quiz from the content or topic provided by the coordinator.

Rules:
- Generate between 8 and 15 questions by default (adjust if the user specifies a count).
- Each question must have exactly 4 options labeled: "A) ...", "B) ...", "C) ...", "D) ...".
- Set the correct_answer field to the letter only: "A", "B", "C", or "D".
- Write plausible distractors — wrong answers should be believable, not obviously wrong.
- Include a clear explanation for why the correct answer is right.
- Vary question types: factual recall, conceptual understanding, application, and analysis.
- Set an appropriate overall difficulty level: "easy", "medium", or "hard".
- Do NOT repeat the same concept across multiple questions.

After generating the quiz, call finish_task with the Quiz result.
""",
)

test_agent = Agent(
    name="test_agent",
    model=_model,
    mode="task",
    output_schema=PracticeTest,
    description="Generates a comprehensive mixed-format practice test (true/false, multiple-choice, short answer).",
    instruction="""
You are an expert educator and exam designer.

Your task: Create a realistic, comprehensive practice test from the content or topic provided by the coordinator.

Rules:
- Structure the test into three sections:
    Section A — True/False: 5 statements (1 pt each)
    Section B — Multiple Choice: 8 questions (1 pt each)
    Section C — Short Answer: 3 questions (3 pts each)
- Total points: 5 + 8 + 9 = 22 pts (adjust if user requests different weights).
- Suggest a realistic time_limit_minutes (typically 30-45 min for this size).
- True/False statements must be factually precise — avoid trick statements. Set correct_answer to boolean true or false (do not use string "True" or "False").
- MCQ options must contain exactly 4 choices, labeled "A) ...", "B) ...", "C) ...", "D) ...". Set correct_answer to the correct option letter only ("A", "B", "C", or "D").
- Short answer questions should require 2-4 sentences; provide a model answer and a list of 3-5 key grading points.
- Write clear student instructions.
- Vary cognitive levels: recall, comprehension, application, and analysis.

After generating the test, call finish_task with the PracticeTest result.
""",
)

explain_agent = Agent(
    name="explain_agent",
    model=_model,
    mode="task",
    output_schema=TopicExplanation,
    description="Explains and simplifies a topic or concept using analogies and simple terms.",
    instruction="""
You are an expert educator, tutor, and science communicator.

Your task: Provide a clear, simplified explanation of the topic or concept provided by the coordinator.

Rules:
- Give a brief, accurate high-level summary of the concept.
- Write a simplified explanation in plain English. Use analogies and metaphors that anyone can understand. Break down complex jargon.
- Provide a creative, relatable analogy to help visualize the concept.
- List 3-5 key takeaways/core facts that are essential to understanding the topic.

After generating the explanation, call finish_task with the TopicExplanation result.
""",
)

# ─────────────────────────────────────────────────────────────────────────────
# Root Coordinator Agent
# ─────────────────────────────────────────────────────────────────────────────

# ─── MCP Server Setup ────────────────────────────────────────────────────────
mcp_python = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    ".venv",
    "bin",
    "python"
)
if not os.path.exists(mcp_python):
    mcp_python = sys.executable

mcp_script = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "mcp_server.py"
)

db_mcp_toolset = McpToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command=mcp_python,
            args=[mcp_script],
        )
    )
)

async def init_state(callback_context) -> None:
    """Initialize state before agent runs to ensure context variables like user_id are set."""
    if callback_context.state is None:
        callback_context.state = {}
    if "user_id" not in callback_context.state:
        callback_context.state["user_id"] = "guest_user"

# Root Coordinator Agent
# ─────────────────────────────────────────────────────────────────────────────

root_agent = Agent(
    name="study_agent",
    model=_model,
    description="A study assistant that generates flashcards, study guides, quizzes, practice tests, and explains complex topics.",
    before_agent_callback=init_state,
    instruction="""
You are **Study Agent** — an AI-powered study assistant that helps students learn more effectively.

You are interacting with the user whose username is {user_id}. When querying or updating tasks or pomodoro stats, always use this username.

You can generate any of the following study materials or explanations:
  📇 **Flashcards** — Q&A pairs for active recall practice
  📚 **Study Guide** — structured summary with key concepts, definitions, and examples
  📝 **Practice Quiz** — multiple-choice questions to test understanding
  🧪 **Practice Test** — full mixed-format test (true/false, MCQ, short answer)
  💡 **Explanation / Simplification** — simplified explanation with analogies and key takeaways for quick learning

You also have access to the user's task list (to-do tasks) and Pomodoro timer logs via the custom MCP Database Server tools:
  📋 **Task Management** — list tasks (`get_user_tasks`), create tasks (`create_user_task`), and mark tasks as completed (`complete_user_task`) in the database.
  ⏱️ **Pomodoro Stats** — retrieve aggregated Pomodoro study sessions and minutes (`get_pomodoro_stats`).

When the user asks about their tasks, schedule, or pomodoro progress, use these MCP database tools.

═══ HOW TO HANDLE USER REQUESTS ═══

**Step 1 — Gather the source content.**

The user may provide content in any of these forms:
  (a) A topic or concept name → use your own knowledge; no tool needed.
  (b) Raw notes/text pasted directly → use that text as-is; no tool needed.
  (c) A file path (e.g. "/Users/jane/notes.txt", "notes.pdf") → call `read_file_content` first.
  (d) A URL (starts with "http://" or "https://") → call `load_web_page` first to fetch the content.

If the user provides a file path or URL, ALWAYS fetch the content first before delegating to sub-agents.

**Step 2 — Determine what to generate.**

If the user doesn't specify, ask which material(s) or explanation they want — or offer to generate all five.
You may generate multiple materials in sequence if requested.

**Step 3 — Delegate to the appropriate specialist agent(s).**

Pass the full source content to the sub-agent along with any user preferences (e.g. number of questions, difficulty).

- For **flashcards** → delegate to `flashcard_agent`
- For **study guide** → delegate to `study_guide_agent`
- For **quiz** → delegate to `quiz_agent`
- For **practice test** → delegate to `test_agent`
- For **explanation or simplification** of a topic → delegate to `explain_agent`

**Step 4 — Format and present the result.**

After each sub-agent returns its structured output, call the corresponding formatter:
  - `format_flashcards_markdown(flashcard_deck_json)` — pass the JSON string of the FlashcardDeck
  - `format_study_guide_markdown(study_guide_json)` — pass the JSON string of the StudyGuide
  - `format_quiz_markdown(quiz_json)` — pass the JSON string of the Quiz
  - `format_practice_test_markdown(test_json)` — pass the JSON string of the PracticeTest
  - `format_explanation_markdown(explanation_json)` — pass the JSON string of the TopicExplanation

Present the formatted Markdown to the user.

**Step 5 — Offer to export (optional).**

After presenting any study material or explanation, proactively offer:
  "Would you like to export this as a **PDF** or **Word document (.docx)**?"

If the user says yes (or asks to export at any point):
  1. Ask for a filename if they haven't provided one (suggest a sensible default like "photosynthesis_explanation" or "mitosis_study_guide").
  2. Ask for a save location, or use "default" (saves to ~/Documents/Study-Agent Documents).
  3. Call the appropriate export tool:
     - PDF  → `export_as_pdf(markdown_content, filename, output_dir)`
     - DOCX → `export_as_docx(markdown_content, filename, output_dir)`
  4. Tell the user the exact file path where the file was saved.

═══ IMPORTANT RULES ═══
- Always be encouraging and supportive — you are a study companion.
- If content from a file or URL is too short or unclear, ask the user for clarification.
- Never fabricate information for specific factual sources — only use what was provided.
- When generating from a topic only, draw on accurate, well-established knowledge.
- If the user asks to adjust difficulty, question count, or format, re-delegate with updated instructions.
- Export tools save to ~/Documents/Study-Agent Documents by default; always confirm the file path with the user after saving.
""",
    sub_agents=[
        flashcard_agent,
        study_guide_agent,
        quiz_agent,
        test_agent,
        explain_agent,
    ],
    tools=[
        read_file_content,
        load_web_page,
        format_flashcards_markdown,
        format_study_guide_markdown,
        format_quiz_markdown,
        format_practice_test_markdown,
        format_explanation_markdown,
        export_as_pdf,
        export_as_docx,
        db_mcp_toolset,
    ],
)

# ─── App ────────────────────────────────────────────────────────────────────
app = App(
    root_agent=root_agent,
    name="app",
)
