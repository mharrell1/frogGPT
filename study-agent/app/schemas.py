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

"""Pydantic output schemas for each specialist study agent."""

from typing import Literal

from pydantic import BaseModel, Field

# ─────────────────────────────────────────────
# Flashcards
# ─────────────────────────────────────────────


class Flashcard(BaseModel):
    question: str = Field(
        description="The front of the flashcard — a question or prompt."
    )
    answer: str = Field(
        description="The back of the flashcard — the answer or explanation."
    )
    topic: str = Field(description="The sub-topic or concept this card belongs to.")


class FlashcardDeck(BaseModel):
    title: str = Field(description="Title of the flashcard deck.")
    description: str = Field(
        description="A one-sentence summary of what the deck covers."
    )
    cards: list[Flashcard] = Field(description="The list of flashcards in the deck.")


# ─────────────────────────────────────────────
# Study Guide
# ─────────────────────────────────────────────


class KeyConcept(BaseModel):
    term: str = Field(description="The concept or term name.")
    definition: str = Field(description="Clear, concise definition of the term.")
    example: str = Field(description="A concrete example to illustrate the concept.")


class StudySection(BaseModel):
    heading: str = Field(description="Section heading.")
    summary: str = Field(
        description="Narrative summary of this section in 2-4 sentences."
    )
    key_concepts: list[KeyConcept] = Field(
        description="Key terms and concepts in this section."
    )
    bullet_points: list[str] = Field(
        description="Additional important points as bullet items."
    )


class StudyGuide(BaseModel):
    title: str = Field(description="Title of the study guide.")
    overview: str = Field(description="A 2-3 sentence overview of the entire topic.")
    sections: list[StudySection] = Field(
        description="Organized sections of the study guide."
    )
    summary: str = Field(description="A brief overall summary and key takeaways.")


# ─────────────────────────────────────────────
# Practice Quiz (Multiple Choice)
# ─────────────────────────────────────────────


class QuizQuestion(BaseModel):
    question: str = Field(description="The quiz question.")
    options: list[str] = Field(
        description="List of 4 answer options, labeled A, B, C, D.",
        min_length=4,
        max_length=4,
    )
    correct_answer: Literal["A", "B", "C", "D"] = Field(
        description="The letter of the correct answer."
    )
    explanation: str = Field(
        description="A brief explanation of why the correct answer is right."
    )


class Quiz(BaseModel):
    title: str = Field(description="Title of the quiz.")
    topic: str = Field(description="The topic or subject being assessed.")
    difficulty: Literal["easy", "medium", "hard"] = Field(
        description="Overall difficulty level of the quiz."
    )
    questions: list[QuizQuestion] = Field(description="The list of quiz questions.")


# ─────────────────────────────────────────────
# Practice Test (Mixed Format)
# ─────────────────────────────────────────────


class MCQTestQuestion(BaseModel):
    type: Literal["multiple_choice"] = "multiple_choice"
    question: str = Field(description="The multiple-choice question.")
    options: list[str] = Field(
        description="List of 4 answer options labeled A, B, C, D.",
        min_length=4,
        max_length=4,
    )
    correct_answer: Literal["A", "B", "C", "D"] = Field(
        description="The correct option letter."
    )
    explanation: str = Field(description="Why this answer is correct.")
    points: int = Field(description="Point value of this question.", default=1)


class ShortAnswerTestQuestion(BaseModel):
    type: Literal["short_answer"] = "short_answer"
    question: str = Field(description="The short answer question.")
    sample_answer: str = Field(
        description="A model/ideal answer for grading reference."
    )
    key_points: list[str] = Field(
        description="Key points that a good answer should contain."
    )
    points: int = Field(description="Point value of this question.", default=3)


class TrueFalseTestQuestion(BaseModel):
    type: Literal["true_false"] = "true_false"
    statement: str = Field(description="A statement that is either true or false.")
    correct_answer: bool = Field(
        description="Whether the statement is True or False (true or false)."
    )
    explanation: str = Field(description="Why the statement is true or false.")
    points: int = Field(description="Point value of this question.", default=1)


class PracticeTest(BaseModel):
    title: str = Field(description="Title of the practice test.")
    topic: str = Field(description="The subject or topic being tested.")
    total_points: int = Field(description="Total points for the entire test.")
    time_limit_minutes: int = Field(
        description="Suggested time limit for the test in minutes."
    )
    multiple_choice: list[MCQTestQuestion] = Field(
        description="Multiple choice questions.", default_factory=list
    )
    short_answer: list[ShortAnswerTestQuestion] = Field(
        description="Short answer questions.", default_factory=list
    )
    true_false: list[TrueFalseTestQuestion] = Field(
        description="True/false questions.", default_factory=list
    )
    instructions: str = Field(
        description="Instructions for the student taking the test."
    )


# ─────────────────────────────────────────────
# Topic Explanation
# ─────────────────────────────────────────────


class TopicExplanation(BaseModel):
    topic: str = Field(description="The topic or concept being explained.")
    summary: str = Field(description="A brief, high-level summary of the concept.")
    simple_explanation: str = Field(
        description="A simplified, plain-English explanation of the topic (suitable for a beginner)."
    )
    analogy: str = Field(
        description="A helpful analogy or metaphor to make the concept intuitive."
    )
    key_takeaways: list[str] = Field(
        description="A list of 3-5 key points to remember about this topic."
    )
