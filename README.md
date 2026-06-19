# 🐸 Froggy Pomodoro — Study, Relax & Hop

Welcome to **Froggy Pomodoro**, a cozy and aesthetic productivity web application designed to help you stay focused, manage tasks, and listen to relaxing music alongside Lily, your study-frog mascot.

---

## 🌟 Features

### ⏰ 1. Pond Pomodoro Timer
* **Fully Customizable:** Adjust your work duration, break duration, and total target number of sessions.
* **Cozy Status Tracker:** Keeps track of your active focus cycles and alerts you when it's time to take a break or start studying again.
* **Animated Progress Circular Ring:** Smoothly visualizes the remaining time.

### 📋 2. "Tasks to Hop On" (To-Do List)
* **Persistent Storage:** Connected to a full-stack Flask backend using a SQLite database to save your tasks across sessions.
* **Interactive Completion:** Checking off a task spawns blooming cherry blossoms, accompanied by a happy croak from Lily.

### 📻 3. Froggy Pond Radio (Spotify Integration)
* **Curated Stations:** Quick-switch between four pre-configured ambient playlists (Lofi Focus Beats, Peaceful Piano, Nature Rain Sounds, and Nintendo & Chill).
* **Load Custom Music:** Paste any Spotify track, album, or playlist link to load it dynamically into the built-in media widget.
* **Animated Interactions:** When music starts playing, Lily puts on headphones, bobs her head to the beat, and floating music notes drift across the screen!

### 🌧️ 4. Ambient Sound Engine (Web Audio API)
* Includes built-in custom client-side synthesizers.
* Toggle gentle rain (low-passed white noise), forest rustles (band-passed brown noise with LFO modulation), and organic frog croaking chimes.

---

## 🛠️ Tech Stack

* **Backend:** Python, Flask, SQLite
* **Frontend:** Vanilla HTML5 (Semantic), Vanilla CSS3 (Custom Glassmorphism, Animations), Vanilla JavaScript (ES6)
* **Audio:** Web Audio API (Synthesized noises and chimes)
* **Music Integration:** Spotify Web Player Embed API

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

---

## 📂 File Structure

* `app.py` — Flask server and SQLite REST API endpoints.
* `templates/index.html` — Main layout.
* `static/css/style.css` — Custom styles, animations, and responsive layout.
* `static/js/app.js` — Timer state machine, Spotify link parser, and audio synthesis engine.
* `static/images/study_frog.jpg` — Cute generated vector illustration of Lily the study frog.
* `requirements.txt` — Python libraries (Flask).
* `.gitignore` — Ignores local databases, caches, and configuration scripts.
