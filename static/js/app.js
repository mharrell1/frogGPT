// Audio Context for Web Audio API synthesis (Rain, Forest, Ribbit chime)
let audioCtx = null;
let rainNode = null;
let forestNode = null;
let ribbitTimer = null;

// Initial volume multipliers (0.0 to 1.0)
let rainVolume = 0.5;
let forestVolume = 0.5;
let pondVolume = 0.5;

// Audio synth functions
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Generate White Noise for Rain
function createRainNode() {
    initAudio();
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Filter to make it sound like gentle rain (lowpass filter around 800Hz-1200Hz)
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    const gain = audioCtx.createGain();
    gain.gain.value = rainVolume * 0.3; // Scaled rain volume

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    return { source: whiteNoise, gainNode: gain };
}

// Generate Pink/Brown Noise for Forest Wind/Rustles
function createForestNode() {
    initAudio();
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    
    // Brown noise filter approximation for deep wind rustle
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // Compensate loss
    }

    const brownNoise = audioCtx.createBufferSource();
    brownNoise.buffer = noiseBuffer;
    brownNoise.loop = true;

    // Lowpass filter modulating with LFO for rustling wind effect
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 1.0;

    // LFO to modulate bandpass filter frequency
    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = 0.15; // slow drift
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 150; // modulate by 150Hz

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const gain = audioCtx.createGain();
    gain.gain.value = forestVolume * 0.4; // Scaled forest volume

    brownNoise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    return { source: brownNoise, gainNode: gain, lfo: lfo };
}

// Synthesize a Ribbit Sound!
function playRibbit() {
    initAudio();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const now = audioCtx.currentTime;
    
    // Run two chirp sound waves close together to make the signature "rib-bit"
    chirp(now);
    chirp(now + 0.18);
}

