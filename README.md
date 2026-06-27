# 🐸 Froggy Pomodoro — Study, Relax & Hop

Welcome to **Froggy Pomodoro**, a cozy and aesthetic productivity web application designed to help you stay focused, manage tasks, and listen to relaxing music alongside Lily, your study-frog mascot.

---

## 🌟 Features

### ⏰ 1. Pond Pomodoro Timer
* **Fully Customizable:** Adjust your work duration, break duration, and total target number of sessions.
* **Cozy Status Tracker:** Keeps track of your active focus cycles and alerts you when it's time to take a break or start studying again.
* **Animated Progress Circular Ring:** Smoothly visualizes the remaining time.

### 📋 2. "Tasks to Hop On" (To-Do List Updates!)
* **Due Dates:** Assign specific target dates to tasks to help plan your schedule.
* **Cozy Categorization:** Label tasks as **School** or **Work**, or click `+` to add custom categories. Custom categories are automatically color-coded with unique pastel badges.
* **Urgency Levels:** Label tasks as **Low** 🟢, **Medium** 🟡, or **High** 🔴 urgency to identify priority items at a glance.
* **Sorting & Filters:** Sort your list by due date (earliest/latest) or urgency (high/low first), and filter items by category.
* **Persistent Storage:** Syncs automatically with the Flask backend or uses Guest Mode local storage.
* **Interactive Completion:** Checking off a task spawns blooming cherry blossoms, accompanied by a happy croak from Lily.

### 📅 3. Lily's Monthly Calendar (Left Panel Drawer!)
* **Collapsible Slide-Out Panel:** Accessed via the 3-line hamburger menu (`☰`) or calendar icon (`📅`) in the left panel sidebar. Keeps the main dashboard focused and clean.
* **Month at a Glance:** View all tasks plotted on a month grid, complete with color-coded urgency flags.
* **Previous/Next Controls:** Seamlessly navigate between months using the left and right indicators.
* **Click-to-Filter:** Click any calendar day cell to instantly filter your task list to only show items due on that date. Click again to clear the filter.
* **Current Day Highlight:** Today's date is automatically highlighted with a cozy mint green border.
* **Direct Add Calendar Items:** Easily add new events or tasks directly inside the calendar quick-add form.
* **Click-Outside to Close:** Clicking the dark background overlay closes the drawer instantly for a distraction-free workflow.

### 🎮 4. Cozy Game Arcade (Froggy 2048)
* **Destress Mini-Games:** Accessed via the game controller icon (`🎮`) in the left panel sidebar.
* **Froggy 2048 Theme:** Play a cozy themed version of the classic 2048 game using custom pastel colors (greens, yellows, oranges, reds) matching the app design, culminating in a special **"2048 🐸"** tile.
* **Saves High Score:** Automatically saves your highest score locally (`bestScore2048` stored in `localStorage`).
* **Desktop & Mobile Controls:** Move tiles using standard keyboard arrow keys on desktop (scroll-prevention handles overlay focus) or the dedicated on-screen arrow keys on mobile.
* **Mascot Audio Integration:** Combines with Lily the mascot frog, playing a happy croaking sound whenever you reach the 2048 tile!

### 📻 5. Froggy Pond Radio (Spotify Integration)
* **Curated Stations:** Quick-switch between four pre-configured ambient playlists (Lofi Focus Beats, Peaceful Piano, Nature Rain Sounds, and Nintendo & Chill).
* **Load Custom Music:** Paste any Spotify track, album, or playlist link to load it dynamically into the built-in media widget.
* **Animated Interactions:** When music starts playing, Lily puts on headphones, bobs her head to the beat, and floating music notes drift across the screen!

### 🌧️ 6. Ambient Sound Engine (Web Audio API)
* Includes built-in custom client-side synthesizers.
* Toggle gentle rain (low-passed white noise), forest rustles (band-passed brown noise with LFO modulation), and organic frog croaking chimes.

### ☁️ 7. Account & Synchronization (SQLite & Cloud Sync)
* **Cross-Device Sync**: Sync your tasks and pomodoro settings across multiple devices using a simple username & password account.
* **Guest Mode Fallback**: If not logged in, the app operates in offline Guest Mode, securely storing your tasks in the browser's `localStorage`.
* **Zero-Config Sync**: Once logged in, your progress is automatically saved to and retrieved from the Flask backend server.

### 🤖 8. frogGPT AI Study Agent (Full-Screen Workspace!)
* **Personal Study Mascot:** Accessed via the robot/chat icon (`🤖`) in the left panel sidebar.
* **Full-Screen Workspace with Three-Way Toggle:** A full-viewport layout equipped with a header toggle to customize your workspace:
  * **💬 Chat Only:** Focuses exclusively on your conversation with Lily for instruction and query inputs (100% width).
  * **📚 Materials Only:** Expands the interactive study playground (flashcards, quizzes, tests, study guides) to full-screen width for distraction-free learning.
  * **🔀 Split Screen:** Displays both the chat window and interactive materials side-by-side.
