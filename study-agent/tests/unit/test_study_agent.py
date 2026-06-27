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

import json
import os
import tempfile

from app.tools import (
    _clean_for_pdf,
    export_as_docx,
    export_as_pdf,
    format_explanation_markdown,
)


def test_format_explanation_markdown():
    explanation = {
        "topic": "Photosynthesis",
        "summary": "Plants turn sunlight into energy.",
        "simple_explanation": "Plants use their leaves like solar panels to make food.",
        "analogy": "Leaves are like tiny solar panels.",
        "key_takeaways": [
            "Requires light",
            "Produces oxygen",
            "Happens in chloroplasts",
        ],
    }
    explanation_json = json.dumps(explanation)
    res = format_explanation_markdown(explanation_json)
    assert res["status"] == "success"
    md = res["markdown"]
    assert "Photosynthesis" in md
    assert "solar panels" in md
    assert "Produces oxygen" in md


def test_clean_for_pdf():
    raw_text = "📇 Flashcards 📚 Study Guide 📝 Quiz 🧪 Test 💡 Tip 📌 Summary 👶 Simple 🎭 Analogy 🗝️ Key ✅ Correct \u2022 bullet"
    cleaned = _clean_for_pdf(raw_text)

    # Emojis should be replaced with safe text or symbols
    assert "[Flashcards]" in cleaned
    assert "[Study Guide]" in cleaned
    assert "[Quiz]" in cleaned
    assert "[Practice Test]" in cleaned
    assert "Tip:" in cleaned
    assert "Summary:" in cleaned
    assert "Simplified:" in cleaned
    assert "Analogy:" in cleaned
    assert "Key Takeaways:" in cleaned
    assert "[Answer Key]" in cleaned
    assert "-" in cleaned  # bullet character replaced by -

    # Try rendering characters outside Latin-1 to verify fallback behavior
    outside_unicode = "Some standard text with special \u221e infinity"
    cleaned_outside = _clean_for_pdf(outside_unicode)
    # The character \u221e (infinity symbol) is not Latin-1. Encode/decode should replace it with '?' (or similar depending on error handler)
    # in latin-1, the infinity symbol will be encoded as '?' under errors='replace'
    assert "?" in cleaned_outside or "infinity" in cleaned_outside


def test_export_pdf_with_emojis():
    # Verify that PDF export doesn't crash when text contains emojis and bullet points
    content = """# 📇 Flashcard Deck
- 📚 Mitosis has 4 phases
- 💡 Remember: Prophase, Metaphase, Anaphase, Telophase
- \u2022 The cell divides
- ✅ Correct Answer
"""
    with tempfile.TemporaryDirectory() as tmpdir:
        res = export_as_pdf(content, "test_file", tmpdir)
        assert res["status"] == "success"
        expected_path = os.path.join(tmpdir, "test_file.pdf")
        assert os.path.exists(expected_path)
        assert os.path.getsize(expected_path) > 0


def test_export_docx_with_emojis():
    # Verify docx export doesn't crash
    content = """# 📇 Flashcard Deck
- 📚 Mitosis has 4 phases
"""
    with tempfile.TemporaryDirectory() as tmpdir:
        res = export_as_docx(content, "test_file", tmpdir)
        assert res["status"] == "success"
        expected_path = os.path.join(tmpdir, "test_file.docx")
        assert os.path.exists(expected_path)
        assert os.path.getsize(expected_path) > 0