function chirp(time) {
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc1.type = 'sawtooth';
    osc2.type = 'sine';
    
    // Base frequency sweep to sound organic/croaky
    osc1.frequency.setValueAtTime(140, time);
    osc1.frequency.exponentialRampToValueAtTime(320, time + 0.08);
    osc1.frequency.exponentialRampToValueAtTime(120, time + 0.12);
    
    osc2.frequency.setValueAtTime(280, time);
    osc2.frequency.exponentialRampToValueAtTime(640, time + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(240, time + 0.12);
    
    // Quick amplitude envelope
    gainNode.gain.setValueAtTime(0.001, time);
    gainNode.gain.linearRampToValueAtTime(0.12 * pondVolume, time + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc1.start(time);
    osc2.start(time);
    
    osc1.stop(time + 0.13);
    osc2.stop(time + 0.13);
}

// Toggle Ambient Atmosphere Sounds
function toggleAmbient(type) {
    initAudio();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    if (type === 'rain') {
        const btn = document.getElementById('ambient-rain');
        if (rainNode) {
            rainNode.source.stop();
            rainNode = null;
            btn.classList.remove('active');
        } else {
            rainNode = createRainNode();
            rainNode.source.start(0);
            btn.classList.add('active');
        }
    } else if (type === 'forest') {
        const btn = document.getElementById('ambient-forest');
        if (forestNode) {
            forestNode.source.stop();
            forestNode.lfo.stop();
            forestNode = null;
            btn.classList.remove('active');
        } else {
            forestNode = createForestNode();
            forestNode.source.start(0);
            btn.classList.add('active');
        }
    } else if (type === 'pond') {
        const btn = document.getElementById('ambient-pond');
        if (ribbitTimer) {
            clearInterval(ribbitTimer);
            ribbitTimer = null;
            btn.classList.remove('active');
        } else {
            btn.classList.add('active');
            playRibbit();
            // Ribbit randomly every 6 to 15 seconds
            const setNextRibbit = () => {
                const delay = (Math.random() * 9 + 6) * 1000;
                ribbitTimer = setTimeout(() => {
                    playRibbit();
                    setNextRibbit();
                }, delay);
            };
            setNextRibbit();
        }
    }
}

// Adjust ambient and sound effect volumes dynamically
function adjustVolume(type, value) {
    const val = parseFloat(value) / 100;
    if (type === 'rain') {
        rainVolume = val;
        if (rainNode) {
            rainNode.gainNode.gain.setValueAtTime(rainVolume * 0.3, audioCtx.currentTime);
        }
    } else if (type === 'forest') {
        forestVolume = val;
        if (forestNode) {
            forestNode.gainNode.gain.setValueAtTime(forestVolume * 0.4, audioCtx.currentTime);
        }
    } else if (type === 'pond') {
        pondVolume = val;
    }
}


/* --- Pomodoro Timer Logic --- */
let timerInterval = null;
let timeLeft = 0;
let workDuration = 25 * 60; // default 25 min in seconds
let breakDuration = 5 * 60;  // default 5 min in seconds
let totalSessions = 4;
let currentSession = 1;
let isTimerRunning = false;
let timerMode = 'work'; // 'work' or 'break'

const circle = document.querySelector('.progress-ring__circle');
const radius = circle.r.baseVal.value;
const circumference = radius * 2 * Math.PI;

circle.style.strokeDasharray = `${circumference} ${circumference}`;
circle.style.strokeDashoffset = circumference;

// Speech bubble responses for Lily the Frog
const LILY_SPEECH = {
    welcome: [
        "Welcome to the pond! Let's get cozy and make progress together, ribbit!",
        "Hoppy studying! Remember to take deep breaths and stretch your legs.",
        "Need a cozy vibe? Select a playlist from Froggy Pond Radio below!"
    ],
    workStart: [
        "Focus mode active! Time to work on your tasks, ribbit!",
        "Let's put our heads down and study. You've got this!",
        "Shh... Lily is studying with you. Let's make progress!"
    ],
    breakStart: [
        "Yay, break time! Go stretch, drink some water, or do a tiny hop!",
        "Time to rest your eyes and relax. Great job studying, ribbit!",
        "Break time! Let's watch the pond ripples together."
    ],
    timerComplete: [
        "Incredible! We finished all our study sessions today. Hoppy day!",
        "Ribbit! You did a amazing job! Give yourself a nice pat on the back.",
        "All sessions complete! You are officially a productivity champion!"
    ],
    taskAdded: [
        "New task added! Let's hop on it soon, ribbit!",
        "Another item on the list! One hop at a time.",
        "Got it! I've written that down on our lilypad."
    ],
    taskCompleted: [
        "Yay! You completed a task! Ribbit, ribbit!",
        "Beautiful! One task down, a cleaner pond ahead!",
        "Fantastic job checking that off! Feel the progress!"
    ]
};

function speak(category) {
    const list = LILY_SPEECH[category];
    const text = list[Math.floor(Math.random() * list.length)];
    document.getElementById('bubble-text').textContent = text;
}

function adjustCount(inputId, diff) {
    const input = document.getElementById(inputId);
    let val = parseInt(input.value) + diff;
    if (val >= parseInt(input.min) && val <= parseInt(input.max)) {
        input.value = val;
    }
}

function updateProgress(percent) {
    const offset = circumference - (percent / 100 * circumference);
    circle.style.strokeDashoffset = offset;
}

function updateTimerDisplay() {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    document.getElementById('timer-countdown').textContent = 
        `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    // Update progress circle
    const totalDuration = timerMode === 'work' ? workDuration : breakDuration;
    const progressPercent = ((totalDuration - timeLeft) / totalDuration) * 100;
    updateProgress(progressPercent);

    // Update document title for easy tracking in tabs
    document.title = `(${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}) Froggy Pomodoro`;
}

function initTimerValues() {
    const workMin = parseInt(document.getElementById('session-length').value) || 25;
    const breakMin = parseInt(document.getElementById('break-length').value) || 5;
    totalSessions = parseInt(document.getElementById('work-sessions-input').value) || 4;

    workDuration = workMin * 60;
    breakDuration = breakMin * 60;
}

function toggleTimer() {
    initAudio();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const btn = document.getElementById('btn-timer-toggle');

    if (isTimerRunning) {
        // Pause timer
        clearInterval(timerInterval);
        isTimerRunning = false;
        btn.querySelector('span').textContent = 'Resume';
        btn.querySelector('svg').innerHTML = '<path fill="currentColor" d="M8 5v14l11-7z"/>';
        document.getElementById('timer-state').textContent = 'PAUSED';
    } else {
        // Start/Resume timer
        if (timeLeft <= 0) {
            initTimerValues();
            timeLeft = timerMode === 'work' ? workDuration : breakDuration;
        }
        
        isTimerRunning = true;
        btn.querySelector('span').textContent = 'Pause';
        btn.querySelector('svg').innerHTML = '<path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        document.getElementById('timer-state').textContent = timerMode.toUpperCase();

        speak(timerMode === 'work' ? 'workStart' : 'breakStart');

        timerInterval = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                updateTimerDisplay();
            } else {
                handleTimerExpiry();
            }
        }, 1000);
    }
}

function handleTimerExpiry() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    playRibbit();

    if (timerMode === 'work') {
        // Finished a work session
        if (currentSession < totalSessions) {
            timerMode = 'break';
            timeLeft = breakDuration;
            document.getElementById('timer-state').textContent = 'BREAK';
            speak('breakStart');
            toggleTimer(); // auto start break
        } else {
            // Completed all sessions
            timerMode = 'work';
            timeLeft = 0;
            currentSession = 1;
            document.getElementById('timer-state').textContent = 'COMPLETED';
            document.getElementById('session-counter').textContent = `Done with ${totalSessions} sessions!`;
            speak('timerComplete');
            resetTimerButtons();
            return;
        }
    } else {
        // Finished a break session
        currentSession++;
        timerMode = 'work';
        timeLeft = workDuration;
        document.getElementById('timer-state').textContent = 'FOCUS';
        document.getElementById('session-counter').textContent = `Session ${currentSession} of ${totalSessions}`;
        speak('workStart');
        toggleTimer(); // auto start next work session
    }
}

function resetTimerButtons() {
    const btn = document.getElementById('btn-timer-toggle');
    btn.querySelector('span').textContent = 'Start';
    btn.querySelector('svg').innerHTML = '<path fill="currentColor" d="M8 5v14l11-7z"/>';
}

function resetTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    timerMode = 'work';
    currentSession = 1;
    
    initTimerValues();
    timeLeft = workDuration;
    
    document.getElementById('timer-state').textContent = 'FOCUS';
    document.getElementById('session-counter').textContent = `Session 1 of ${totalSessions}`;
    resetTimerButtons();
    updateTimerDisplay();
    document.title = "Froggy Pomodoro - Study, Relax & Hop";
}


/* --- Tasks (To-Do) Backend APIs --- */
async function fetchTasks() {
    try {
        const res = await fetch('/api/tasks');
        const tasks = await res.json();
        renderTasks(tasks);
    } catch (err) {
        console.error("Error loading tasks:", err);
    }
}

function renderTasks(tasks) {
    const list = document.getElementById('todo-list');
    list.innerHTML = '';
    
    let completedCount = 0;
    tasks.forEach(task => {
        if (task.completed) completedCount++;

        const li = document.createElement('li');
        li.className = `todo-item ${task.completed ? 'completed' : ''}`;
        li.innerHTML = `
            <div class="todo-item-left">
                <input type="checkbox" class="lily-checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask(${task.id}, this.checked)">
                <span class="todo-text">${escapeHTML(task.title)}</span>
            </div>
            <button class="btn-delete-task" onclick="deleteTask(${task.id})" aria-label="Delete task">
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12z"/></svg>
            </button>
        `;
        list.appendChild(li);
    });

    document.getElementById('task-stats').textContent = `${completedCount}/${tasks.length} completed`;
}

async function handleAddTask(event) {
    event.preventDefault();
    const input = document.getElementById('task-input');
    const title = input.value.trim();
    if (!title) return;

    try {
        const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title })
        });
        
        if (res.ok) {
            input.value = '';
            speak('taskAdded');
            fetchTasks();
        }
    } catch (err) {
        console.error("Error adding task:", err);
    }
}

async function toggleTask(id, completed) {
    try {
        const res = await fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: completed ? 1 : 0 })
        });
        
        if (res.ok) {
            if (completed) {
                playRibbit();
                speak('taskCompleted');
            }
            fetchTasks();
        }
    } catch (err) {
        console.error("Error updating task:", err);
    }
}

async function deleteTask(id) {
    try {
        const res = await fetch(`/api/tasks/${id}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            fetchTasks();
        }
    } catch (err) {
        console.error("Error deleting task:", err);
    }
}