* **Persistent Session History:**
  * If logged in, users can click **"📜 Session History"** to list, load, and resume past study conversations.
  * Users can click **"➕ New Chat"** to clear the conversation log and spin up a clean study session.
* **Interactive Study Playgrounds:**
  * **Interactive Flashcards:** View cards, click to flip with a 3D perspective transition, star cards (`☆`/`★`) to bookmark, and shuffle decks using a Fisher-Yates generator.
  * **Interactive Quizzes:** Answer multiple-choice questions with color-coded feedback and view final scores.
  * **Graded Practice Tests:** Complete True/False, Multiple-Choice, and Short Answer exams with sample answers and detailed score lists.
* **Multi-Format Document Imports:** Click the attachment icon (`📎`) to upload `.txt`, `.md`, `.docx`, or `.pdf` documents to generate personalized study decks.
* **Daily Quota Counter & Model Selector:**
  * Displays a daily free quota tracker (**20 queries/day limit**) that resets daily via browser `localStorage`.
  * Includes an **interactive countdown timer** showing exactly when your daily quota will replenish (ticking down until midnight local time, or automatically triggered when API rate limit/429 errors occur).
  * Multi-model switching between **Gemini 2.5 Flash** (default) and **Gemini 2.5 Pro** with intelligent error parsing for unsupported models.

---

## 🛠️ Tech Stack

* **Backend:** Python, Flask, SQLite, Gunicorn (production web server)
* **Frontend:** Vanilla HTML5, Vanilla CSS3 (Glassmorphism, custom layouts), Vanilla JavaScript (ES6)
* **Database & Cloud Storage:** Google Cloud Storage (GCS) mounted via Cloud Storage FUSE (for persistent tasks storage)
* **Deployment Platform:** Google Cloud Run (containerized server running 24/7)
* **Audio:** Web Audio API (Synthesized noises and chimes)
* **Music Integration:** Spotify Web Player Embed API
* **AI Orchestrations:** Google Agent Development Kit (ADK 2.0) multi-agent coordinator
* **Document Parsers:** `python-docx` (Word Documents) and `pypdf` (PDF files)

---

## 🚀 Setup & Installation

### Prerequisites
Make sure you have Python 3 installed on your system.

### Running the App Locally

1. **Clone or Navigate to the directory:**
   ```bash
   cd /Users/makaelaharrell/agy-cli-projects/froggy-pomodoro
   ```

2. **Install Dependencies:**
   ```bash
   python3 -m pip install -r requirements.txt
   ```

3. **Start the Flask Server:**
   ```bash
   python3 app.py
   ```

4. **Access the Web App:**
   Open your browser and navigate to **[http://127.0.0.1:5001](http://127.0.0.1:5001)**.

### ☁️ Cloud Deployment (Google Cloud Run)

The application is deployed to Google Cloud Run and operates 24/7. You can access it directly at:
**👉 [https://froggy-pomodoro-170395053839.us-central1.run.app](https://froggy-pomodoro-170395053839.us-central1.run.app)**

To deploy your own copy of the app:

1. **Prerequisites**: Make sure you have the Google Cloud SDK installed and authenticated.
2. **Enable APIs**: Enable Cloud Run, Cloud Build, and Cloud Storage APIs.
3. **Create GCS Bucket**: Create a GCS bucket to store your SQLite database.
4. **Deploy**:
   ```bash
   gcloud run deploy froggy-pomodoro \
     --source . \
     --region us-central1 \
     --execution-environment gen2 \
     --add-volume name=tasks-db-volume,type=cloud-storage,bucket=YOUR_GCS_BUCKET \
     --add-volume-mount volume=tasks-db-volume,mount-path=/data \
     --set-env-vars DB_PATH=/data/tasks.db \
     --allow-unauthenticated
   ```

---

## 📂 File Structure

* `app.py` — Flask server and SQLite REST API endpoints.
* `templates/index.html` — Main layout.
* `static/css/style.css` — Custom styles, animations, and responsive layout.
* `static/js/app.js` — Timer state machine, Spotify link parser, and audio synthesis engine.
* `static/images/study_frog.jpg` — Cute generated vector illustration of Lily the study frog.
* `requirements.txt` — Python libraries (Flask).
* `.gitignore` — Ignores local databases, caches, and configuration scripts.
* `study-agent/` — ADK 2.0 multi-agent implementation (coordinator, sub-agents, schemas, tests).