/* --- Spotify Integration Player --- */
function playCurated(btn) {
    // Remove active class from other playlist buttons
    document.querySelectorAll('.playlist-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const uri = btn.getAttribute('data-spotify-uri');
    setSpotifyEmbed(uri);
}

function loadCustomSpotify() {
    const input = document.getElementById('spotify-link-input');
    let url = input.value.trim();
    if (!url) return;

    // Support links like: https://open.spotify.com/playlist/37i9dQZF1DX8U7rxhURT67
    try {
        const matches = url.match(/spotify\.com\/(playlist|track|album)\/([a-zA-Z0-9]+)/);
        if (matches && matches.length >= 3) {
            const type = matches[1];
            const id = matches[2];
            const embedUri = `embed/${type}/${id}`;
            setSpotifyEmbed(embedUri);
            
            // Remove active from predefined buttons since we loaded a custom one
            document.querySelectorAll('.playlist-btn').forEach(b => b.classList.remove('active'));
            input.value = '';
        } else {
            alert("Invalid Spotify link. Please paste a valid Spotify playlist, track, or album URL.");
        }
    } catch (err) {
        console.error("Error parsing Spotify URL:", err);
    }
}

function setSpotifyEmbed(uri) {
    const player = document.getElementById('spotify-player');
    player.src = `https://open.spotify.com/embed/${uri}?utm_source=generator&theme=0`;
    
    // Activate head bobbing animation and visual feedback on the frog mascot
    const mascotContainer = document.querySelector('.frog-headphone-container');
    mascotContainer.classList.add('music-playing');
    
    // Make vinyl/spotify logo spin
    document.querySelector('.spotify-logo').classList.add('active');
    
    document.getElementById('bubble-text').textContent = "Excellent selection! Cozy tunes active, let's keep working!";
}


/* --- Helpers & Initializations --- */
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Page Load Setup
window.addEventListener('DOMContentLoaded', () => {
    // Load initial greeting
    const welcomeTexts = LILY_SPEECH.welcome;
    document.getElementById('bubble-text').textContent = welcomeTexts[Math.floor(Math.random() * welcomeTexts.length)];
    
    // Fetch task list from backend
    fetchTasks();
    
    // Initialize standard timer inputs display
    initTimerValues();
    timeLeft = workDuration;
    updateTimerDisplay();
});
