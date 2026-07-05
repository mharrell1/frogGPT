// --- Purge custom API key storage completely ---
(function() {
    try {
        localStorage.removeItem('froggpt_custom_api_key');
    } catch(e) {}
})();

// --- Automatically inject X-Client-Date timezone header into all API requests ---
(function() {
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        const url = typeof input === 'string' ? input : (input.url || '');
        if (url.includes('/api/')) {
            init = init || {};
            init.headers = init.headers || {};
            if (init.headers instanceof Headers) {
                init.headers.set('X-Client-Date', new Date().toDateString());
            } else if (Array.isArray(init.headers)) {
                const hasHeader = init.headers.some(h => h[0].toLowerCase() === 'x-client-date');
                if (!hasHeader) {
                    init.headers.push(['X-Client-Date', new Date().toDateString()]);
                }
            } else {
                init.headers['X-Client-Date'] = new Date().toDateString();
            }
        }
        return originalFetch(input, init);
    };
})();

// --- Global Encryption & Security Wrapper for localStorage ---
(function() {
    const originalGetItem = localStorage.getItem;
    const originalSetItem = localStorage.setItem;
    
    // Derived rotating cipher key
    const secKey = 'froggy_secure_pomo_key_2026';
    
    function encrypt(text) {
        if (!text) return text;
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ secKey.charCodeAt(i % secKey.length));
        }
        return '__enc__' + btoa(unescape(encodeURIComponent(result)));
    }
    
    function decrypt(ciphertext) {
        if (!ciphertext || !ciphertext.startsWith('__enc__')) return ciphertext;
        try {
            const rawCipher = ciphertext.substring(7); // remove '__enc__' prefix
            const decoded = decodeURIComponent(escape(atob(rawCipher)));
            let result = '';
            for (let i = 0; i < decoded.length; i++) {
                result += String.fromCharCode(decoded.charCodeAt(i) ^ secKey.charCodeAt(i % secKey.length));
            }
            return result;
        } catch (e) {
            return ciphertext; // Safe fallback for unencrypted legacy content
        }
    }
    
    localStorage.setItem = function(name, value) {
        if (name.startsWith('saved_') || name.startsWith('froggpt_')) {
            originalSetItem.call(localStorage, name, encrypt(value));
        } else {
            originalSetItem.call(localStorage, name, value);
        }
    };
    
    localStorage.getItem = function(name) {
        const raw = originalGetItem.call(localStorage, name);
        if (raw && (name.startsWith('saved_') || name.startsWith('froggpt_'))) {
            if (raw.startsWith('__enc__')) {
                return decrypt(raw);
            }
            return raw; // Return plain text for legacy files
        }
        return raw;
    };
})();

// Audio Context for Web Audio API synthesis (Rain, Forest, Ribbit chime)
let audioCtx = null;
let rainNode = null;
let forestNode = null;
let ribbitTimer = null;

// Account / Sync state variables
let isLoggedIn = false;
let loggedInUser = null;

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
        "Need a cozy vibe? Select a playlist from FrogGPT Pond Radio below!"
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
    document.title = `(${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}) FrogGPT`;
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
        // Log the completed Pomodoro focus session
        logCompletedPomodoroSession();

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
    document.title = "FrogGPT - Study, Relax & Hop";
}


/* --- Tasks (To-Do) Backend APIs & Cloud Sync --- */
/* --- State Variables for Calendar, Category, and Urgency --- */
let allTasks = [];
let calendarDate = new Date(Date.UTC(2026, 5, 22)); // Initialized to mock current month: June 2026 in UTC
let selectedDateFilter = null; // YYYY-MM-DD
let customCategories = JSON.parse(localStorage.getItem('froggy_custom_categories') || '[]');

/* --- Tasks (To-Do) Backend APIs & Cloud Sync --- */
// Get tasks from localStorage
function getLocalTasks() {
    const data = localStorage.getItem('froggy_guest_tasks');
    return data ? JSON.parse(data) : [];
}

// Save tasks to localStorage
function saveLocalTasks(tasks) {
    localStorage.setItem('froggy_guest_tasks', JSON.stringify(tasks));
}

// Fetch tasks (either backend or localStorage)
async function fetchTasks() {
    if (isLoggedIn) {
        try {
            const response = await fetch('/api/tasks');
            if (response.ok) {
                const tasks = await response.json();
                allTasks = tasks;
                filterAndSortTasks();
            } else if (response.status === 401) {
                isLoggedIn = false;
                loggedInUser = null;
                updateAuthUI();
                fetchTasks();
            }
        } catch (err) {
            console.error("Error fetching backend tasks:", err);
        }
    } else {
        allTasks = getLocalTasks();
        filterAndSortTasks();
    }
}

// Filter and Sort Pipeline (Rich filter version from study pond)
function filterAndSortTasks() {
    const categoryFilter = document.getElementById('filter-category').value;
    const sortVal = document.getElementById('sort-tasks').value;
    const searchVal = (document.getElementById('task-search')?.value || '').trim().toLowerCase();
    const urgencyFilter = document.getElementById('filter-urgency')?.value || 'all';
    
    let filtered = [...allTasks];
    
    // 1. Filter by category
    if (categoryFilter !== 'all') {
        filtered = filtered.filter(t => (t.category || 'School') === categoryFilter);
    }
    
    // 2. Filter by calendar selected date
    if (selectedDateFilter) {
        filtered = filtered.filter(t => t.due_date === selectedDateFilter);
    }

    // 3. Filter by search
    if (searchVal) {
        filtered = filtered.filter(t => 
            t.title.toLowerCase().includes(searchVal) || 
            (t.notes && t.notes.toLowerCase().includes(searchVal))
        );
    }

    // 4. Filter by urgency
    if (urgencyFilter !== 'all') {
        filtered = filtered.filter(t => (t.urgency || 'medium') === urgencyFilter);
    }
    
    // 5. Sort tasks
    const urgencyWeight = { 'high': 3, 'medium': 2, 'low': 1 };
    filtered.sort((a, b) => {
        // Completed tasks are pushed to the bottom
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        
        if (sortVal === 'dueDateAsc') {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return a.due_date.localeCompare(b.due_date);
        } else if (sortVal === 'dueDateDesc') {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return b.due_date.localeCompare(a.due_date);
        } else if (sortVal === 'urgencyDesc') {
            const wA = urgencyWeight[a.urgency || 'medium'] || 2;
            const wB = urgencyWeight[b.urgency || 'medium'] || 2;
            return wB - wA;
        } else if (sortVal === 'urgencyAsc') {
            const wA = urgencyWeight[a.urgency || 'medium'] || 2;
            const wB = urgencyWeight[b.urgency || 'medium'] || 2;
            return wA - wB;
        } else {
            // Default: sort by ID descending
            return (b.id + '').localeCompare(a.id + '');
        }
    });
    
    renderTasks(filtered);
    renderCalendar();
    updateActiveFiltersIndicator();
}

function renderTasks(tasks) {
    const list = document.getElementById('todo-list');
    list.innerHTML = '';
    
    let completedCount = 0;
    tasks.forEach(task => {
        if (task.completed) completedCount++;

        const li = document.createElement('li');
        li.className = `todo-item ${task.completed ? 'completed' : ''}`;
        
        const catColor = getCategoryColor(task.category || 'School');
        const formattedDate = task.due_date ? formatReadableDate(task.due_date) : 'No due date';
        const todayStr = '2026-06-22';
        const isOverdue = !task.completed && task.due_date && task.due_date < todayStr;
        
        li.innerHTML = `
            <label class="checkbox-container">
                <input type="checkbox" id="check-${task.id}" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}', this.checked)">
                <span class="checkmark"></span>
            </label>
            
            <div class="task-content">
                <div class="task-title-row">
                    <span class="task-title">${escapeHTML(task.title)}</span>
                </div>
                
                <div class="badges-row">
                    <span class="badge badge-urgency ${task.urgency || 'medium'}">
                        ${task.urgency === 'high' ? '🔴' : task.urgency === 'low' ? '🟢' : '🟡'} ${capitalize(task.urgency || 'medium')}
                    </span>
                    <span class="badge badge-category" style="background: ${catColor}20; color: ${catColor}; border: 1px solid ${catColor}40">
                        🏷️ ${escapeHTML(task.category || 'School')}
                    </span>
                    <span class="task-due ${isOverdue ? 'overdue' : ''}" style="font-size: 0.75rem; color: var(--color-text-dim);">
                        📅 Due: ${formattedDate} ${isOverdue ? '(Overdue!)' : ''}
                    </span>
                </div>
                
                ${task.notes ? `<p class="task-notes" style="font-size: 0.8rem; color: var(--color-text-dim); margin-top: 4px; padding-left: 4px; border-left: 2px solid rgba(255,255,255,0.05);">${escapeHTML(task.notes)}</p>` : ''}
            </div>
            
            <div class="task-actions" style="display: flex; gap: 4px; align-self: flex-start; margin-left: auto;">
                <button class="btn btn-secondary btn-sm" onclick="editTask('${task.id}')" title="Edit Task" style="padding: 4px 6px; border-radius: 6px; background: none; border: none; color: var(--color-text-dim); cursor: pointer;">
                    <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </button>
                <button class="btn btn-secondary btn-sm" onclick="deleteTask('${task.id}')" title="Delete Task" style="padding: 4px 6px; border-radius: 6px; background: none; border: none; color: var(--color-text-dim); cursor: pointer;">
                    <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            </div>
        `;
        list.appendChild(li);
    });

    document.getElementById('task-stats').textContent = `${completedCount}/${tasks.length} completed`;
    
    // Update dashboard statistics at the top of the grid!
    updateTopDashboardStats(tasks, completedCount);
}

function updateTopDashboardStats(tasks, completedCount) {
    const activeCount = tasks.filter(t => !t.completed).length;
    const urgentCount = tasks.filter(t => !t.completed && t.urgency === 'high').length;
    const percent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
    
    const activeEl = document.getElementById('stats-active');
    const urgentEl = document.getElementById('stats-urgent');
    const completedEl = document.getElementById('stats-completed');
    const mascotMsgEl = document.getElementById('mascot-message');
    
    if (activeEl) activeEl.textContent = activeCount;
    if (urgentEl) urgentEl.textContent = urgentCount;
    if (completedEl) completedEl.textContent = `${percent}%`;
    
    if (mascotMsgEl) {
        const todayStr = '2026-06-22';
        const overdueCount = tasks.filter(t => !t.completed && t.due_date && t.due_date < todayStr).length;
        
        if (overdueCount > 0) {
            mascotMsgEl.textContent = `Ribbit! Watch out, you have ${overdueCount} overdue task${overdueCount > 1 ? 's' : ''} in the pond! Let's clear them up! 🌿`;
        } else if (urgentCount > 0) {
            mascotMsgEl.textContent = `Warning! You have ${urgentCount} high-urgency task${urgentCount > 1 ? 's' : ''} active! Hop to it, you can do it! 🔴`;
        } else if (tasks.length > 0 && activeCount === 0) {
            mascotMsgEl.textContent = "Hooray! Ribbit! All tasks completed! You've cleaned the pond! Lily is so proud of you! 🌟🍃";
        } else {
            const wisdomList = [
                "One hop at a time! Break down big tasks into little ribbits. 🐸",
                "Don't forget to take a deep breath. You're doing great! 🌿",
                "Stay hydrated! Have a sip of water, study partner! 💧",
                "A clean lily pad makes for a clear mind. Ribbit! 🍃",
                "Every hop counts, no matter how small. Keep going! ✨",
                "Is it time for a short break? Lily recommends stretching your legs! 🤸‍♂️",
                "Cozy vibes only. Let's study peacefully today! 🕯️"
            ];
            const randIndex = Math.floor(Math.random() * wisdomList.length);
            mascotMsgEl.textContent = wisdomList[randIndex];
        }
    }
}

function updateActiveFiltersIndicator() {
    const badgesContainer = document.getElementById('badge-container');
    const panelIndicator = document.getElementById('active-filters-badges');
    if (!badgesContainer || !panelIndicator) return;
    
    badgesContainer.innerHTML = '';
    let filterCount = 0;
    
    const searchVal = (document.getElementById('task-search')?.value || '').trim();
    if (searchVal) {
        createFilterBadge(badgesContainer, `Search: "${searchVal}"`, () => {
            document.getElementById('task-search').value = '';
            filterAndSortTasks();
        });
        filterCount++;
    }
    
    const categoryFilter = document.getElementById('filter-category').value;
    if (categoryFilter !== 'all') {
        createFilterBadge(badgesContainer, `Cat: ${categoryFilter}`, () => {
            document.getElementById('filter-category').value = 'all';
            filterAndSortTasks();
        });
        filterCount++;
    }
    
    const urgencyFilter = document.getElementById('filter-urgency')?.value || 'all';
    if (urgencyFilter !== 'all') {
        createFilterBadge(badgesContainer, `Urgency: ${capitalize(urgencyFilter)}`, () => {
            document.getElementById('filter-urgency').value = 'all';
            filterAndSortTasks();
        });
        filterCount++;
    }
    
    if (selectedDateFilter) {
        createFilterBadge(badgesContainer, `Date: ${formatReadableDate(selectedDateFilter)}`, () => {
            clearDateFilter();
        });
        filterCount++;
    }
    
    if (filterCount > 0) {
        panelIndicator.classList.remove('hidden');
    } else {
        panelIndicator.classList.add('hidden');
    }
}

function createFilterBadge(parent, text, onRemove) {
    const badge = document.createElement('div');
    badge.className = 'filter-badge';
    badge.style.display = 'flex';
    badge.style.alignItems = 'center';
    badge.style.gap = '4px';
    badge.style.padding = '2px 6px';
    badge.style.background = 'rgba(135, 195, 143, 0.15)';
    badge.style.border = '1px solid rgba(135, 195, 143, 0.3)';
    badge.style.borderRadius = '6px';
    badge.style.fontSize = '0.7rem';
    badge.style.color = 'var(--color-mint)';
    badge.textContent = text;
    
    const removeBtn = document.createElement('span');
    removeBtn.className = 'btn-remove-badge';
    removeBtn.innerHTML = '&times;';
    removeBtn.style.cursor = 'pointer';
    removeBtn.style.fontWeight = 'bold';
    removeBtn.addEventListener('click', onRemove);
    
    badge.appendChild(removeBtn);
    parent.appendChild(badge);
}

window.clearAllFilters = function() {
    if (document.getElementById('task-search')) document.getElementById('task-search').value = '';
    if (document.getElementById('filter-category')) document.getElementById('filter-category').value = 'all';
    if (document.getElementById('filter-urgency')) document.getElementById('filter-urgency').value = 'all';
    selectedDateFilter = null;
    filterAndSortTasks();
};

async function handleAddTask(event) {
    event.preventDefault();
    const input = document.getElementById('task-input');
    const title = input.value.trim();
    if (!title) return;

    const dueDate = document.getElementById('task-due-date').value || null;
    const urgency = document.getElementById('task-urgency').value || 'medium';
    const category = document.getElementById('task-category').value || 'School';

    if (isLoggedIn) {
        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title: title,
                    due_date: dueDate,
                    category: category,
                    urgency: urgency
                })
            });
            if (response.ok) {
                input.value = '';
                // reset fields back to defaults
                document.getElementById('task-due-date').value = '2026-06-22';
                document.getElementById('task-urgency').value = 'medium';
                speak('taskAdded');
                fetchTasks();
            } else {
                const errData = await response.json();
                alert("Error adding task: " + (errData.error || response.statusText));
            }
        } catch (err) {
            console.error("Error adding task to backend:", err);
        }
    } else {
        const tasks = getLocalTasks();
        const newTask = {
            id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title: title,
            completed: false,
            created_at: new Date().toISOString(),
            due_date: dueDate,
            category: category,
            urgency: urgency
        };
        tasks.unshift(newTask);
        saveLocalTasks(tasks);
        input.value = '';
        document.getElementById('task-due-date').value = '2026-06-22';
        document.getElementById('task-urgency').value = 'medium';
        speak('taskAdded');
        fetchTasks();
    }
}

async function toggleTask(id, completed) {
    if (isLoggedIn) {
        try {
            const response = await fetch(`/api/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: completed })
            });
            if (response.ok) {
                if (completed) {
                    playRibbit();
                    speak('taskCompleted');
                }
                fetchTasks();
            }
        } catch (err) {
            console.error("Error updating task on backend:", err);
        }
    } else {
        const tasks = getLocalTasks();
        const task = tasks.find(t => (t.id + '') === (id + ''));
        if (task) {
            task.completed = completed;
            if (completed) {
                const now = new Date();
                const pad = (n) => n.toString().padStart(2, '0');
                task.completed_at = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
            } else {
                task.completed_at = null;
            }
            saveLocalTasks(tasks);
            if (completed) {
                playRibbit();
                speak('taskCompleted');
            }
            fetchTasks();
        }
    }
}

async function deleteTask(id) {
    if (confirm("Delete this task from the lily pad, ribbit?")) {
        if (isLoggedIn) {
            try {
                const response = await fetch(`/api/tasks/${id}`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    fetchTasks();
                }
            } catch (err) {
                console.error("Error deleting task on backend:", err);
            }
        } else {
            let tasks = getLocalTasks();
            tasks = tasks.filter(t => (t.id + '') !== (id + ''));
            saveLocalTasks(tasks);
            fetchTasks();
        }
    }
}

window.toggleTask = toggleTask;
window.deleteTask = deleteTask;


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

    try {
        // Handle spotify:type:id URI
        if (url.startsWith('spotify:')) {
            const parts = url.split(':');
            if (parts.length >= 3) {
                const type = parts[1];
                const id = parts[2];
                if (['playlist', 'track', 'album'].includes(type)) {
                    setSpotifyEmbed(`embed/${type}/${id}`);
                    document.querySelectorAll('.playlist-btn').forEach(b => b.classList.remove('active'));
                    input.value = '';
                    return;
                }
            }
        }

        // Support open.spotify.com links (with optional embed path and search params)
        const matches = url.match(/spotify\.com\/(?:embed\/)?(playlist|track|album)\/([a-zA-Z0-9]+)/);
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
    // Ensure we don't duplicate 'embed/' by cleaning the uri first
    const cleanUri = uri.replace(/^embed\//, '');
    player.src = `https://open.spotify.com/embed/${cleanUri}?utm_source=generator&theme=0`;
    
    // Activate head bobbing animation and visual feedback on the frog mascot
    const mascotContainer = document.querySelector('.frog-headphone-container');
    if (mascotContainer) mascotContainer.classList.add('music-playing');
    
    // Make vinyl/spotify logo spin
    const spotifyLogo = document.querySelector('.spotify-logo');
    if (spotifyLogo) spotifyLogo.classList.add('active');
    
    document.getElementById('bubble-text').textContent = "Excellent selection! Cozy tunes active, let's keep working!";
}


/* --- Helpers & Initializations --- */
function escapeHTML(str) {
    if (!str) return '';
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
    const bubbleText = document.getElementById('bubble-text');
    if (bubbleText && welcomeTexts) {
        bubbleText.textContent = welcomeTexts[Math.floor(Math.random() * welcomeTexts.length)];
    }
    
    // Initialize standard timer inputs display
    initTimerValues();
    timeLeft = workDuration;
    updateTimerDisplay();

    // Set mock date on due date field: 2026-06-22
    const taskDueDate = document.getElementById('task-due-date') || document.getElementById('task-due-date-modal');
    if (taskDueDate) {
        taskDueDate.value = '2026-06-22';
    }
    
    // Populate categories select lists
    populateCategoryDropdowns();

    // Check user login status on load
    checkUserStatus();

    // Initial render calendar
    renderCalendar();

    // Sync the quota indicators immediately on page load
    syncQuotaWithServer();
});

/* --- Category Management Helpers --- */
function populateCategoryDropdowns() {
    const taskCatSelect = document.getElementById('task-category');
    const filterCatSelect = document.getElementById('filter-category');
    const calCatSelect = document.getElementById('cal-item-category');
    const modalCatSelect = document.getElementById('task-category-modal');
    const timerCatSelect = document.getElementById('timer-category-select');
    
    const taskSelected = taskCatSelect ? taskCatSelect.value : '';
    const filterSelected = filterCatSelect ? filterCatSelect.value : '';
    const calSelected = calCatSelect ? calCatSelect.value : '';
    const modalSelected = modalCatSelect ? modalCatSelect.value : '';
    const timerSelected = timerCatSelect ? timerCatSelect.value : '';
    
    const categories = ['School', 'Work', ...customCategories];
    
    if (taskCatSelect) {
        taskCatSelect.innerHTML = '';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            taskCatSelect.appendChild(opt);
        });
        if (categories.includes(taskSelected)) {
            taskCatSelect.value = taskSelected;
        }
    }
    
    if (modalCatSelect) {
        modalCatSelect.innerHTML = '';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            modalCatSelect.appendChild(opt);
        });
        const addNewOpt = document.createElement('option');
        addNewOpt.value = '__add_new__';
        addNewOpt.textContent = '+ Add Custom Category...';
        addNewOpt.className = 'option-add-new';
        modalCatSelect.appendChild(addNewOpt);
        if (categories.includes(modalSelected)) {
            modalCatSelect.value = modalSelected;
        }
    }
    
    if (filterCatSelect) {
        filterCatSelect.innerHTML = '<option value="all">All Categories</option>';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            filterCatSelect.appendChild(opt);
        });
        if (categories.includes(filterSelected) || filterSelected === 'all') {
            filterCatSelect.value = filterSelected;
        }
    }
    
    if (calCatSelect) {
        calCatSelect.innerHTML = '';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            calCatSelect.appendChild(opt);
        });
        const addNewOpt = document.createElement('option');
        addNewOpt.value = '__add_new__';
        addNewOpt.textContent = '+ Add Custom Category...';
        addNewOpt.className = 'option-add-new';
        calCatSelect.appendChild(addNewOpt);
        if (categories.includes(calSelected)) {
            calCatSelect.value = calSelected;
        }
    }

    if (timerCatSelect) {
        timerCatSelect.innerHTML = '';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            timerCatSelect.appendChild(opt);
        });
        const addNewOpt = document.createElement('option');
        addNewOpt.value = '__add_new__';
        addNewOpt.textContent = '+ Add Custom Category...';
        addNewOpt.className = 'option-add-new';
        timerCatSelect.appendChild(addNewOpt);
        if (categories.includes(timerSelected)) {
            timerCatSelect.value = timerSelected;
        } else if (categories.length > 0) {
            timerCatSelect.value = categories[0];
        }
    }
}

function promptAddCategory() {
    const newCatName = prompt("Enter new category name, ribbit:");
    if (newCatName) {
        const trimmed = newCatName.trim();
        if (trimmed) {
            const exists = ['school', 'work', ...customCategories.map(c => c.toLowerCase())].includes(trimmed.toLowerCase());
            if (exists) {
                alert("This category already exists, ribbit!");
                return;
            }
            customCategories.push(trimmed);
            localStorage.setItem('froggy_custom_categories', JSON.stringify(customCategories));
            populateCategoryDropdowns();
            document.getElementById('task-category').value = trimmed;
        }
    }
}

function getCategoryColor(categoryName) {
    const defaults = {
        'School': '#87c38f', // Sage Green
        'Work': '#f29e4c',   // Warm Orange
    };
    if (defaults[categoryName]) return defaults[categoryName];
    
    // Hash-based pastel color generator
    let hash = 0;
    for (let i = 0; i < categoryName.length; i++) {
        hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        '#e76f51', // Terracotta
        '#2a9d8f', // Teal
        '#b58db6', // Lavender
        '#457b9d', // Slate blue
        '#b5a48c', // Cozy warm brown
        '#a8dadc'  // Light blue
    ];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
}

function formatReadableDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    const date = new Date(Date.UTC(year, month, day));
    const options = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
    return date.toLocaleDateString('en-US', options);
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/* --- Monthly Calendar Functions --- */
function renderCalendar() {
    const grid = document.getElementById('calendar-days-grid');
    const monthYearLabel = document.getElementById('calendar-month-year');
    if (!grid || !monthYearLabel) return;
    
    grid.innerHTML = '';
    
    const year = calendarDate.getUTCFullYear();
    const month = calendarDate.getUTCMonth();
    
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    monthYearLabel.textContent = `${monthNames[month]} ${year}`;
    
    const firstDayIndex = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    
    // Weekday Padding
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day-cell empty';
        grid.appendChild(emptyCell);
    }
    
    const mockTodayStr = '2026-06-22';
    
    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell';
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (dateStr === mockTodayStr) {
            cell.classList.add('today');
        }
        if (dateStr === selectedDateFilter) {
            cell.classList.add('selected');
        }
        
        // Day Num
        const numSpan = document.createElement('span');
        numSpan.className = 'day-num';
        numSpan.textContent = day;
        cell.appendChild(numSpan);
        
        // Day tasks indicators
        const dayTasks = allTasks.filter(t => t.due_date === dateStr);
        if (dayTasks.length > 0) {
            const tasksContainer = document.createElement('div');
            tasksContainer.className = 'day-tasks';
            
            const visible = dayTasks.slice(0, 2);
            visible.forEach(task => {
                const ind = document.createElement('div');
                ind.className = `mini-task-indicator urgency-${task.urgency || 'medium'} ${task.completed ? 'completed' : ''}`;
                ind.textContent = task.title;
                ind.title = task.title;
                tasksContainer.appendChild(ind);
            });
            
            if (dayTasks.length > 2) {
                const more = document.createElement('div');
                more.className = 'mini-task-indicator-more';
                more.style.fontSize = '0.68rem';
                more.style.color = 'var(--color-sage)';
                more.style.marginTop = '2px';
                more.textContent = `+${dayTasks.length - 2} more`;
                tasksContainer.appendChild(more);
            }
            
            cell.appendChild(tasksContainer);
        }
        
        cell.addEventListener('click', () => {
            selectCalendarDate(dateStr);
        });
        
        grid.appendChild(cell);
    }

    // Trailing Padding to make it exactly 42 cells (6 rows of 7 days)
    const totalRenderedCells = firstDayIndex + totalDays;
    const trailingPadding = 42 - totalRenderedCells;
    for (let i = 0; i < trailingPadding; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day-cell empty';
        grid.appendChild(emptyCell);
    }
    
    // Sync the quick-add date picker default value with current calendar view
    const calDateInput = document.getElementById('cal-item-date');
    if (calDateInput) {
        if (selectedDateFilter) {
            const parts = selectedDateFilter.split('-');
            const selYear = parseInt(parts[0], 10);
            const selMonth = parseInt(parts[1], 10) - 1;
            if (selYear !== year || selMonth !== month) {
                calDateInput.value = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            } else {
                calDateInput.value = selectedDateFilter;
            }
        } else {
            calDateInput.value = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        }
    }
    
    // Update the selected day events list in the calendar modal sidebar
    renderCalendarDayEvents(selectedDateFilter || '2026-06-22');
}

function renderCalendarDayEvents(dateStr) {
    const listContainer = document.getElementById('calendar-day-events-list');
    const headerTitle = document.getElementById('calendar-day-events-title');
    if (!listContainer) return;
    
    if (!dateStr) {
        if (headerTitle) headerTitle.textContent = '📅 Events (No Date Selected)';
        listContainer.innerHTML = '<div style="text-align: center; color: var(--color-text-dim); font-size: 0.85rem; padding: 12px 0;">Select a date to view events, ribbit!</div>';
        return;
    }
    
    if (headerTitle) {
        headerTitle.textContent = `📅 Events for ${formatReadableDate(dateStr)}`;
    }
    
    const dayTasks = allTasks.filter(t => t.due_date === dateStr);
    
    if (dayTasks.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; color: var(--color-text-dim); font-size: 0.85rem; padding: 12px 0;">No events scheduled for this day, ribbit!</div>';
        return;
    }
    
    listContainer.innerHTML = '';
    dayTasks.forEach(task => {
        const taskEl = document.createElement('div');
        taskEl.style.display = 'flex';
        taskEl.style.alignItems = 'center';
        taskEl.style.justifyContent = 'space-between';
        taskEl.style.padding = '8px 12px';
        taskEl.style.background = 'rgba(255, 255, 255, 0.04)';
        taskEl.style.borderRadius = '10px';
        taskEl.style.border = '1px solid rgba(255, 255, 255, 0.02)';
        taskEl.style.gap = '8px';
        
        taskEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                <span style="font-size: 1.1rem; cursor: pointer; user-select: none;" onclick="toggleCalendarTaskComplete('${task.id}', ${!task.completed})">
                    ${task.completed ? '🌸' : '⚪'}
                </span>
                <span style="color: ${task.completed ? 'var(--color-text-dim)' : 'var(--color-cream)'}; text-decoration: ${task.completed ? 'line-through' : 'none'}; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                    ${escapeHTML(task.title)}
                </span>
            </div>
            <span class="badge" style="font-size: 0.65rem; padding: 2px 6px; background: ${getCategoryColor(task.category || 'School')}33; color: ${getCategoryColor(task.category || 'School')}; border: 1px solid ${getCategoryColor(task.category || 'School')}66;">
                ${escapeHTML(task.category || 'School')}
            </span>
        `;
        listContainer.appendChild(taskEl);
    });
}

window.toggleCalendarTaskComplete = async function(id, completed) {
    // Optimistic local update for zero latency
    const task = allTasks.find(t => (t.id + '') === (id + ''));
    if (task) {
        task.completed = completed;
    }
    await toggleTask(id, completed);
    if (selectedDateFilter) {
        renderCalendarDayEvents(selectedDateFilter);
    } else {
        renderCalendarDayEvents('2026-06-22');
    }
};

function selectCalendarDate(dateStr) {
    const clearBtn = document.getElementById('btn-clear-date-filter');
    if (selectedDateFilter === dateStr) {
        selectedDateFilter = null;
        if (clearBtn) clearBtn.classList.add('hidden');
    } else {
        selectedDateFilter = dateStr;
        if (clearBtn) {
            clearBtn.classList.remove('hidden');
            clearBtn.textContent = `Clear Filter (${formatReadableDate(dateStr)})`;
        }
    }
    const calDateInput = document.getElementById('cal-item-date');
    if (calDateInput) {
        calDateInput.value = dateStr;
    }
    filterAndSortTasks();
    renderCalendar(); // Highlight selection instantly
}

function clearDateFilter() {
    selectedDateFilter = null;
    const clearBtn = document.getElementById('btn-clear-date-filter');
    if (clearBtn) clearBtn.classList.add('hidden');
    filterAndSortTasks();
    renderCalendar(); // Remove highlighting instantly
}

function changeMonth(dir) {
    calendarDate.setUTCMonth(calendarDate.getUTCMonth() + dir);
    renderCalendar();
}

function openCalendarModal() {
    closeGamesModal(); // Close games drawer if open
    const modal = document.getElementById('calendar-modal');
    if (modal) {
        modal.classList.add('open');
        document.getElementById('cal-item-date').value = selectedDateFilter || '2026-06-22';
        populateCategoryDropdowns();
        renderCalendar();
    }
    const sidebarCalBtn = document.getElementById('btn-sidebar-calendar');
    if (sidebarCalBtn) sidebarCalBtn.classList.add('active');
}

function closeCalendarModal() {
    const modal = document.getElementById('calendar-modal');
    if (modal) {
        modal.classList.remove('open');
    }
    const sidebarCalBtn = document.getElementById('btn-sidebar-calendar');
    if (sidebarCalBtn) sidebarCalBtn.classList.remove('active');
}

async function handleCalendarAdd(event) {
    event.preventDefault();
    const titleInput = document.getElementById('cal-item-title');
    const dateInput = document.getElementById('cal-item-date');
    const urgencyInput = document.getElementById('cal-item-urgency');
    const categoryInput = document.getElementById('cal-item-category');
    
    let category = categoryInput.value;
    const title = titleInput.value.trim();
    const dueDate = dateInput.value;
    const urgency = urgencyInput.value;
    
    // Auto-save inline category in calendar form
    if (category === '__add_new__') {
        const customInput = document.getElementById('cal-custom-category-name');
        const customVal = customInput ? customInput.value.trim() : '';
        if (customVal) {
            const exists = ['school', 'work', ...customCategories.map(c => c.toLowerCase())].includes(customVal.toLowerCase());
            if (!exists) {
                customCategories.push(customVal);
                localStorage.setItem('froggy_custom_categories', JSON.stringify(customCategories));
                populateCategoryDropdowns();
            }
            category = customVal;
            if (customInput) customInput.value = '';
            const customGroup = document.getElementById('cal-custom-category-group');
            if (customGroup) customGroup.classList.add('hidden');
        } else {
            alert('Please specify a category name, or choose School or Work!');
            return;
        }
    }
    
    if (!title || !dueDate) return;
    
    if (isLoggedIn) {
        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title: title,
                    due_date: dueDate,
                    category: category,
                    urgency: urgency
                })
            });
            if (response.ok) {
                titleInput.value = '';
                dateInput.value = selectedDateFilter || '2026-06-22';
                speak('taskAdded');
                fetchTasks();
            } else {
                const errData = await response.json();
                alert("Error adding calendar item: " + (errData.error || response.statusText));
            }
        } catch (err) {
            console.error("Error adding calendar item:", err);
        }
    } else {
        const tasks = getLocalTasks();
        const newTask = {
            id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title: title,
            completed: false,
            created_at: new Date().toISOString(),
            due_date: dueDate,
            category: category,
            urgency: urgency
        };
        tasks.unshift(newTask);
        saveLocalTasks(tasks);
        titleInput.value = '';
        dateInput.value = selectedDateFilter || '2026-06-22';
        speak('taskAdded');
        fetchTasks();
    }
}

window.openCalendarModal = openCalendarModal;
window.closeCalendarModal = closeCalendarModal;
window.handleCalendarAdd = handleCalendarAdd;


/* --- SQLite Backend Auth Helpers --- */
async function checkUserStatus() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const data = await response.json();
            if (data.logged_in) {
                isLoggedIn = true;
                loggedInUser = data.username;
            } else {
                isLoggedIn = false;
                loggedInUser = null;
            }
            updateAuthUI();
            fetchTasks();
        }
    } catch (err) {
        console.error("Error checking user status:", err);
        isLoggedIn = false;
        loggedInUser = null;
        updateAuthUI();
        fetchTasks();
    }
}

function updateAuthUI() {
    const btnSync = document.getElementById('btn-cloud-sync');
    const syncStatusText = document.getElementById('sync-status-text');
    const authLoggedOut = document.getElementById('auth-logged-out');
    const authLoggedIn = document.getElementById('auth-logged-in');
    const loggedInUsername = document.getElementById('logged-in-username');
    const btnHistory = document.getElementById('btn-froggpt-history');

    if (isLoggedIn && loggedInUser) {
        if (btnSync) btnSync.classList.add('active');
        if (syncStatusText) syncStatusText.textContent = 'Sync Active';
        if (authLoggedOut) authLoggedOut.style.display = 'none';
        if (authLoggedIn) authLoggedIn.style.display = 'block';
        if (loggedInUsername) loggedInUsername.textContent = loggedInUser;
        if (btnHistory) {
            btnHistory.style.display = 'inline-block';
            btnHistory.innerText = '📜 Session History';
            btnHistory.style.opacity = '1.0';
        }
    } else {
        if (btnSync) btnSync.classList.remove('active');
        if (syncStatusText) syncStatusText.textContent = 'Sign In';
        if (authLoggedOut) authLoggedOut.style.display = 'block';
        if (authLoggedIn) authLoggedIn.style.display = 'none';
        if (btnHistory) {
            btnHistory.style.display = 'inline-block';
            btnHistory.innerText = '🔒 Session History';
            btnHistory.style.opacity = '0.6';
        }
    }
}

async function handleBackendLogin() {
    const usernameInput = document.getElementById('auth-username');
    const passwordInput = document.getElementById('auth-password');
    
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
        alert("Please enter both username and password.");
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        });
        
        if (response.ok) {
            const data = await response.json();
            isLoggedIn = true;
            loggedInUser = data.username;
            if (usernameInput) usernameInput.value = '';
            if (passwordInput) passwordInput.value = '';
            updateAuthUI();
            fetchTasks();
            closeSyncModal();
        } else {
            const errData = await response.json();
            alert("Login failed: " + (errData.error || response.statusText));
        }
    } catch (err) {
        console.error("Login error:", err);
        alert("Error connecting to server. Please try again.");
    }
}

async function handleBackendSignup() {
    const usernameInput = document.getElementById('auth-username');
    const passwordInput = document.getElementById('auth-password');
    
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
        alert("Please enter both username and password.");
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters.");
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        });
        
        if (response.ok) {
            const data = await response.json();
            isLoggedIn = true;
            loggedInUser = data.username;
            if (usernameInput) usernameInput.value = '';
            if (passwordInput) passwordInput.value = '';
            updateAuthUI();
            fetchTasks();
            closeSyncModal();
        } else {
            const errData = await response.json();
            alert("Registration failed: " + (errData.error || response.statusText));
        }
    } catch (err) {
        console.error("Registration error:", err);
        alert("Error connecting to server. Please try again.");
    }
}

async function handleBackendLogout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST'
        });
        if (response.ok) {
            isLoggedIn = false;
            loggedInUser = null;
            updateAuthUI();
            fetchTasks();
            closeSyncModal();
        }
    } catch (err) {
        console.error("Logout error:", err);
    }
}

/* --- Modal Controls --- */
function openSyncModal() {
    document.getElementById('sync-modal').classList.add('open');
}

function closeSyncModal() {
    document.getElementById('sync-modal').classList.remove('open');
}

/* --- Games Modal & 2048 Game Engine --- */
let isGamesModalOpen = false;
let board2048 = [];
let score2048 = 0;
let bestScore2048 = parseInt(localStorage.getItem('froggy_2048_best') || '0', 10);
let hasWon2048 = false;
let isGameOver2048 = false;

function openGamesModal() {
    closeCalendarModal(); // Close calendar drawer if open
    const modal = document.getElementById('games-modal');
    if (modal) {
        modal.classList.add('open');
        isGamesModalOpen = true;
        
        const sidebarGamesBtn = document.getElementById('btn-sidebar-games');
        if (sidebarGamesBtn) sidebarGamesBtn.classList.add('active');
        
        // Initialize game on first open or if empty
        if (board2048.length === 0) {
            init2048();
        }
    }
}

function closeGamesModal() {
    const modal = document.getElementById('games-modal');
    if (modal) {
        modal.classList.remove('open');
    }
    isGamesModalOpen = false;
    const sidebarGamesBtn = document.getElementById('btn-sidebar-games');
    if (sidebarGamesBtn) sidebarGamesBtn.classList.remove('active');
    
    if (typeof exitGame === 'function') {
        exitGame();
    }
}

function init2048() {
    board2048 = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ];
    score2048 = 0;
    hasWon2048 = false;
    isGameOver2048 = false;
    
    // Hide status overlay
    const msgOverlay = document.getElementById('game-message-2048');
    if (msgOverlay) {
        msgOverlay.className = 'game-message-2048';
    }
    
    spawnTile2048();
    spawnTile2048();
    draw2048();
}

function restart2048() {
    init2048();
}

function spawnTile2048() {
    let emptyCells = [];
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (board2048[r][c] === 0) {
                emptyCells.push({r: r, c: c});
            }
        }
    }
    if (emptyCells.length > 0) {
        let randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        board2048[randomCell.r][randomCell.c] = Math.random() < 0.9 ? 2 : 4;
    }
}

function draw2048() {
    const tileContainer = document.getElementById('tile-container-2048');
    if (!tileContainer) return;
    
    tileContainer.innerHTML = '';
    
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            const val = board2048[r][c];
            if (val > 0) {
                const tileElem = document.createElement('div');
                tileElem.className = `tile-2048-elem tile-pos-${r}-${c} tile-val-${val}`;
                
                const innerElem = document.createElement('div');
                innerElem.className = 'tile-inner-2048';
                innerElem.textContent = val === 2048 ? '2048 🐸' : val;
                
                tileElem.appendChild(innerElem);
                tileContainer.appendChild(tileElem);
            }
        }
    }
    
    // Update scores
    document.getElementById('score-2048').textContent = score2048;
    if (score2048 > bestScore2048) {
        bestScore2048 = score2048;
        localStorage.setItem('froggy_2048_best', bestScore2048);
    }
    document.getElementById('best-2048').textContent = bestScore2048;
}

// 2048 line slide function
function slideLineLeft(line) {
    let filtered = line.filter(x => x !== 0);
    for (let i = 0; i < filtered.length - 1; i++) {
        if (filtered[i] === filtered[i+1]) {
            filtered[i] *= 2;
            score2048 += filtered[i];
            filtered[i+1] = 0;
            if (filtered[i] === 2048 && !hasWon2048) {
                hasWon2048 = true;
                handle2048Win();
            }
        }
    }
    filtered = filtered.filter(x => x !== 0);
    while (filtered.length < 4) {
        filtered.push(0);
    }
    return filtered;
}

function move2048(direction) {
    if (isGameOver2048) return;
    
    let originalBoard = JSON.stringify(board2048);
    
    if (direction === 'left') {
        for (let r = 0; r < 4; r++) {
            board2048[r] = slideLineLeft(board2048[r]);
        }
    } else if (direction === 'right') {
        for (let r = 0; r < 4; r++) {
            let reversed = [...board2048[r]].reverse();
            let slid = slideLineLeft(reversed);
            board2048[r] = slid.reverse();
        }
    } else if (direction === 'up') {
        for (let c = 0; c < 4; c++) {
            let column = [board2048[0][c], board2048[1][c], board2048[2][c], board2048[3][c]];
            let slid = slideLineLeft(column);
            for (let r = 0; r < 4; r++) {
                board2048[r][c] = slid[r];
            }
        }
    } else if (direction === 'down') {
        for (let c = 0; c < 4; c++) {
            let column = [board2048[0][c], board2048[1][c], board2048[2][c], board2048[3][c]].reverse();
            let slid = slideLineLeft(column);
            slid.reverse();
            for (let r = 0; r < 4; r++) {
                board2048[r][c] = slid[r];
            }
        }
    }
    
    // Check if board state changed
    if (originalBoard !== JSON.stringify(board2048)) {
        spawnTile2048();
        draw2048();
        check2048GameOver();
    }
}

function check2048GameOver() {
    // Check for empty cells
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (board2048[r][c] === 0) return;
        }
    }
    
    // Check for adjacent merges
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (c < 3 && board2048[r][c] === board2048[r][c+1]) return;
            if (r < 3 && board2048[r][c] === board2048[r+1][c]) return;
        }
    }
    
    isGameOver2048 = true;
    handle2048Loss();
}

function handle2048Win() {
    const msgOverlay = document.getElementById('game-message-2048');
    const msgText = document.getElementById('game-status-text-2048');
    if (msgOverlay && msgText) {
        msgText.textContent = "You Won! 🐸";
        msgOverlay.className = 'game-message-2048 game-won';
    }
    speak('taskCompleted');
}

function handle2048Loss() {
    const msgOverlay = document.getElementById('game-message-2048');
    const msgText = document.getElementById('game-status-text-2048');
    if (msgOverlay && msgText) {
        msgText.textContent = "Game Over!";
        msgOverlay.className = 'game-message-2048 game-over';
    }
}

// Keyboard arrow controls
window.addEventListener('keydown', function(event) {
    if (!isGamesModalOpen) return;
    
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        
        if (event.key === 'ArrowUp') move2048('up');
        else if (event.key === 'ArrowDown') move2048('down');
        else if (event.key === 'ArrowLeft') move2048('left');
        else if (event.key === 'ArrowRight') move2048('right');
    }
});

// Expose bindings to window
window.openGamesModal = openGamesModal;
window.closeGamesModal = closeGamesModal;
window.restart2048 = restart2048;
window.move2048 = move2048;

/* --- frogGPT AI Study Agent Modal & Communication --- */
let frogGPTSessionId = null;
let importedDocumentText = '';
let importedDocumentName = '';

function openFrogGPTModal() {
    closeCalendarModal();
    closeGamesModal();
    const modal = document.getElementById('froggpt-modal');
    if (modal) {
        modal.classList.add('open');
        const sidebarBtn = document.getElementById('btn-sidebar-froggpt');
        if (sidebarBtn) sidebarBtn.classList.add('active');
        
        // Default to study chat tab
        switchFrogGPTTab('chat');

        // Update quota counter UI
        updateQueryCounterUI();

        // Set focus on input
        setTimeout(() => {
            const input = document.getElementById('froggpt-input');
            if (input) input.focus();
        }, 100);
    }
}

function switchFrogGPTTab(tabName) {
    const body = document.querySelector('.froggpt-modal-body');
    const chatTabBtn = document.getElementById('tab-froggpt-chat');
    const materialsTabBtn = document.getElementById('tab-froggpt-materials');
    const splitTabBtn = document.getElementById('tab-froggpt-split');
    
    if (!body) return;

    // Reset all tabs
    body.classList.remove('tab-chat', 'tab-materials', 'tab-split');
    [chatTabBtn, materialsTabBtn, splitTabBtn].forEach(btn => {
        if (btn) {
            btn.classList.remove('active');
            btn.style.background = 'none';
            btn.style.color = 'var(--color-text-dim)';
        }
    });

    // Set active tab class
    body.classList.add(`tab-${tabName}`);

    const activeBtn = document.getElementById(`tab-froggpt-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = 'var(--color-emerald)';
        activeBtn.style.color = '#fff';
    }
}

function closeFrogGPTModal() {
    const modal = document.getElementById('froggpt-modal');
    if (modal) {
        modal.classList.remove('open');
    }
    const sidebarBtn = document.getElementById('btn-sidebar-froggpt');
    if (sidebarBtn) sidebarBtn.classList.remove('active');
}

function handleQuickPrompt(promptText) {
    const input = document.getElementById('froggpt-input');
    if (input) {
        input.value = promptText;
        sendFrogGPTMessage(promptText);
    }
}

function handleFrogGPTSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('froggpt-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    sendFrogGPTMessage(text);
}

async function sendFrogGPTMessage(messageText) {
    const input = document.getElementById('froggpt-input');
    const chatLog = document.getElementById('froggpt-chat-log');
    const sendBtn = document.getElementById('btn-froggpt-send');
    if (!chatLog) return;

    // Check quota limit first
    const quotaData = getQueryCountForToday();
    if (quotaData.count >= 20) {
        if (input) input.value = '';
        
        // Append user message
        const userMsgElem = document.createElement('div');
        userMsgElem.className = 'chat-message user-message';
        userMsgElem.innerHTML = `
            <div class="chat-avatar">👤</div>
            <div class="chat-bubble">
                <p>${escapeHTML(messageText)}</p>
            </div>
        `;
        chatLog.appendChild(userMsgElem);
        
        // Append warning message
        const aiMsgElem = document.createElement('div');
        aiMsgElem.className = 'chat-message ai-message';
        aiMsgElem.innerHTML = `
            <div class="chat-avatar">🐸</div>
            <div class="chat-bubble">
                <p>⚠️ **Daily Free Quota Reached (20/20)**</p>
                <p>Ribbit! You have reached your daily free tier limit of 20 queries. Please wait until tomorrow for the counter to reset, or run the app locally with your own API key to continue studying!</p>
            </div>
        `;
        chatLog.appendChild(aiMsgElem);
        chatLog.scrollTop = chatLog.scrollHeight;
        return;
    }

    if (input) input.value = '';

    // Append user message
    const userMsgElem = document.createElement('div');
    userMsgElem.className = 'chat-message user-message';
    userMsgElem.innerHTML = `
        <div class="chat-avatar">👤</div>
        <div class="chat-bubble">
            <p>${escapeHTML(messageText)}</p>
        </div>
    `;
    chatLog.appendChild(userMsgElem);
    chatLog.scrollTop = chatLog.scrollHeight;

    // Append thinking message
    const thinkingElem = document.createElement('div');
    thinkingElem.className = 'chat-message ai-message thinking-message';
    thinkingElem.innerHTML = `
        <div class="chat-avatar">🐸</div>
        <div class="chat-bubble">
            <div class="chat-thinking">🐸 Lily is thinking & studying...</div>
        </div>
    `;
    chatLog.appendChild(thinkingElem);
    chatLog.scrollTop = chatLog.scrollHeight;

    if (input) input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    const modelSelect = document.getElementById('froggpt-model-select');
    const selectedModel = modelSelect ? modelSelect.value : 'gemini-2.5-flash';

    try {
        const response = await fetch('/api/froggpt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: messageText,
                session_id: frogGPTSessionId,
                model: selectedModel,
                imported_content: importedDocumentText
            })
        });

        // Remove thinking message
        if (thinkingElem.parentNode) {
            thinkingElem.parentNode.removeChild(thinkingElem);
        }

        if (response.ok) {
            const data = await response.json();
            
            incrementQueryCount(data.calls_made);

            if (data.session_id) {
                frogGPTSessionId = data.session_id;
            }

            const aiMsgElem = document.createElement('div');
            aiMsgElem.className = 'chat-message ai-message';
            
            // Format response with Marked.js if available, otherwise fallback to escapeHTML/paragraphs
            let formattedHTML = '';
            if (typeof marked !== 'undefined') {
                formattedHTML = marked.parse(data.response || '');
            } else {
                formattedHTML = `<p>${escapeHTML(data.response || '')}</p>`;
            }

            let actionBtnHTML = '';
            if (data.structured_data && data.subagent_author) {
                const deckJsonId = `deck-data-${Date.now()}`;
                window[deckJsonId] = data.structured_data;
                actionBtnHTML = `
                    <div style="margin-top: 10px;">
                        <button class="btn btn-primary btn-sm" onclick="loadWidgetFromWindow('${deckJsonId}', '${data.subagent_author}')" style="background: var(--color-mint); border: none; color: var(--bg-dark); font-weight: bold; padding: 6px 12px; border-radius: 8px; cursor: pointer;">
                            🎯 Open in Study Panel
                        </button>
                    </div>
                `;
            }

            aiMsgElem.innerHTML = `
                <div class="chat-avatar">🐸</div>
                <div class="chat-bubble">
                    ${formattedHTML}
                    ${actionBtnHTML}
                </div>
            `;
            chatLog.appendChild(aiMsgElem);
            
            if (data.structured_data && data.subagent_author) {
                switchFrogGPTTab('materials');
                renderInteractiveWidget('froggpt-study-content', data.subagent_author, data.structured_data);
            }

            // Speak a cheerful response in the main window speech bubble too!
            document.getElementById('bubble-text').textContent = "Ribbit! I just answered your study question in frogGPT!";
            playRibbit();
        } else {
            const errData = await response.json().catch(() => ({}));
            


            const errorMsgElem = document.createElement('div');
            errorMsgElem.className = 'chat-message ai-message';
            errorMsgElem.innerHTML = `
                <div class="chat-avatar">🐸</div>
                <div class="chat-bubble" style="border-color: #ff595e;">
                    <p>⚠️ Oops! Error communicating with frogGPT: ${escapeHTML(errData.error || response.statusText)}</p>
                </div>
            `;
            chatLog.appendChild(errorMsgElem);
        }
    } catch (err) {
        console.error("Error communicating with frogGPT:", err);
        if (thinkingElem.parentNode) {
            thinkingElem.parentNode.removeChild(thinkingElem);
        }
        const errorMsgElem = document.createElement('div');
        errorMsgElem.className = 'chat-message ai-message';
        errorMsgElem.innerHTML = `
            <div class="chat-avatar">🐸</div>
            <div class="chat-bubble" style="border-color: #ff595e;">
                <p>⚠️ Oops! Could not connect to the server. Please check your network and ensure the Flask backend is running.</p>
            </div>
        `;
        chatLog.appendChild(errorMsgElem);
    } finally {
        if (input) {
            input.disabled = false;
            input.focus();
        }
        if (sendBtn) sendBtn.disabled = false;
        chatLog.scrollTop = chatLog.scrollHeight;
    }
}

// --- Interactive Widgets rendering ---
function renderInteractiveWidget(containerId, type, data) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (type === 'flashcard_agent') {
        renderFlashcards(container, data);
    } else if (type === 'quiz_agent') {
        renderQuiz(container, data);
    } else if (type === 'test_agent') {
        renderPracticeTest(container, data);
    } else if (type === 'study_guide_agent') {
        renderStudyGuide(container, data);
    }
}

function renderFlashcards(container, deck, isLibraryView = false, deckId = null) {
    const originalCards = deck.cards || [];
    if (originalCards.length === 0) {
        container.innerHTML = '<p>No cards available in this deck.</p>';
        return;
    }

    // Initialize starred states
    originalCards.forEach(card => {
        if (card.starred === undefined) card.starred = false;
    });

    let displayCards = [...originalCards];
    let currentIndex = 0;
    let showStarredOnly = false;
    let isShuffled = false;

    const saveLibraryDeckState = () => {
        if (isLibraryView && deckId) {
            let savedDecks = [];
            try {
                savedDecks = JSON.parse(localStorage.getItem('saved_flashcard_decks')) || [];
            } catch (e) {
                savedDecks = [];
            }
            const idx = savedDecks.findIndex(d => d.id === deckId);
            if (idx !== -1) {
                savedDecks[idx].cards = originalCards;
                localStorage.setItem('saved_flashcard_decks', JSON.stringify(savedDecks));
            }
        }
    };

    const updateCardDisplay = () => {
        if (displayCards.length === 0) {
            container.querySelector('.flashcard-text-front').innerHTML = `<p class="flashcard-text">No cards match the filter.</p>`;
            container.querySelector('.flashcard-text-back').innerHTML = `<p class="flashcard-text">Try starring some concepts first!</p>`;
            container.querySelector('.card-index-indicator').innerText = `Card 0 of 0`;
            container.querySelector('.btn-star-toggle').style.display = 'none';
            return;
        }

        container.querySelector('.btn-star-toggle').style.display = 'block';
        const card = displayCards[currentIndex];
        const topicLabel = card.topic ? `<span class="flashcard-tag">${escapeHTML(card.topic)}</span>` : '';
        
        container.querySelector('.flashcard-text-front').innerHTML = `${topicLabel}<p class="flashcard-text">${escapeHTML(card.question)}</p>`;
        container.querySelector('.flashcard-text-back').innerHTML = `<p class="flashcard-text">${escapeHTML(card.answer)}</p>`;
        container.querySelector('.card-index-indicator').innerText = `Card ${currentIndex + 1} of ${displayCards.length}`;
        
        // Star icon state
        const starBtn = container.querySelector('.btn-star-toggle');
        if (card.starred) {
            starBtn.innerHTML = '★';
            starBtn.style.color = '#ffd166';
        } else {
            starBtn.innerHTML = '☆';
            starBtn.style.color = 'var(--color-text-dim)';
        }

        // Reset flipped state
        container.querySelector('.flashcard-wrapper').classList.remove('flipped');
    };

    container.innerHTML = `
        <div class="chat-flashcard-widget">
            <div class="widget-title-bar">
                <h4>📇 ${escapeHTML(deck.title || 'Flashcard Deck')}</h4>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button class="btn btn-secondary btn-sm btn-filter-starred" style="background: rgba(255,255,255,0.05); border: 1px solid var(--panel-border); color: #fff; padding: 4px 8px; border-radius: 8px; cursor: pointer; font-size: 0.75rem;">⭐ Starred Only</button>
                    ${!isLibraryView ? `<button class="btn btn-primary btn-sm btn-save-deck" style="background: var(--color-sage); border-color: var(--panel-border); color: #fff; font-size: 0.78rem; padding: 4px 10px; border-radius: 8px; cursor: pointer;">Save to Library</button>` : ''}
                </div>
            </div>
            <div class="flashcard-wrapper" style="position: relative;">
                <!-- Star Toggle Button inside the card wrapper -->
                <button class="btn-star-toggle" title="Star this concept" style="position: absolute; top: 12px; right: 12px; z-index: 10; background: none; border: none; font-size: 1.5rem; cursor: pointer; transition: transform 0.2s;">☆</button>
                
                <div class="flashcard-inner">
                    <div class="flashcard-front">
                        <div class="flashcard-text-front"></div>
                        <div style="font-size:0.75rem; color:var(--color-sage); margin-top:15px; opacity:0.7;">Click to Flip 🔄</div>
                    </div>
                    <div class="flashcard-back">
                        <div class="flashcard-text-back"></div>
                        <div style="font-size:0.75rem; color:var(--color-mint); margin-top:15px; opacity:0.7;">Click to Flip 🔄</div>
                    </div>
                </div>
            </div>
            <div class="flashcard-controls">
                <button class="btn btn-secondary btn-sm btn-prev" style="background: rgba(255,255,255,0.05); border: 1px solid var(--panel-border); color: #fff; padding: 5px 12px; border-radius: 8px; cursor: pointer;">◀ Prev</button>
                <button class="btn btn-secondary btn-sm btn-shuffle" style="background: rgba(255,255,255,0.05); border: 1px solid var(--panel-border); color: #fff; padding: 5px 12px; border-radius: 8px; cursor: pointer;">🔀 Shuffle</button>
                <span class="card-index-indicator">Card 1 of ${displayCards.length}</span>
                <button class="btn btn-secondary btn-sm btn-next" style="background: rgba(255,255,255,0.05); border: 1px solid var(--panel-border); color: #fff; padding: 5px 12px; border-radius: 8px; cursor: pointer;">Next ▶</button>
            </div>
        </div>
    `;

    // Flip handler
    const wrapper = container.querySelector('.flashcard-wrapper');
    wrapper.addEventListener('click', (e) => {
        // Don't flip if they clicked the star toggle button
        if (e.target.classList.contains('btn-star-toggle')) return;
        wrapper.classList.toggle('flipped');
    });

    // Star Toggle Handler
    const starBtn = container.querySelector('.btn-star-toggle');
    starBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (displayCards.length === 0) return;
        const card = displayCards[currentIndex];
        card.starred = !card.starred;
        
        // Visual effect bounce
        starBtn.style.transform = 'scale(1.3)';
        setTimeout(() => { starBtn.style.transform = 'scale(1)'; }, 200);

        saveLibraryDeckState();
        updateCardDisplay();
    });

    // Prev/Next handlers
    container.querySelector('.btn-prev').addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentIndex > 0) {
            currentIndex--;
            updateCardDisplay();
        }
    });

    container.querySelector('.btn-next').addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentIndex < displayCards.length - 1) {
            currentIndex++;
            updateCardDisplay();
        }
    });

    // Shuffle Handler
    const shuffleBtn = container.querySelector('.btn-shuffle');
    shuffleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (displayCards.length <= 1) return;

        if (!isShuffled) {
            // Fisher-Yates Shuffle
            for (let i = displayCards.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [displayCards[i], displayCards[j]] = [displayCards[j], displayCards[i]];
            }
            isShuffled = true;
            shuffleBtn.innerText = '🔄 Reset';
            shuffleBtn.style.borderColor = 'var(--color-mint)';
        } else {
            // Restore original order based on originalCards filter
            if (showStarredOnly) {
                displayCards = originalCards.filter(c => c.starred);
            } else {
                displayCards = [...originalCards];
            }
            isShuffled = false;
            shuffleBtn.innerText = '🔀 Shuffle';
            shuffleBtn.style.borderColor = 'var(--panel-border)';
        }
        
        currentIndex = 0;
        updateCardDisplay();
    });

    // Filter Starred Handler
    const filterBtn = container.querySelector('.btn-filter-starred');
    filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (!showStarredOnly) {
            const starredCards = originalCards.filter(c => c.starred);
            if (starredCards.length === 0) {
                alert("You haven't starred any cards in this deck yet! Click the star icon (☆) on the top-right of any card to save it for review.");
                return;
            }
            displayCards = starredCards;
            showStarredOnly = true;
            filterBtn.style.background = 'rgba(255, 209, 102, 0.15)';
            filterBtn.style.borderColor = '#ffd166';
            filterBtn.style.color = '#ffd166';
        } else {
            displayCards = [...originalCards];
            showStarredOnly = false;
            filterBtn.style.background = 'rgba(255,255,255,0.05)';
            filterBtn.style.borderColor = 'var(--panel-border)';
            filterBtn.style.color = '#fff';
        }

        // Reset shuffle state on filter toggle
        isShuffled = false;
        shuffleBtn.innerText = '🔀 Shuffle';
        shuffleBtn.style.borderColor = 'var(--panel-border)';
        
        currentIndex = 0;
        updateCardDisplay();
    });

    // Save to Library Handler
    if (!isLibraryView) {
        container.querySelector('.btn-save-deck').addEventListener('click', (e) => {
            e.stopPropagation();
            saveDeckToLibrary(deck);
        });
    }

    // Initialize display
    updateCardDisplay();
}

function saveDeckToLibrary(deck) {
    let savedDecks = [];
    try {
        savedDecks = JSON.parse(localStorage.getItem('saved_flashcard_decks')) || [];
    } catch (e) {
        savedDecks = [];
    }
    
    // Add deck with unique ID and timestamp
    const newDeck = {
        id: `deck-${Date.now()}`,
        timestamp: new Date().toISOString(),
        title: deck.title || 'Untitled Deck',
        description: deck.description || '',
        cards: deck.cards || []
    };
    
    savedDecks.push(newDeck);
    localStorage.setItem('saved_flashcard_decks', JSON.stringify(savedDecks));
    alert('Deck saved successfully to your Flashcards Library! 📇');
}

function renderQuiz(container, quiz, isLibraryView = false) {
    const questions = quiz.questions || [];
    if (questions.length === 0) {
        container.innerHTML = '<p>No questions available in this quiz.</p>';
        return;
    }

    const userAnswers = new Array(questions.length).fill(null);

    const renderQuizContent = (showResults = false) => {
        let questionsHTML = '';
        let score = 0;

        questions.forEach((q, qIdx) => {
            let optionsHTML = '';
            
            let correctLetter = '';
            if (q.correct_answer) {
                const match = q.correct_answer.match(/^([A-D])(?:\)| |$)/i);
                if (match) {
                    correctLetter = match[1].toUpperCase();
                } else {
                    correctLetter = q.correct_answer.trim().charAt(0).toUpperCase();
                }
            }

            q.options.forEach((opt, optIdx) => {
                const optionLetter = String.fromCharCode(65 + optIdx); // A, B, C, D
                const isSelected = userAnswers[qIdx] === optIdx;
                let optionClass = 'quiz-option-btn';
                if (isSelected) optionClass += ' selected';

                if (showResults) {
                    const isCorrectOption = optionLetter === correctLetter;
                    if (isCorrectOption) {
                        optionClass += ' correct-reveal';
                        if (isSelected) score++;
                    } else if (isSelected) {
                        optionClass += ' wrong-reveal';
                    }
                }

                optionsHTML += `
                    <button class="${optionClass}" data-q="${qIdx}" data-opt="${optIdx}" ${showResults ? 'disabled' : ''}>
                        <span class="option-letter" style="font-weight:bold; color:var(--color-mint);">${optionLetter}.</span> 
                        <span>${escapeHTML(opt.replace(/^[A-D]\)?\s*/i, ''))}</span>
                    </button>
                `;
            });

            const explanationHTML = (showResults && q.explanation) ? `
                <div class="quiz-explanation">
                    <strong>Explanation:</strong> ${escapeHTML(q.explanation)}
                </div>
            ` : '';

            questionsHTML += `
                <div class="quiz-question-container">
                    <div class="quiz-question-num">Question ${qIdx + 1}</div>
                    <p class="quiz-question-text">${escapeHTML(q.question)}</p>
                    <div class="quiz-options-list">
                        ${optionsHTML}
                    </div>
                    ${explanationHTML}
                </div>
            `;
        });

        let summaryHTML = '';
        if (showResults) {
            summaryHTML = `
                <div class="quiz-results-summary" style="text-align:center; padding: 15px 10px; background:rgba(255,255,255,0.03); border:1px solid var(--panel-border); border-radius:12px; margin-bottom:15px;">
                    <div class="quiz-score-highlight" style="font-size:2rem; font-weight:bold; color:var(--color-mint);">${score} / ${questions.length}</div>
                    <p style="margin: 5px 0 10px 0; font-size:0.85rem; color:var(--color-text-dim);">Ribbit! Review the correct answers and explanations below.</p>
                    <button class="btn btn-secondary btn-retry-quiz" style="background:rgba(255,255,255,0.05); border:1px solid var(--panel-border); color:#fff; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; font-weight:bold;">🔄 Retry Quiz</button>
                </div>
            `;
        } else {
            summaryHTML = `
                <div style="text-align: center; margin-top: 15px;">
                    <button class="btn btn-primary btn-submit-quiz" style="background: var(--color-mint); border: none; color: var(--bg-dark); font-weight: bold; padding: 8px 16px; border-radius: 10px; cursor: pointer; transition: transform 0.2s;">Submit Quiz</button>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="quiz-widget">
                <div class="widget-title-bar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                    <h4 style="margin:0;">📝 ${escapeHTML(quiz.title || 'Practice Quiz')}</h4>
                    ${!isLibraryView ? `<button class="btn btn-primary btn-sm btn-save-quiz" style="background:var(--color-sage); border:none; color:#fff; font-weight:bold; padding:4px 10px; border-radius:8px; cursor:pointer; font-size:0.78rem;">Save to Library</button>` : ''}
                </div>
                ${summaryHTML}
                <div class="quiz-questions-list">
                    ${questionsHTML}
                </div>
            </div>
        `;

        if (showResults) {
            container.querySelector('.btn-retry-quiz').addEventListener('click', () => {
                userAnswers.fill(null);
                renderQuizContent(false);
            });
        } else {
            container.querySelectorAll('.quiz-option-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const qIdx = parseInt(btn.getAttribute('data-q'));
                    const optIdx = parseInt(btn.getAttribute('data-opt'));
                    userAnswers[qIdx] = optIdx;
                    renderQuizContent(false);
                });
            });

            container.querySelector('.btn-submit-quiz').addEventListener('click', () => {
                const unanswered = userAnswers.filter(ans => ans === null).length;
                if (unanswered > 0) {
                    if (!confirm(`You have left ${unanswered} question(s) unanswered. Submit anyway?`)) {
                        return;
                    }
                }
                renderQuizContent(true);
            });
        }

        if (!isLibraryView) {
            const saveBtn = container.querySelector('.btn-save-quiz');
            if (saveBtn) {
                saveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    saveQuizToLibrary(quiz);
                    saveBtn.style.background = 'rgba(255,255,255,0.1)';
                    saveBtn.innerText = 'Saved! ✓';
                    saveBtn.setAttribute('disabled', 'true');
                });
            }
        }
    };

    renderQuizContent(false);
}

function renderPracticeTest(container, test, isLibraryView = false) {
    const tfQuestions = test.true_false || [];
    const mcQuestions = test.multiple_choice || [];
    const saQuestions = test.short_answer || [];

    const tfAnswers = new Array(tfQuestions.length).fill(null);
    const mcAnswers = new Array(mcQuestions.length).fill(null);
    const saAnswers = new Array(saQuestions.length).fill('');

    const renderTestContent = (showResults = false) => {
        let tfHTML = '';
        let mcHTML = '';
        let saHTML = '';
        let score = 0;
        let maxScore = tfQuestions.length + mcQuestions.length;

        // TF
        if (tfQuestions.length > 0) {
            tfHTML += `<div class="test-section-title">Section A — True or False</div>`;
            tfQuestions.forEach((q, qIdx) => {
                let optionsHTML = '';
                const options = ['True', 'False'];
                options.forEach((opt, optIdx) => {
                    const isSelected = tfAnswers[qIdx] === opt;
                    let optionClass = 'quiz-option-btn';
                    if (isSelected) optionClass += ' selected';

                    if (showResults) {
                        const isCorrect = String(q.correct_answer).toLowerCase().trim() === opt.toLowerCase();
                        if (isCorrect) {
                            optionClass += ' correct-reveal';
                            if (isSelected) score++;
                        } else if (isSelected) {
                            optionClass += ' wrong-reveal';
                        }
                    }

                    optionsHTML += `
                        <button class="${optionClass}" data-tf-q="${qIdx}" data-tf-opt="${opt}" ${showResults ? 'disabled' : ''} style="flex: 1; text-align: center;">
                            ${opt}
                        </button>
                    `;
                });

                const explanationHTML = (showResults && q.explanation) ? `
                    <div class="quiz-explanation">
                        <strong>Explanation:</strong> ${escapeHTML(q.explanation)}
                    </div>
                ` : '';

                tfHTML += `
                    <div class="quiz-question-container">
                        <div class="quiz-question-num">Question ${qIdx + 1} (${q.points || 1} pt)</div>
                        <p class="quiz-question-text">${escapeHTML(q.statement)}</p>
                        <div class="quiz-options-list" style="flex-direction: row; gap: 10px;">
                            ${optionsHTML}
                        </div>
                        ${explanationHTML}
                    </div>
                `;
            });
        }

        // MCQ
        if (mcQuestions.length > 0) {
            mcHTML += `<div class="test-section-title">Section B — Multiple Choice</div>`;
            mcQuestions.forEach((q, qIdx) => {
                let optionsHTML = '';
                
                let correctLetter = '';
                if (q.correct_answer) {
                    const match = q.correct_answer.match(/^([A-D])(?:\)| |$)/i);
                    if (match) {
                        correctLetter = match[1].toUpperCase();
                    } else {
                        correctLetter = q.correct_answer.trim().charAt(0).toUpperCase();
                    }
                }

                q.options.forEach((opt, optIdx) => {
                    const optionLetter = String.fromCharCode(65 + optIdx);
                    const isSelected = mcAnswers[qIdx] === optIdx;
                    let optionClass = 'quiz-option-btn';
                    if (isSelected) optionClass += ' selected';

                    if (showResults) {
                        const isCorrectOption = optionLetter === correctLetter;
                        if (isCorrectOption) {
                            optionClass += ' correct-reveal';
                            if (isSelected) score++;
                        } else if (isSelected) {
                            optionClass += ' wrong-reveal';
                        }
                    }

                    optionsHTML += `
                        <button class="${optionClass}" data-mc-q="${qIdx}" data-mc-opt="${optIdx}" ${showResults ? 'disabled' : ''}>
                            <span class="option-letter" style="font-weight:bold; color:var(--color-mint);">${optionLetter}.</span> 
                            <span>${escapeHTML(opt.replace(/^[A-D]\)?\s*/i, ''))}</span>
                        </button>
                    `;
                });

                const explanationHTML = (showResults && q.explanation) ? `
                    <div class="quiz-explanation">
                        <strong>Explanation:</strong> ${escapeHTML(q.explanation)}
                    </div>
                ` : '';

                mcHTML += `
                    <div class="quiz-question-container">
                        <div class="quiz-question-num">Question ${tfQuestions.length + qIdx + 1} (${q.points || 1} pt)</div>
                        <p class="quiz-question-text">${escapeHTML(q.question)}</p>
                        <div class="quiz-options-list">
                            ${optionsHTML}
                        </div>
                        ${explanationHTML}
                    </div>
                `;
            });
        }

        // SA
        if (saQuestions.length > 0) {
            saHTML += `<div class="test-section-title">Section C — Short Answer</div>`;
            saQuestions.forEach((q, qIdx) => {
                const userVal = saAnswers[qIdx] || '';
                const textareaHTML = showResults 
                    ? `<div class="user-written-answer"><strong>Your Answer:</strong> ${escapeHTML(userVal || '[Left blank]')}</div>`
                    : `<textarea class="test-textarea" data-sa-q="${qIdx}" placeholder="Type your answer here...">${escapeHTML(userVal)}</textarea>`;

                const feedbackHTML = showResults ? `
                    <div class="test-short-answer-feedback">
                        <div class="model-sample-answer">
                            <strong>Sample/Model Answer:</strong> ${escapeHTML(q.sample_answer)}
                        </div>
                        <div class="grading-guidelines">
                            <strong>Key Points to Self-Grade:</strong> ${escapeHTML((q.key_points || []).join(', '))}
                        </div>
                    </div>
                ` : '';

                saHTML += `
                    <div class="quiz-question-container">
                        <div class="quiz-question-num">Question ${tfQuestions.length + mcQuestions.length + qIdx + 1} (${q.points || 3} pts)</div>
                        <p class="quiz-question-text">${escapeHTML(q.question)}</p>
                        ${textareaHTML}
                        ${feedbackHTML}
                    </div>
                `;
            });
        }

        let summaryHTML = '';
        if (showResults) {
            summaryHTML = `
                <div class="quiz-results-summary" style="text-align:center; padding: 15px 10px; background:rgba(255,255,255,0.03); border:1px solid var(--panel-border); border-radius:12px; margin-bottom:15px;">
                    <div class="quiz-score-highlight" style="font-size:2rem; font-weight:bold; color:var(--color-mint);">${score} / ${maxScore}</div>
                    <p style="margin: 5px 0 10px 0; font-size:0.85rem; color:var(--color-text-dim);">You completed the test! Review your answers below.</p>
                    <button class="btn btn-secondary btn-retry-test" style="background:rgba(255,255,255,0.05); border:1px solid var(--panel-border); color:#fff; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; font-weight:bold;">🔄 Retry Test</button>
                </div>
            `;
        } else {
            summaryHTML = `
                <div style="text-align: center; margin-top: 15px;">
                    <button class="btn btn-primary btn-submit-test" style="background: var(--color-mint); border: none; color: var(--bg-dark); font-weight: bold; padding: 8px 16px; border-radius: 10px; cursor: pointer;">Submit Practice Test</button>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="quiz-widget">
                <div class="widget-title-bar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                    <h4 style="margin:0;">🧪 ${escapeHTML(test.title || 'Practice Test')}</h4>
                    ${!isLibraryView ? `<button class="btn btn-primary btn-sm btn-save-test" style="background:var(--color-sage); border:none; color:#fff; font-weight:bold; padding:4px 10px; border-radius:8px; cursor:pointer; font-size:0.78rem;">Save to Library</button>` : ''}
                </div>
                ${summaryHTML}
                <div class="test-sections">
                    ${tfHTML}
                    ${mcHTML}
                    ${saHTML}
                </div>
            </div>
        `;

        if (showResults) {
            container.querySelector('.btn-retry-test').addEventListener('click', () => {
                tfAnswers.fill(null);
                mcAnswers.fill(null);
                saAnswers.fill('');
                renderTestContent(false);
            });
        } else {
            container.querySelectorAll('[data-tf-q]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const qIdx = parseInt(btn.getAttribute('data-tf-q'));
                    tfAnswers[qIdx] = btn.getAttribute('data-tf-opt');
                    renderTestContent(false);
                });
            });

            container.querySelectorAll('[data-mc-q]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const qIdx = parseInt(btn.getAttribute('data-mc-q'));
                    mcAnswers[qIdx] = parseInt(btn.getAttribute('data-mc-opt'));
                    renderTestContent(false);
                });
            });

            container.querySelectorAll('[data-sa-q]').forEach(textarea => {
                textarea.addEventListener('input', () => {
                    const qIdx = parseInt(textarea.getAttribute('data-sa-q'));
                    saAnswers[qIdx] = textarea.value;
                });
            });

            container.querySelector('.btn-submit-test').addEventListener('click', () => {
                const unansweredTF = tfAnswers.filter(ans => ans === null).length;
                const unansweredMC = mcAnswers.filter(ans => ans === null).length;
                const unansweredSA = saAnswers.filter(ans => ans.trim() === '').length;
                const totalUnanswered = unansweredTF + unansweredMC + unansweredSA;

                if (totalUnanswered > 0) {
                    if (!confirm(`You have left ${totalUnanswered} question(s) unanswered. Submit anyway?`)) {
                        return;
                    }
                }
                renderTestContent(true);
            });
        }

        if (!isLibraryView) {
            const saveBtn = container.querySelector('.btn-save-test');
            if (saveBtn) {
                saveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    saveTestToLibrary(test);
                    saveBtn.style.background = 'rgba(255,255,255,0.1)';
                    saveBtn.innerText = 'Saved! ✓';
                    saveBtn.setAttribute('disabled', 'true');
                });
            }
        }
    };

    renderTestContent(false);
}

// --- Flashcards Library Modal Handlers (Unified Split-screen tab) ---
function openFlashcardsLibraryModal() {
    openFrogGPTModal();
    switchFrogGPTTab('materials');
    showLibraryInPanel();
}

function closeFlashcardsLibraryModal() {
    closeFrogGPTModal();
}

function loadWidgetFromWindow(key, type) {
    const data = window[key];
    if (data) {
        switchFrogGPTTab('materials');
        renderInteractiveWidget('froggpt-study-content', type, data);
    }
}

let currentLibraryTab = 'flashcards';
let activeLibraryItemId = null;

function setLibraryTab(tab) {
    currentLibraryTab = tab;
    activeLibraryItemId = null;
    showLibraryInPanel();
}
window.setLibraryTab = setLibraryTab;

function selectLibraryItem(itemId) {
    activeLibraryItemId = itemId;
    showLibraryInPanel();
}
window.selectLibraryItem = selectLibraryItem;

function deleteQuizInPanel(quizId) {
    if (confirm("Are you sure you want to delete this quiz from your library?")) {
        let quizzes = loadSavedQuizzes();
        quizzes = quizzes.filter(q => q.id !== quizId);
        localStorage.setItem('saved_quizzes', JSON.stringify(quizzes));
        activeLibraryItemId = null;
        showLibraryInPanel();
    }
}
window.deleteQuizInPanel = deleteQuizInPanel;

function deleteTestInPanel(testId) {
    if (confirm("Are you sure you want to delete this test from your library?")) {
        let tests = loadSavedTests();
        tests = tests.filter(t => t.id !== testId);
        localStorage.setItem('saved_tests', JSON.stringify(tests));
        activeLibraryItemId = null;
        showLibraryInPanel();
    }
}
window.deleteTestInPanel = deleteTestInPanel;

function deleteGuideInPanel(guideId) {
    if (confirm("Are you sure you want to delete this study guide from your library?")) {
        let guides = loadSavedGuides();
        guides = guides.filter(g => g.id !== guideId);
        localStorage.setItem('saved_study_guides', JSON.stringify(guides));
        activeLibraryItemId = null;
        showLibraryInPanel();
    }
}
window.deleteGuideInPanel = deleteGuideInPanel;

function showLibraryInPanel(searchQuery = '') {
    const container = document.getElementById('froggpt-study-content');
    if (!container) return;

    let items = [];
    if (currentLibraryTab === 'flashcards') {
        items = loadFlashcardSets();
    } else if (currentLibraryTab === 'quizzes') {
        items = loadSavedQuizzes();
    } else if (currentLibraryTab === 'tests') {
        items = loadSavedTests();
    } else if (currentLibraryTab === 'guides') {
        items = loadSavedGuides();
    } else if (currentLibraryTab === 'notes') {
        items = loadSavedNotes();
    }

    const filteredItems = items.filter(item => 
        (item.title && item.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (filteredItems.length > 0) {
        if (!activeLibraryItemId || !filteredItems.some(i => i.id === activeLibraryItemId)) {
            activeLibraryItemId = filteredItems[0].id;
        }
    } else {
        activeLibraryItemId = null;
    }

    // Tabs HTML (5 columns)
    const tabsHTML = `
        <div class="library-tabs" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-top: 8px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px;">
            <button class="tab-btn btn-sm" onclick="setLibraryTab('flashcards')" style="padding: 6px 2px; font-size: 0.7rem; font-weight: bold; border-radius: 6px; border: none; cursor: pointer; color: ${currentLibraryTab === 'flashcards' ? '#fff' : 'var(--color-text-dim)'}; background: ${currentLibraryTab === 'flashcards' ? 'var(--color-sage)' : 'none'};">📇 Cards</button>
            <button class="tab-btn btn-sm" onclick="setLibraryTab('quizzes')" style="padding: 6px 2px; font-size: 0.7rem; font-weight: bold; border-radius: 6px; border: none; cursor: pointer; color: ${currentLibraryTab === 'quizzes' ? '#fff' : 'var(--color-text-dim)'}; background: ${currentLibraryTab === 'quizzes' ? 'var(--color-sage)' : 'none'};">📝 Quiz</button>
            <button class="tab-btn btn-sm" onclick="setLibraryTab('tests')" style="padding: 6px 2px; font-size: 0.7rem; font-weight: bold; border-radius: 6px; border: none; cursor: pointer; color: ${currentLibraryTab === 'tests' ? '#fff' : 'var(--color-text-dim)'}; background: ${currentLibraryTab === 'tests' ? 'var(--color-sage)' : 'none'};">✍️ Test</button>
            <button class="tab-btn btn-sm" onclick="setLibraryTab('guides')" style="padding: 6px 2px; font-size: 0.7rem; font-weight: bold; border-radius: 6px; border: none; cursor: pointer; color: ${currentLibraryTab === 'guides' ? '#fff' : 'var(--color-text-dim)'}; background: ${currentLibraryTab === 'guides' ? 'var(--color-sage)' : 'none'};">📚 Guide</button>
            <button class="tab-btn btn-sm" onclick="setLibraryTab('notes')" style="padding: 6px 2px; font-size: 0.7rem; font-weight: bold; border-radius: 6px; border: none; cursor: pointer; color: ${currentLibraryTab === 'notes' ? '#fff' : 'var(--color-text-dim)'}; background: ${currentLibraryTab === 'notes' ? 'var(--color-sage)' : 'none'};">📓 Notes</button>
        </div>
    `;

    let leftHTML = `
        <div class="library-left-col">
            <div style="display:flex; flex-direction:column; gap:6px;">
                <label style="font-weight:600; color:var(--color-sage); font-size:0.75rem; text-transform:uppercase;">Search Materials</label>
                <input type="text" id="library-deck-search" placeholder="Search..." value="${searchQuery}" oninput="showLibraryInPanel(this.value)" style="padding:8px 12px; border-radius:8px; border:1px solid var(--panel-border); background:rgba(0,0,0,0.2); color:#fff; font-family:var(--font-body); font-size:0.85rem; outline:none; width: 100%;">
            </div>
            ${tabsHTML}
            <div style="display:flex; flex-direction:column; gap:8px; flex-grow:1; overflow-y:auto; margin-top:8px;">
    `;

    if (filteredItems.length === 0) {
        leftHTML += `
            <div style="text-align:center; color:var(--color-text-dim); font-size:0.85rem; padding:20px 0;">
                No materials found, ribbit.
            </div>
        `;
    } else {
        filteredItems.forEach(item => {
            const isSelected = item.id === activeLibraryItemId;
            let infoText = '';
            if (currentLibraryTab === 'flashcards') {
                infoText = `${item.cards.length} Cards`;
            } else if (currentLibraryTab === 'quizzes') {
                infoText = `${item.questions.length} Questions`;
            } else if (currentLibraryTab === 'tests') {
                const totalQ = (item.true_false || []).length + (item.multiple_choice || []).length + (item.short_answer || []).length;
                infoText = `${totalQ} Questions`;
            } else if (currentLibraryTab === 'guides') {
                infoText = `${(item.sections || []).length} Sections`;
            } else if (currentLibraryTab === 'notes') {
                infoText = item.type === 'meeting' ? '👥 Meeting Note' : '🎓 Lecture Outline';
            }

            leftHTML += `
                <div class="library-set-item ${isSelected ? 'selected' : ''}" onclick="selectLibraryItem('${item.id}')">
                    <h4 style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 170px;">${escapeHTML(item.title)}</h4>
                    <p>${infoText}</p>
                </div>
            `;
        });
    }

    leftHTML += `
            </div>
        </div>
    `;

    let rightHTML = `
        <div class="library-right-col" style="display: flex; flex-direction: column;">
    `;

    if (!activeLibraryItemId) {
        let typeLabel = 'Study Materials';
        if (currentLibraryTab === 'flashcards') typeLabel = 'Study Set';
        else if (currentLibraryTab === 'quizzes') typeLabel = 'Quiz';
        else if (currentLibraryTab === 'tests') typeLabel = 'Practice Test';
        else if (currentLibraryTab === 'guides') typeLabel = 'Study Guide';
        else if (currentLibraryTab === 'notes') typeLabel = 'Past Notes';

        rightHTML += `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; flex-grow:1; text-align:center; color:var(--color-text-dim); padding:40px 20px;">
                <span style="font-size:2.5rem; margin-bottom:12px;">📂</span>
                <h3>Select a ${typeLabel}</h3>
                <p style="font-size:0.9rem; max-width:280px; margin-top:4px;">Choose an item from the left column to preview, practice, or study!</p>
            </div>
        `;
    } else {
        const item = items.find(i => i.id === activeLibraryItemId);
        if (currentLibraryTab === 'flashcards') {
            const cardRowsHTML = item.cards.map(card => `
                <div class="library-card-item">
                    <span class="library-card-term">${escapeHTML(card.question || card.term || '')}</span>
                    <span class="library-card-def">${escapeHTML(card.answer || card.definition || '')}</span>
                </div>
            `).join('');

            rightHTML += `
                <div style="display:flex; flex-direction:column; gap:8px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px;">
                    <h3 style="color:var(--color-cream); font-family:var(--font-heading); font-size:1.35rem; margin:0;">${escapeHTML(item.title)}</h3>
                    <p style="color:var(--color-text-dim); font-size:0.85rem; margin:0; line-height:1.4;">${escapeHTML(item.description || 'No description provided.')}</p>
                    
                    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
                        <button class="btn btn-primary btn-sm" onclick="playFlashcardDeckInPanel('${item.id}')" style="background:var(--color-sage); border:none; color:#fff; font-weight:bold; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:4px;">📇 Study Cards</button>
                        <button class="btn btn-primary btn-sm" onclick="playMatchingFromLibrary('${item.id}')" style="background:var(--color-mint); border:none; color:var(--bg-dark); font-weight:bold; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:4px;">🍃 Play Match</button>
                        <button class="btn btn-primary btn-sm" onclick="playBlasterFromLibrary('${item.id}')" style="background:var(--color-mint); border:none; color:var(--bg-dark); font-weight:bold; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:4px;">💧 Play Blaster</button>
                        <button class="btn btn-secondary btn-sm" onclick="openAddSetModal('${item.id}')" style="background:rgba(255,255,255,0.05); border:1px solid var(--panel-border); color:#fff; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:4px;">✏️ Edit Set</button>
                        <button class="btn btn-secondary btn-sm" onclick="deleteFlashcardDeckInPanel('${item.id}')" style="background:rgba(200, 70, 70, 0.15); border:1px solid rgba(200, 70, 70, 0.3); color:#f7a3a3; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:4px;">🗑️ Delete</button>
                    </div>
                </div>
                
                <div style="flex-grow:1; display:flex; flex-direction:column; gap:8px; margin-top:4px; overflow:hidden;">
                    <label style="font-weight:600; color:var(--color-sage); font-size:0.75rem; text-transform:uppercase; margin-bottom:2px;">Cards in this Set (${item.cards.length})</label>
                    <div class="library-card-list">
                        ${cardRowsHTML}
                    </div>
                </div>
            `;
        } else if (currentLibraryTab === 'quizzes') {
            rightHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px; margin-bottom: 12px;">
                    <h3 style="color:var(--color-cream); font-family:var(--font-heading); font-size:1.25rem; margin:0;">📝 Practice Quiz</h3>
                    <button class="btn btn-secondary btn-sm" onclick="deleteQuizInPanel('${item.id}')" style="background:rgba(200, 70, 70, 0.15); border:1px solid rgba(200, 70, 70, 0.3); color:#f7a3a3; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:4px;">🗑️ Delete</button>
                </div>
                <div id="library-interactive-container" style="flex-grow:1; overflow-y:auto; padding-right:4px;"></div>
            `;
        } else if (currentLibraryTab === 'tests') {
            rightHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px; margin-bottom: 12px;">
                    <h3 style="color:var(--color-cream); font-family:var(--font-heading); font-size:1.25rem; margin:0;">✍️ Practice Test</h3>
                    <button class="btn btn-secondary btn-sm" onclick="deleteTestInPanel('${item.id}')" style="background:rgba(200, 70, 70, 0.15); border:1px solid rgba(200, 70, 70, 0.3); color:#f7a3a3; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:4px;">🗑️ Delete</button>
                </div>
                <div id="library-interactive-container" style="flex-grow:1; overflow-y:auto; padding-right:4px;"></div>
            `;
        } else if (currentLibraryTab === 'guides') {
            rightHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px; margin-bottom: 12px;">
                    <h3 style="color:var(--color-cream); font-family:var(--font-heading); font-size:1.25rem; margin:0;">📚 Study Guide</h3>
                    <button class="btn btn-secondary btn-sm" onclick="deleteGuideInPanel('${item.id}')" style="background:rgba(200, 70, 70, 0.15); border:1px solid rgba(200, 70, 70, 0.3); color:#f7a3a3; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:4px;">🗑️ Delete</button>
                </div>
                <div id="library-interactive-container" style="flex-grow:1; overflow-y:auto; padding-right:4px;"></div>
            `;
        } else if (currentLibraryTab === 'notes') {
            rightHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px; margin-bottom: 12px; flex-shrink: 0;">
                    <h3 style="color:var(--color-cream); font-family:var(--font-heading); font-size:1.25rem; margin:0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 320px;">📓 ${escapeHTML(item.title)}</h3>
                    <button class="btn btn-secondary btn-sm" onclick="deleteNoteInPanel('${item.id}')" style="background:rgba(200, 70, 70, 0.15); border:1px solid rgba(200, 70, 70, 0.3); color:#f7a3a3; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:4px;">🗑️ Delete</button>
                </div>
                <div id="library-interactive-container" style="flex-grow:1; overflow-y:auto; padding-right:4px; text-align: left;"></div>
            `;
        }
    }

    rightHTML += `
        </div>
    `;

    container.innerHTML = `
        <div class="flashcards-library-container" style="display:flex; flex-direction:column; gap:12px; height:100%; overflow:hidden;">
            <div class="player-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
                <h3 style="margin:0; font-family:var(--font-heading); color:var(--color-cream); display:flex; align-items:center; gap:6px;">📂 Study Materials Library</h3>
                <div style="display:flex; gap:8px;">
                    ${currentLibraryTab === 'flashcards' ? `<button class="btn btn-primary btn-sm" onclick="openAddSetModal()" style="background:var(--color-mint); border:none; color:var(--bg-dark); font-weight:bold; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:0.8rem;">➕ Create Set</button>` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="showStudyPanelPlaceholder()" style="background:rgba(255,255,255,0.05); border:1px solid var(--panel-border); color:#fff; padding:6px 12px; border-radius:8px; cursor:pointer;">Close</button>
                </div>
            </div>
            
            <div class="library-two-col">
                ${leftHTML}
                ${rightHTML}
            </div>
        </div>
    `;

    // Hook search keyup/change input handling
    const searchInput = document.getElementById('library-deck-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            showLibraryInPanel(e.target.value);
        });
    }

    // Render interactive widgets if relevant
    if (activeLibraryItemId) {
        const item = items.find(i => i.id === activeLibraryItemId);
        const subContainer = document.getElementById('library-interactive-container');
        if (subContainer && item) {
            if (currentLibraryTab === 'quizzes') {
                renderQuiz(subContainer, item, true);
            } else if (currentLibraryTab === 'tests') {
                renderPracticeTest(subContainer, item, true);
            } else if (currentLibraryTab === 'guides') {
                renderStudyGuide(subContainer, item, true);
            } else if (currentLibraryTab === 'notes') {
                // Parse markdown summary
                let noteHTML = '';
                if (typeof marked !== 'undefined') {
                    noteHTML = marked.parse(item.notes);
                } else {
                    noteHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHTML(item.notes)}</pre>`;
                }
                
                subContainer.innerHTML = `
                    <div style="line-height:1.5; color:var(--color-cream); font-size:0.85rem;">
                        ${noteHTML}
                        
                        <div class="study-actions-box" style="margin-top: 15px; padding: 12px; background: rgba(135,195,143,0.06); border: 1px solid rgba(135,195,143,0.15); border-radius: 12px; text-align: left;">
                            <div style="font-weight: bold; color: var(--color-mint); font-size: 0.85rem; margin-bottom: 8px;">🎓 Study & Practice with these Notes</div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                <button class="btn btn-primary btn-sm" onclick="studyNotesWithFrogGPT('${item.id}', 'flashcards')" style="background: var(--color-sage); border: none; color: #fff; padding: 6px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">📇 Make Flashcards</button>
                                <button class="btn btn-primary btn-sm" onclick="studyNotesWithFrogGPT('${item.id}', 'quiz')" style="background: var(--color-sage); border: none; color: #fff; padding: 6px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">📝 Make Quiz</button>
                                <button class="btn btn-primary btn-sm" onclick="studyNotesWithFrogGPT('${item.id}', 'test')" style="background: var(--color-sage); border: none; color: #fff; padding: 6px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">✍️ Make Test</button>
                                <button class="btn btn-primary btn-sm" onclick="studyNotesWithFrogGPT('${item.id}', 'guide')" style="background: var(--color-sage); border: none; color: #fff; padding: 6px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">📚 Make Guide</button>
                            </div>
                            <button class="btn btn-primary btn-sm" onclick="studyNotesWithFrogGPT('${item.id}', 'chat')" style="width: 100%; margin-top: 8px; background: var(--color-mint); border: none; color: var(--bg-dark); padding: 8px; border-radius: 8px; font-size: 0.8rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">🤖 Ask frogGPT Questions about this Note</button>
                        </div>
                        
                        <details style="margin-top: 15px; background: rgba(0,0,0,0.15); border: 1px solid var(--panel-border); border-radius: 8px; padding: 10px;">
                            <summary style="font-size: 0.8rem; font-weight: bold; color: var(--color-sage); cursor: pointer; outline: none; user-select: none;">📝 View Original Transcript</summary>
                            <p style="font-size: 0.8rem; color: var(--color-cream); margin-top: 6px; white-space: pre-wrap; line-height: 1.4; max-height: 150px; overflow-y: auto;">${escapeHTML(item.transcript)}</p>
                        </details>
                        
                        <div style="display: flex; gap: 10px; align-items: center; background: rgba(0,0,0,0.1); border: 1px solid var(--panel-border); border-radius: 12px; padding: 12px; margin-top: 15px;">
                            <div style="flex: 1;">
                                <label style="font-size: 0.7rem; font-weight: 700; color: var(--color-sage); text-transform: uppercase;">Export Format</label>
                                <select id="library-export-format" style="width: 100%; padding: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--panel-border); border-radius: 8px; color: var(--color-cream); font-size: 0.8rem; cursor: pointer; outline: none;">
                                    <option value="pdf" selected>📄 PDF Document (.pdf)</option>
                                    <option value="docx">📝 Word Document (.docx)</option>
                                </select>
                            </div>
                            <button class="btn btn-primary" onclick="exportNoteFromLibrary('${item.id}', event)" style="background: var(--color-mint); border: none; color: var(--bg-dark); font-weight: bold; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; align-self: flex-end;">📥 Export File</button>
                        </div>
                    </div>
                `;
            }
        }
    }
}

function playFlashcardDeckInPanel(deckId) {
    let savedDecks = [];
    try {
        savedDecks = JSON.parse(localStorage.getItem('saved_flashcard_decks')) || [];
    } catch (e) {
        savedDecks = [];
    }

    const deck = savedDecks.find(d => d.id === deckId);
    if (!deck) return;

    const container = document.getElementById('froggpt-study-content');
    if (container) {
        container.innerHTML = `
            <div class="flashcards-player-container">
                <div class="player-header">
                    <h3 id="player-deck-title">${escapeHTML(deck.title)}</h3>
                    <button class="btn btn-secondary btn-sm" onclick="showLibraryInPanel()" style="background: rgba(255,255,255,0.05); border: 1px solid var(--panel-border); color:#fff; padding: 6px 12px; border-radius:8px; cursor:pointer;">Back to Library</button>
                </div>
                <div id="panel-card-area"></div>
            </div>
        `;
        renderFlashcards(document.getElementById('panel-card-area'), deck, true, deckId);
    }
}

function deleteFlashcardDeckInPanel(deckId) {
    if (!confirm('Are you sure you want to delete this deck from your library?')) {
        return;
    }

    let savedDecks = [];
    try {
        savedDecks = JSON.parse(localStorage.getItem('saved_flashcard_decks')) || [];
    } catch (e) {
        savedDecks = [];
    }

    savedDecks = savedDecks.filter(d => d.id !== deckId);
    localStorage.setItem('saved_flashcard_decks', JSON.stringify(savedDecks));
    showLibraryInPanel();
}

function showStudyPanelPlaceholder() {
    const container = document.getElementById('froggpt-study-content');
    if (!container) return;
    container.innerHTML = `
        <div class="study-placeholder">
            <div class="placeholder-mascot">📚🐸</div>
            <h3>Interactive Study Dashboard</h3>
            <p>Ask frogGPT to generate <strong>flashcards</strong>, a <strong>quiz</strong>, a <strong>practice test</strong>, or a <strong>study guide</strong>, and they will load here interactively.</p>
            <button class="btn btn-primary" onclick="showLibraryInPanel()" style="margin-top: 15px; background: var(--color-sage); border-color: var(--panel-border); font-size: 0.85rem; padding: 6px 14px; border-radius: 8px; cursor:pointer; color: #fff;">📂 Open Study Library</button>
        </div>
    `;
}

// --- Document Import Handlers ---
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds the 5MB limit. Please upload a smaller notes file.');
        event.target.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const badge = document.getElementById('froggpt-import-badge');
    const badgeText = document.getElementById('froggpt-import-badge-text');

    try {
        // Show indicator that loading notes is in progress
        if (badgeText) badgeText.innerText = `📎 Loading ${file.name}...`;
        if (badge) badge.classList.remove('hidden');

        const response = await fetch('/api/froggpt/import', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            importedDocumentText = data.content || '';
            importedDocumentName = data.filename || '';
            
            if (badgeText) badgeText.innerText = `📎 Notes Imported: ${escapeHTML(importedDocumentName)} (${data.char_count} chars)`;
            playRibbit();
        } else {
            const err = await response.json().catch(() => ({}));
            alert(`Failed to import document: ${err.error || 'Server error'}`);
            clearImportedDocument();
        }
    } catch (e) {
        console.error('File upload error:', e);
        alert('An error occurred during file upload. Check your server connection.');
        clearImportedDocument();
    } finally {
        event.target.value = ''; // clear input
    }
}

function clearImportedDocument() {
    importedDocumentText = '';
    importedDocumentName = '';
    const badge = document.getElementById('froggpt-import-badge');
    if (badge) badge.classList.add('hidden');
    const fileInput = document.getElementById('froggpt-file-upload');
    if (fileInput) fileInput.value = '';
}

// --- Quota & Query Counter Handlers ---
function getQueryCountForToday() {
    const todayStr = new Date().toDateString();
    let quotaData = { date: todayStr, count: 0 };
    try {
        const stored = JSON.parse(localStorage.getItem('froggpt_query_quota'));
        if (stored) {
            if (stored.date === todayStr) {
                quotaData = stored;
            } else {
                // The date has changed! Reset the stored quota data.
                localStorage.setItem('froggpt_query_quota', JSON.stringify(quotaData));
            }
        } else {
            localStorage.setItem('froggpt_query_quota', JSON.stringify(quotaData));
        }
    } catch (e) {
        console.error(e);
    }
    return quotaData;
}

function incrementQueryCount(amount) {
    const quotaData = getQueryCountForToday();
    const parsedAmount = parseInt(amount, 10);
    quotaData.count += isNaN(parsedAmount) ? 1 : parsedAmount;
    localStorage.setItem('froggpt_query_quota', JSON.stringify(quotaData));
    updateQueryCounterUI();
}

async function syncQuotaWithServer() {
    try {
        const res = await fetch('/api/quota/count');
        if (res.ok) {
            const data = await res.json();
            if (data.success && typeof data.count === 'number') {
                const today = new Date();
                const todayStr = today.toDateString();
                const quotaData = { date: todayStr, count: data.count };
                localStorage.setItem('froggpt_query_quota', JSON.stringify(quotaData));
            }
        }
    } catch (e) {
        console.error("Error syncing quota with server:", e);
    }
    updateQueryCounterUI();
}
window.syncQuotaWithServer = syncQuotaWithServer;

let quotaResetInterval = null;

function updateQueryCounterUI() {
    const quotaData = getQueryCountForToday();
    const counterElem = document.getElementById('froggpt-query-counter');
    const disclaimerElem = document.querySelector('.froggpt-quota-disclaimer');
    const noteCounterElem = document.getElementById('note-quota-counter');
    const noteDisclaimerElem = document.querySelector('.note-quota-disclaimer');
    
    if (quotaResetInterval) {
        clearInterval(quotaResetInterval);
        quotaResetInterval = null;
    }

    if (counterElem) {
        counterElem.innerText = `${quotaData.count} / 20`;
        if (quotaData.count >= 20) {
            counterElem.style.color = '#ff595e';
            counterElem.style.background = 'rgba(255, 89, 94, 0.1)';
            startQuotaCountdown();
        } else {
            counterElem.style.color = 'var(--color-mint)';
            counterElem.style.background = 'rgba(135, 195, 143, 0.1)';
            if (disclaimerElem) {
                disclaimerElem.innerHTML = `
                    <span>⚠️ Daily Free Quota: <strong>20 queries/day</strong></span>
                    <span id="froggpt-query-counter" style="color: var(--color-mint); font-weight: bold; background: rgba(135, 195, 143, 0.1); padding: 2px 8px; border-radius: 6px;">${quotaData.count} / 20</span>
                `;
            }
        }
    }

    if (noteCounterElem) {
        noteCounterElem.innerText = `${quotaData.count} / 20`;
        if (quotaData.count >= 20) {
            noteCounterElem.style.color = '#ff595e';
            noteCounterElem.style.background = 'rgba(255, 89, 94, 0.1)';
            startQuotaCountdown();
        } else {
            noteCounterElem.style.color = 'var(--color-mint)';
            noteCounterElem.style.background = 'rgba(135, 195, 143, 0.1)';
            if (noteDisclaimerElem) {
                const pct = Math.max(0, ((20 - quotaData.count) / 20) * 100);
                let barColor = 'var(--color-mint)';
                if (pct <= 20) {
                    barColor = '#ff595e';
                } else if (pct <= 50) {
                    barColor = '#f4d35e';
                }
                const durationVal = window.noteDurationText || "";
                const displayStyle = durationVal ? "inline-block" : "none";
                noteDisclaimerElem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <span>⚠️ Daily Free Quota: <strong>20 calls/day (shared with frogGPT)</strong></span>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span id="note-recording-duration" style="color: var(--color-mint); font-weight: bold; display: ${displayStyle};">${durationVal}</span>
                            <span id="note-quota-counter" style="color: var(--color-mint); font-weight: bold; background: rgba(135, 195, 143, 0.1); padding: 2px 8px; border-radius: 6px;">${quotaData.count} / 20</span>
                        </div>
                    </div>
                    <!-- Progress Bar -->
                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; position: relative;">
                        <div id="note-quota-progressbar" style="height: 100%; width: ${pct}%; background: ${barColor}; transition: width 0.4s ease, background-color 0.4s ease;"></div>
                    </div>
                `;
            }
        }
    }
}

function startQuotaCountdown() {
    const disclaimerElem = document.querySelector('.froggpt-quota-disclaimer');
    const noteDisclaimerElem = document.querySelector('.note-quota-disclaimer');
    if (!disclaimerElem && !noteDisclaimerElem) return;

    function updateCountdown() {
        const now = new Date();
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0); // next midnight
        
        const diffMs = midnight - now;
        if (diffMs <= 0) {
            // It's midnight! Reset query counter and refresh UI
            localStorage.removeItem('froggpt_query_quota');
            updateQueryCounterUI();
            return;
        }

        const hrs = Math.floor(diffMs / (1000 * 60 * 60));
        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

        const timeStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        
        const quotaData = getQueryCountForToday();
        
        if (disclaimerElem) {
            disclaimerElem.innerHTML = `
                <span>⚠️ Quota Exhausted! Resets in <strong>${timeStr}</strong></span>
                <span id="froggpt-query-counter" style="color: #ff595e; font-weight: bold; background: rgba(255,89,94,0.1); padding: 2px 8px; border-radius: 6px;">${quotaData.count} / 20</span>
            `;
        }
        if (noteDisclaimerElem) {
            const pct = Math.max(0, ((20 - quotaData.count) / 20) * 100);
            let barColor = 'var(--color-mint)';
            if (pct <= 20) {
                barColor = '#ff595e';
            } else if (pct <= 50) {
                barColor = '#f4d35e';
            }
            const durationVal = window.noteDurationText || "";
            const displayStyle = durationVal ? "inline-block" : "none";
            noteDisclaimerElem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span>⚠️ Quota Exhausted! Resets in <strong>${timeStr}</strong></span>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span id="note-recording-duration" style="color: var(--color-mint); font-weight: bold; display: ${displayStyle};">${durationVal}</span>
                        <span id="note-quota-counter" style="color: #ff595e; font-weight: bold; background: rgba(255,89,94,0.1); padding: 2px 8px; border-radius: 6px;">${quotaData.count} / 20</span>
                    </div>
                </div>
                <!-- Progress Bar -->
                <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; position: relative;">
                    <div id="note-quota-progressbar" style="height: 100%; width: ${pct}%; background: ${barColor}; transition: width 0.4s ease, background-color 0.4s ease;"></div>
                </div>
            `;
        }
    }

    updateCountdown();
    quotaResetInterval = setInterval(updateCountdown, 1000);
}

async function toggleFrogGPTHistoryList() {
    if (!isLoggedIn || !loggedInUser) {
        alert("🔑 Please sign in (using the Sync icon in the top right) to save and load your chat session history!");
        return;
    }
    const listOverlay = document.getElementById('froggpt-history-list');
    if (!listOverlay) return;

    if (!listOverlay.classList.contains('hidden')) {
        listOverlay.classList.add('hidden');
        return;
    }

    const itemsContainer = document.getElementById('froggpt-history-items');
    if (itemsContainer) {
        itemsContainer.innerHTML = '<div style="font-size:0.75rem; color:var(--color-text-dim); text-align:center; padding: 10px;">Loading sessions...</div>';
    }

    listOverlay.classList.remove('hidden');

    try {
        const res = await fetch('/api/froggpt/history');
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.sessions && data.sessions.length > 0) {
                itemsContainer.innerHTML = '';
                data.sessions.forEach(s => {
                    const btn = document.createElement('button');
                    btn.className = 'history-item-btn';
                    btn.style.width = '100%';
                    btn.style.background = 'rgba(255,255,255,0.03)';
                    btn.style.border = '1px solid rgba(255,255,255,0.08)';
                    btn.style.borderRadius = '8px';
                    btn.style.color = '#fff';
                    btn.style.padding = '8px';
                    btn.style.textAlign = 'left';
                    btn.style.cursor = 'pointer';
                    btn.style.fontSize = '0.78rem';
                    btn.style.transition = 'all 0.2s';
                    
                    btn.innerHTML = `
                        <div style="font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--color-mint);">${escapeHTML(s.summary)}</div>
                        <div style="font-size: 0.68rem; color: var(--color-text-dim); margin-top: 2px;">${s.updated_at}</div>
                    `;
                    
                    btn.onmouseover = () => {
                        btn.style.background = 'rgba(135,195,143,0.1)';
                        btn.style.borderColor = 'var(--color-mint)';
                    };
                    btn.onmouseout = () => {
                        btn.style.background = 'rgba(255,255,255,0.03)';
                        btn.style.borderColor = 'rgba(255,255,255,0.08)';
                    };
                    
                    btn.onclick = () => {
                        loadFrogGPTSession(s.id);
                    };
                    itemsContainer.appendChild(btn);
                });
            } else {
                itemsContainer.innerHTML = '<div style="font-size:0.75rem; color:var(--color-text-dim); text-align:center; padding: 10px;">No past sessions found.</div>';
            }
        } else {
            itemsContainer.innerHTML = '<div style="font-size:0.75rem; color:#ff595e; text-align:center; padding: 10px;">Failed to load history.</div>';
        }
    } catch (e) {
        console.error(e);
        itemsContainer.innerHTML = '<div style="font-size:0.75rem; color:#ff595e; text-align:center; padding: 10px;">Error loading history.</div>';
    }
}

function startNewFrogGPTSession() {
    frogGPTSessionId = null;
    const chatLog = document.getElementById('froggpt-chat-log');
    if (chatLog) {
        chatLog.innerHTML = `
            <div class="chat-message ai-message">
                <div class="chat-avatar">🐸</div>
                <div class="chat-bubble">
                    <p>Ribbit! Ready to start a brand new study session. Ask me anything, or import document notes using the paperclip button!</p>
                </div>
            </div>
        `;
    }
    const listOverlay = document.getElementById('froggpt-history-list');
    if (listOverlay) listOverlay.classList.add('hidden');
    showStudyPanelPlaceholder();
}

async function loadFrogGPTSession(sessionId) {
    const listOverlay = document.getElementById('froggpt-history-list');
    if (listOverlay) listOverlay.classList.add('hidden');

    const chatLog = document.getElementById('froggpt-chat-log');
    if (chatLog) {
        chatLog.innerHTML = '<div style="font-size:0.85rem; color:var(--color-text-dim); text-align:center; padding: 20px;">🐸 Lily is retrieving your session details...</div>';
    }

    try {
        const res = await fetch(`/api/froggpt/history/${sessionId}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.events) {
                frogGPTSessionId = sessionId;
                chatLog.innerHTML = '';
                
                if (data.events.length === 0) {
                    startNewFrogGPTSession();
                    return;
                }

                data.events.forEach(ev => {
                    const msgElem = document.createElement('div');
                    if (ev.author === 'user') {
                        msgElem.className = 'chat-message user-message';
                        msgElem.innerHTML = `
                            <div class="chat-avatar">👤</div>
                            <div class="chat-bubble">
                                <p>${escapeHTML(ev.text)}</p>
                            </div>
                        `;
                    } else {
                        msgElem.className = 'chat-message ai-message';
                        
                        let formattedHTML = '';
                        if (typeof marked !== 'undefined') {
                            formattedHTML = marked.parse(ev.text || '');
                        } else {
                            formattedHTML = `<p>${escapeHTML(ev.text || '')}</p>`;
                        }

                        let actionBtnHTML = '';
                        if (ev.structured_data && ev.subagent_author) {
                            const deckJsonId = `deck-data-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                            window[deckJsonId] = ev.structured_data;
                            actionBtnHTML = `
                                <div style="margin-top: 10px;">
                                    <button class="btn btn-primary btn-sm" onclick="loadWidgetFromWindow('${deckJsonId}', '${ev.subagent_author}')" style="background: var(--color-mint); border: none; color: var(--bg-dark); font-weight: bold; padding: 6px 12px; border-radius: 8px; cursor: pointer;">
                                        🎯 Open in Study Panel
                                    </button>
                                </div>
                            `;
                        }

                        msgElem.innerHTML = `
                            <div class="chat-avatar">🐸</div>
                            <div class="chat-bubble">
                                ${formattedHTML}
                                ${actionBtnHTML}
                            </div>
                        `;
                    }
                    chatLog.appendChild(msgElem);
                });
                chatLog.scrollTop = chatLog.scrollHeight;
            } else {
                alert('Could not retrieve conversation history.');
            }
        } else {
            alert('Failed to retrieve history from backend.');
        }
    } catch (e) {
        console.error(e);
        alert('Error fetching session history.');
    }
}

// --- STUDY PANEL MODALS & NEW TASK ACTIONS ---
function openAddTaskModal(datePrefill = null) {
    const modal = document.getElementById('add-task-modal');
    const form = document.getElementById('task-form');
    if (!modal) return;
    
    // Reset form
    form.reset();
    document.getElementById('edit-task-id').value = '';
    document.getElementById('modal-title').textContent = 'New Task Details';
    document.getElementById('btn-save-task').textContent = 'Save Task';
    
    // Default Date prefill (Mock current date or today)
    const todayStr = '2026-06-22';
    document.getElementById('task-due-date-modal').value = datePrefill || todayStr;
    
    // Hide Custom Category Inputs
    const customGroup = document.getElementById('custom-category-group');
    if (customGroup) customGroup.classList.add('hidden');
    
    modal.classList.add('open');
}

function closeAddTaskModal() {
    const modal = document.getElementById('add-task-modal');
    if (modal) modal.classList.remove('open');
}

window.openAddTaskModal = openAddTaskModal;
window.closeAddTaskModal = closeAddTaskModal;

window.handleCategorySelectChange = function(value) {
    const customGroup = document.getElementById('custom-category-group');
    if (!customGroup) return;
    if (value === '__add_new__') {
        customGroup.classList.remove('hidden');
        const input = document.getElementById('custom-category-name');
        if (input) input.focus();
    } else {
        customGroup.classList.add('hidden');
    }
};

window.saveCustomCategory = function() {
    const input = document.getElementById('custom-category-name');
    if (!input) return;
    const catName = input.value.trim();
    
    if (!catName) return;
    
    const exists = ['school', 'work', ...customCategories.map(c => c.toLowerCase())].includes(catName.toLowerCase());
    if (exists) {
        alert('This category already exists, ribbit!');
        return;
    }
    
    customCategories.push(catName);
    localStorage.setItem('froggy_custom_categories', JSON.stringify(customCategories));
    populateCategoryDropdowns();
    
    // Select the new category in the form
    const formSelect = document.getElementById('task-category-modal');
    if (formSelect) formSelect.value = catName;
    
    const customGroup = document.getElementById('custom-category-group');
    if (customGroup) customGroup.classList.add('hidden');
    input.value = '';
};

window.handleCalendarCategorySelectChange = function(value) {
    const customGroup = document.getElementById('cal-custom-category-group');
    if (!customGroup) return;
    if (value === '__add_new__') {
        customGroup.classList.remove('hidden');
        const input = document.getElementById('cal-custom-category-name');
        if (input) input.focus();
    } else {
        customGroup.classList.add('hidden');
    }
};

window.saveCalendarCustomCategory = function() {
    const input = document.getElementById('cal-custom-category-name');
    if (!input) return;
    const catName = input.value.trim();
    
    if (!catName) return;
    
    const exists = ['school', 'work', ...customCategories.map(c => c.toLowerCase())].includes(catName.toLowerCase());
    if (exists) {
        alert('This category already exists, ribbit!');
        return;
    }
    
    customCategories.push(catName);
    localStorage.setItem('froggy_custom_categories', JSON.stringify(customCategories));
    populateCategoryDropdowns();
    
    // Select the new category in the form
    const calCatSelect = document.getElementById('cal-item-category');
    if (calCatSelect) {
        calCatSelect.value = catName;
    }
    const customGroup = document.getElementById('cal-custom-category-group');
    if (customGroup) customGroup.classList.add('hidden');
    input.value = '';
};

window.editTask = function(id) {
    const task = allTasks.find(t => (t.id + '') === (id + ''));
    if (!task) return;
    
    openAddTaskModal();
    
    document.getElementById('edit-task-id').value = task.id;
    document.getElementById('modal-title').textContent = 'Edit Task';
    document.getElementById('btn-save-task').textContent = 'Save Changes';
    
    document.getElementById('task-title').value = task.title || '';
    document.getElementById('task-due-date-modal').value = task.due_date || '2026-06-22';
    document.getElementById('task-urgency-modal').value = task.urgency || 'medium';
    
    populateCategoryDropdowns();
    const selectEl = document.getElementById('task-category-modal');
    if (selectEl) selectEl.value = task.category || 'School';
    document.getElementById('task-notes').value = task.notes || '';
};

window.handleFormSubmit = async function(e) {
    e.preventDefault();
    
    const editId = document.getElementById('edit-task-id').value;
    const title = document.getElementById('task-title').value.trim();
    const dueDate = document.getElementById('task-due-date-modal').value || null;
    const urgency = document.getElementById('task-urgency-modal').value || 'medium';
    let category = document.getElementById('task-category-modal').value || 'School';
    const notes = document.getElementById('task-notes').value.trim() || null;
    
    if (!title) return;

    if (editId) {
        // Edit Mode
        if (isLoggedIn) {
            try {
                const response = await fetch(`/api/tasks/${editId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: title,
                        due_date: dueDate,
                        category: category,
                        urgency: urgency,
                        notes: notes
                    })
                });
                if (response.ok) {
                    closeAddTaskModal();
                    fetchTasks();
                }
            } catch (err) {
                console.error("Error updating task:", err);
            }
        } else {
            const tasks = getLocalTasks();
            const taskIndex = tasks.findIndex(t => (t.id + '') === (editId + ''));
            if (taskIndex !== -1) {
                tasks[taskIndex] = {
                    ...tasks[taskIndex],
                    title,
                    due_date: dueDate,
                    category,
                    urgency,
                    notes
                };
                saveLocalTasks(tasks);
                closeAddTaskModal();
                fetchTasks();
            }
        }
    } else {
        // Add Mode
        if (isLoggedIn) {
            try {
                const response = await fetch('/api/tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        title,
                        due_date: dueDate,
                        category,
                        urgency,
                        notes
                    })
                });
                if (response.ok) {
                    closeAddTaskModal();
                    speak('taskAdded');
                    fetchTasks();
                }
            } catch (err) {
                console.error("Error adding task:", err);
            }
        } else {
            const tasks = getLocalTasks();
            const newTask = {
                id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                title,
                completed: false,
                created_at: new Date().toISOString(),
                due_date: dueDate,
                category,
                urgency,
                notes
            };
            tasks.unshift(newTask);
            saveLocalTasks(tasks);
            closeAddTaskModal();
            speak('taskAdded');
            fetchTasks();
        }
    }
};


// --- LEFT PANEL TAB SWITCHING ---
window.switchLeftPanel = function(tabName) {
    document.querySelectorAll('.panel-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = 'var(--color-text-dim)';
    });
    
    const activeBtn = document.getElementById(`tab-left-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.borderBottomColor = 'var(--color-sage)';
        activeBtn.style.color = 'var(--color-cream)';
    }
    
    if (tabName === 'timer') {
        document.getElementById('timer-inner-content').classList.remove('hidden');
        document.getElementById('games-inner-content').classList.add('hidden');
    } else {
        document.getElementById('timer-inner-content').classList.add('hidden');
        document.getElementById('games-inner-content').classList.remove('hidden');
        initGamesMenu();
    }
};


// --- STUDY GAMES SYSTEM ---
let gamesList = [];
let currentGameSet = null;
let currentActiveGame = null; // 'matching' or 'blaster'

// Seeding/loading default sets
function loadFlashcardSets() {
    let savedDecks = [];
    try {
        savedDecks = JSON.parse(localStorage.getItem('saved_flashcard_decks'));
        if (!Array.isArray(savedDecks)) {
            savedDecks = [];
        }
    } catch (e) {
        savedDecks = [];
    }
    
    const defaultSets = [
        {
            id: 'set-froggy-biology',
            title: '🐸 Froggy Biology',
            cards: [
                { question: 'Amphibian', answer: 'An ectothermic vertebrate that transitions from water to land' },
                { question: 'Tadpole', answer: 'The aquatic larval stage of a frog with gills and a tail' },
                { question: 'Metamorphosis', answer: 'The developmental process of transforming from larva to adult' },
                { question: 'Ectothermic', answer: 'Cold-blooded; relying on the external environment for body heat' },
                { question: 'Permeable Skin', answer: 'Skin that allows water and oxygen to absorb directly' },
                { question: 'Hibernation', answer: 'State of dormancy in mud at the bottom of ponds during winter' }
            ]
        },
        {
            id: 'set-web-dev',
            title: '💻 Web Development',
            cards: [
                { question: 'HTML', answer: 'Markup language used to structure web pages' },
                { question: 'CSS', answer: 'Stylesheets used to design page presentation and layout' },
                { question: 'JavaScript', answer: 'Programming language that adds behavior and interactivity' },
                { question: 'DOM', answer: 'Document Object Model; the API to interact with HTML nodes' },
                { question: 'localStorage', answer: 'Web storage API that persists key-value pairs in the browser' },
                { question: 'API', answer: 'Application Programming Interface; a protocol for apps to communicate' }
            ]
        }
    ];

    let modified = false;
    defaultSets.forEach(defSet => {
        const exists = savedDecks.some(d => d.id === defSet.id);
        if (!exists) {
            savedDecks.push(defSet);
            modified = true;
        }
    });

    if (modified || savedDecks.length === 0) {
        if (savedDecks.length === 0) {
            savedDecks = defaultSets;
        }
        localStorage.setItem('saved_flashcard_decks', JSON.stringify(savedDecks));
    }
    return savedDecks;
}

/* --- Study Materials Quizzes, Tests, and Guides loaders and savers --- */
function loadSavedQuizzes() {
    try {
        const q = JSON.parse(localStorage.getItem('saved_quizzes'));
        return Array.isArray(q) ? q : [];
    } catch(e) { return []; }
}
function loadSavedTests() {
    try {
        const t = JSON.parse(localStorage.getItem('saved_tests'));
        return Array.isArray(t) ? t : [];
    } catch(e) { return []; }
}
function loadSavedGuides() {
    try {
        const g = JSON.parse(localStorage.getItem('saved_study_guides'));
        return Array.isArray(g) ? g : [];
    } catch(e) { return []; }
}

function saveQuizToLibrary(quiz) {
    let saved = loadSavedQuizzes();
    const newQuiz = {
        id: `quiz-${Date.now()}`,
        timestamp: new Date().toISOString(),
        title: quiz.title || 'Untitled Quiz',
        questions: quiz.questions || []
    };
    saved.push(newQuiz);
    localStorage.setItem('saved_quizzes', JSON.stringify(saved));
    alert('Quiz saved successfully to your Study Materials Library! 📝');
}
function saveTestToLibrary(test) {
    let saved = loadSavedTests();
    const newTest = {
        id: `test-${Date.now()}`,
        timestamp: new Date().toISOString(),
        title: test.title || 'Untitled Practice Test',
        true_false: test.true_false || [],
        multiple_choice: test.multiple_choice || [],
        short_answer: test.short_answer || []
    };
    saved.push(newTest);
    localStorage.setItem('saved_tests', JSON.stringify(saved));
    alert('Practice Test saved successfully to your Study Materials Library! ✍️');
}
function saveGuideToLibrary(guide) {
    let saved = loadSavedGuides();
    const newGuide = {
        id: `guide-${Date.now()}`,
        timestamp: new Date().toISOString(),
        title: guide.title || 'Untitled Study Guide',
        overview: guide.overview || '',
        sections: guide.sections || [],
        summary: guide.summary || ''
    };
    saved.push(newGuide);
    localStorage.setItem('saved_study_guides', JSON.stringify(saved));
    alert('Study Guide saved successfully to your Study Materials Library! 📚');
}

function loadSavedNotes() {
    try {
        const n = JSON.parse(localStorage.getItem('saved_note_agent_notes'));
        return Array.isArray(n) ? n : [];
    } catch(e) { return []; }
}

function saveNoteToLocalStorage(note) {
    let saved = loadSavedNotes();
    const newNote = {
        id: `note-${Date.now()}`,
        timestamp: new Date().toISOString(),
        title: note.title,
        type: note.type,
        transcript: note.transcript,
        notes: note.notes
    };
    saved.unshift(newNote);
    localStorage.setItem('saved_note_agent_notes', JSON.stringify(saved));
}

function renderStudyGuide(container, guide, isLibraryView = false) {
    const sections = guide.sections || [];
    if (sections.length === 0) {
        container.innerHTML = '<p>No sections available in this study guide.</p>';
        return;
    }

    const sectionsHTML = sections.map((sect, sIdx) => {
        const conceptsHTML = sect.key_concepts ? sect.key_concepts.map(c => `
            <div class="guide-concept-item" style="background: rgba(255,255,255,0.03); border: 1px solid var(--panel-border); border-radius: 10px; padding: 10px; margin-top: 6px;">
                <div style="font-weight: bold; color: var(--color-mint); font-size: 0.85rem;">🔑 ${escapeHTML(c.term)}</div>
                <div style="font-size: 0.8rem; margin-top: 4px; line-height: 1.4; color: var(--color-cream);">${escapeHTML(c.definition)}</div>
                ${c.example ? `<div style="font-size: 0.75rem; color: var(--color-sage); margin-top: 4px; font-style: italic;">e.g., ${escapeHTML(c.example)}</div>` : ''}
            </div>
        `).join('') : '';

        const bulletsHTML = sect.bullet_points ? sect.bullet_points.map(bp => `
            <li style="font-size: 0.82rem; color: var(--color-cream); margin-top: 4px; line-height: 1.4;">${escapeHTML(bp)}</li>
        `).join('') : '';

        return `
            <div class="guide-section" style="border-left: 2px solid var(--color-sage); padding-left: 14px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 6px 0; color: var(--color-cream); font-family: var(--font-heading); font-size: 1.05rem;">${sIdx + 1}. ${escapeHTML(sect.heading)}</h4>
                <p style="font-size: 0.82rem; color: var(--color-text-dim); margin: 0 0 10px 0; line-height: 1.4;">${escapeHTML(sect.summary)}</p>
                
                ${sect.key_concepts && sect.key_concepts.length > 0 ? `
                    <div style="margin-top: 8px;">
                        <span style="font-size: 0.72rem; font-weight: 700; color: var(--color-sage); text-transform: uppercase;">Key Concepts</span>
                        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 2px;">
                            ${conceptsHTML}
                        </div>
                    </div>
                ` : ''}
                
                ${sect.bullet_points && sect.bullet_points.length > 0 ? `
                    <div style="margin-top: 10px;">
                        <span style="font-size: 0.72rem; font-weight: 700; color: var(--color-sage); text-transform: uppercase;">Important Notes</span>
                        <ul style="margin: 4px 0 0 0; padding-left: 16px;">
                            ${bulletsHTML}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="study-guide-widget" style="display: flex; flex-direction: column; gap: 16px; text-align: left;">
            <div class="widget-title-bar" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px; margin-bottom: 12px;">
                <h4 style="margin:0;">📚 ${escapeHTML(guide.title)}</h4>
                ${!isLibraryView ? `<button class="btn btn-primary btn-sm btn-save-guide" style="background: var(--color-sage); border-color: var(--panel-border); color: #fff; font-size: 0.78rem; padding: 4px 10px; border-radius: 8px; cursor: pointer;">Save to Library</button>` : ''}
            </div>
            
            <p class="guide-overview" style="font-style: italic; color: var(--color-text-dim); line-height: 1.4; margin: 0;">${escapeHTML(guide.overview)}</p>
            
            <div class="guide-sections-list" style="display: flex; flex-direction: column; gap: 20px; margin-top: 10px;">
                ${sectionsHTML}
            </div>
            
            ${guide.summary ? `
                <div class="guide-summary-box" style="margin-top: 15px; padding: 12px; background: rgba(135,195,143,0.06); border: 1px solid rgba(135,195,143,0.15); border-radius: 12px; text-align: left;">
                    <div style="font-weight: bold; color: var(--color-mint); font-size: 0.85rem; margin-bottom: 4px;">📝 Key Takeaways</div>
                    <p style="font-size: 0.82rem; color: var(--color-cream); margin: 0; line-height: 1.4;">${escapeHTML(guide.summary)}</p>
                </div>
            ` : ''}
        </div>
    `;

    if (!isLibraryView) {
        const saveBtn = container.querySelector('.btn-save-guide');
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                saveGuideToLibrary(guide);
                saveBtn.style.background = 'rgba(255,255,255,0.1)';
                saveBtn.innerText = 'Saved! ✓';
                saveBtn.setAttribute('disabled', 'true');
            });
        }
    }
}

function initGamesMenu() {
    gamesList = loadFlashcardSets();
    const dropdown = document.getElementById('game-set-select');
    if (!dropdown) return;
    
    dropdown.innerHTML = '';
    gamesList.forEach(set => {
        const opt = document.createElement('option');
        opt.value = set.id;
        opt.textContent = `${set.title} (${set.cards.length} cards)`;
        dropdown.appendChild(opt);
    });
    
    showView('game-menu-view');
}

function showView(viewId) {
    const views = [
        'game-menu-view',
        'game-matching-view',
        'game-blaster-setup-view',
        'game-blaster-play-view',
        'game-results-view'
    ];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) {
            if (v === viewId) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    });
}

window.exitGame = function() {
    cleanupBlasterGame();
    cleanupMatchingGame();
    showView('game-menu-view');
};


// --- MATCHING GAME LOGIC ---
let matchingTimerInterval = null;
let matchingStartTime = 0;
let matchingSelectedCard = null;
let matchingPairsLeft = 0;

window.startMatchingGame = function() {
    const selectEl = document.getElementById('game-set-select');
    if (!selectEl) return;
    const setId = selectEl.value;
    currentGameSet = gamesList.find(s => s.id === setId);
    
    if (!currentGameSet || currentGameSet.cards.length < 3) {
        alert("You need at least 3 cards in your deck to play matching, ribbit!");
        return;
    }
    
    currentActiveGame = 'matching';
    showView('game-matching-view');
    restartMatchingGame();
};

window.restartMatchingGame = function() {
    cleanupMatchingGame();
    
    const container = document.getElementById('matching-grid-container');
    if (!container) return;
    container.innerHTML = '';
    
    // Get up to 6 cards (12 elements) to fit nicely in 3 columns
    const cardsToUse = currentGameSet.cards.slice(0, 6);
    matchingPairsLeft = cardsToUse.length;
    
    let items = [];
    cardsToUse.forEach((card, idx) => {
        items.push({
            id: `concept-${idx}`,
            text: card.question || card.term,
            type: 'concept',
            matchId: idx
        });
        items.push({
            id: `def-${idx}`,
            text: card.answer || card.definition,
            type: 'definition',
            matchId: idx
        });
    });
    
    // Shuffle
    items.sort(() => Math.random() - 0.5);
    
    items.forEach(item => {
        const cardEl = document.createElement('div');
        cardEl.className = 'matching-card';
        cardEl.textContent = item.text;
        cardEl.dataset.type = item.type;
        cardEl.dataset.matchId = item.matchId;
        cardEl.dataset.id = item.id;
        cardEl.onclick = () => handleMatchingCardClick(cardEl);
        container.appendChild(cardEl);
    });
    
    // Timer
    const timerDisplay = document.getElementById('match-timer');
    if (timerDisplay) timerDisplay.textContent = '⏱️ 0.0s';
    
    // Best Time
    const bestScore = localStorage.getItem(`high_score_match_${currentGameSet.id}`) || '--';
    const bestDisplay = document.getElementById('match-high-score');
    if (bestDisplay) bestDisplay.textContent = `🏆 Best: ${bestScore}s`;
    
    matchingStartTime = performance.now();
    matchingTimerInterval = setInterval(() => {
        const elapsed = (performance.now() - matchingStartTime) / 1000;
        if (timerDisplay) timerDisplay.textContent = `⏱️ ${elapsed.toFixed(1)}s`;
    }, 100);
};

function handleMatchingCardClick(cardEl) {
    if (cardEl.classList.contains('matched') || cardEl.classList.contains('selected')) return;
    
    // Select first card
    if (!matchingSelectedCard) {
        matchingSelectedCard = cardEl;
        cardEl.classList.add('selected');
        return;
    }
    
    // Already selected this card
    if (matchingSelectedCard === cardEl) return;
    
    const card1 = matchingSelectedCard;
    const card2 = cardEl;
    
    // Check if match
    if (card1.dataset.matchId === card2.dataset.matchId && card1.dataset.type !== card2.dataset.type) {
        // MATCH!
        card1.classList.remove('selected');
        card1.classList.add('matched');
        card2.classList.add('matched');
        matchingSelectedCard = null;
        matchingPairsLeft--;
        
        playRibbit();
        
        if (matchingPairsLeft === 0) {
            // Victory!
            clearInterval(matchingTimerInterval);
            const scoreTime = ((performance.now() - matchingStartTime) / 1000).toFixed(1);
            showMatchingVictory(scoreTime);
        }
    } else {
        // MISMATCH!
        card2.classList.add('selected');
        card1.classList.add('wrong');
        card2.classList.add('wrong');
        
        matchingSelectedCard = null;
        
        setTimeout(() => {
            card1.classList.remove('selected', 'wrong');
            card2.classList.remove('selected', 'wrong');
        }, 600);
    }
}

function showMatchingVictory(scoreTime) {
    const resultsEmoji = document.getElementById('results-emoji');
    const resultsTitle = document.getElementById('results-title');
    const resultsMessage = document.getElementById('results-message');
    const curVal = document.getElementById('results-val-current');
    const bestVal = document.getElementById('results-val-best');
    const replayBtn = document.getElementById('btn-replay');
    
    if (resultsEmoji) resultsEmoji.textContent = '🏆';
    if (resultsTitle) resultsTitle.textContent = 'Victory!';
    if (resultsMessage) resultsMessage.textContent = `Excellent job! You matched all pairs in the deck "${currentGameSet.title}"!`;
    
    if (curVal) curVal.textContent = `${scoreTime}s`;
    
    const key = `high_score_match_${currentGameSet.id}`;
    let best = localStorage.getItem(key);
    if (!best || parseFloat(scoreTime) < parseFloat(best)) {
        localStorage.setItem(key, scoreTime);
        best = scoreTime;
        if (resultsTitle) resultsTitle.textContent = 'New High Score! 🌟';
    }
    
    if (bestVal) bestVal.textContent = `${best}s`;
    
    if (replayBtn) replayBtn.onclick = () => restartMatchingGame();
    
    showView('game-results-view');
}

function cleanupMatchingGame() {
    if (matchingTimerInterval) {
        clearInterval(matchingTimerInterval);
        matchingTimerInterval = null;
    }
    matchingSelectedCard = null;
}


// --- BLASTER GAME LOGIC ---
let blasterPromptMode = 'def-to-concept'; // def-to-concept or concept-to-def
let blasterScore = 0;
let blasterLives = 3;
let blasterCurrentIndex = 0;
let blasterActiveTargets = [];
let blasterActiveBullets = [];
let blasterActiveSplashes = [];
let blasterTargetSpeed = 1.0;
let blasterBulletSpeed = 6.0;
let blasterFrogX = 50; // percentage 5-95
let blasterGameLoopId = null;
let blasterLastTime = 0;
let blasterKeyStates = { ArrowLeft: false, ArrowRight: false, KeyA: false, KeyD: false };
let blasterQuestionSet = [];
let blasterSpawnTimer = 0;

window.setupBlasterGame = function() {
    const selectEl = document.getElementById('game-set-select');
    if (!selectEl) return;
    const setId = selectEl.value;
    currentGameSet = gamesList.find(s => s.id === setId);
    
    if (!currentGameSet || currentGameSet.cards.length === 0) {
        alert("Select a valid deck to play, ribbit!");
        return;
    }
    
    showView('game-blaster-setup-view');
};

window.startBlasterGame = function() {
    const modeEl = document.querySelector('input[name="blaster-prompt-mode"]:checked');
    blasterPromptMode = modeEl ? modeEl.value : 'def-to-concept';
    
    blasterScore = 0;
    blasterLives = 3;
    blasterCurrentIndex = 0;
    
    currentActiveGame = 'blaster';
    
    // Shuffle cards for questions
    blasterQuestionSet = [...currentGameSet.cards].sort(() => Math.random() - 0.5);
    
    // Reset key states
    blasterKeyStates = { ArrowLeft: false, ArrowRight: false, KeyA: false, KeyD: false };
    
    showView('game-blaster-play-view');
    initBlasterControls();
    loadBlasterQuestion();
    
    // Start loop
    blasterLastTime = performance.now();
    blasterSpawnTimer = 0;
    if (blasterGameLoopId) cancelAnimationFrame(blasterGameLoopId);
    blasterGameLoopId = requestAnimationFrame(blasterGameLoop);
};

function initBlasterControls() {
    // Unbind previous just in case
    const arena = document.getElementById('blaster-arena');
    if (!arena) return;
    
    arena.removeEventListener('mousemove', handleBlasterMouseMove);
    arena.removeEventListener('click', handleBlasterMouseClick);
    window.removeEventListener('keydown', handleBlasterKeyDown);
    window.removeEventListener('keyup', handleBlasterKeyUp);
    
    arena.addEventListener('mousemove', handleBlasterMouseMove);
    arena.addEventListener('click', handleBlasterMouseClick);
    window.addEventListener('keydown', handleBlasterKeyDown);
    window.addEventListener('keyup', handleBlasterKeyUp);
}

function handleBlasterMouseMove(e) {
    const arena = document.getElementById('blaster-arena');
    if (!arena) return;
    const rect = arena.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    blasterFrogX = Math.max(5, Math.min(95, (relativeX / rect.width) * 100));
}

function handleBlasterMouseClick(e) {
    e.preventDefault();
    fireBlasterBullet(e);
}

function handleBlasterKeyDown(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        blasterKeyStates.ArrowLeft = true;
        e.preventDefault();
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        blasterKeyStates.ArrowRight = true;
        e.preventDefault();
    }
    if (e.code === 'Space') {
        fireBlasterBullet(); // Fires vertically up
        e.preventDefault();
    }
}

function handleBlasterKeyUp(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        blasterKeyStates.ArrowLeft = false;
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        blasterKeyStates.ArrowRight = false;
    }
}

function fireBlasterBullet(clickEvent = null) {
    const arena = document.getElementById('blaster-arena');
    if (!arena) return;
    const arenaWidth = arena.clientWidth;
    const arenaHeight = arena.clientHeight;
    
    const frogX_px = (blasterFrogX / 100) * arenaWidth;
    
    const bulletEl = document.createElement('div');
    bulletEl.className = 'blaster-bullet';
    bulletEl.textContent = '💧';
    
    const layer = document.getElementById('blaster-objects-layer');
    if (layer) {
        layer.appendChild(bulletEl);
        bulletEl.style.left = `${frogX_px}px`;
        bulletEl.style.top = `${arenaHeight - 40}px`;
        
        let vx = 0;
        let vy = -blasterBulletSpeed;
        
        if (clickEvent) {
            const rect = arena.getBoundingClientRect();
            const clickX = clickEvent.clientX - rect.left;
            const clickY = clickEvent.clientY - rect.top;
            
            const dx = clickX - frogX_px;
            const dy = clickY - (arenaHeight - 40);
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;
            
            vx = (dx / dist) * blasterBulletSpeed;
            vy = (dy / dist) * blasterBulletSpeed;
        }
        
        blasterActiveBullets.push({
            element: bulletEl,
            x: frogX_px,
            y: arenaHeight - 40,
            vx: vx,
            vy: vy
        });
    }
}

function loadBlasterQuestion() {
    const questionBox = document.getElementById('blaster-question-box');
    const layer = document.getElementById('blaster-objects-layer');
    if (!questionBox || !layer) return;
    
    // Remove previous targets
    blasterActiveTargets.forEach(t => t.element.remove());
    blasterActiveTargets = [];
    blasterActiveBullets.forEach(b => b.element.remove());
    blasterActiveBullets = [];
    
    updateBlasterStatsDisplay();
    
    if (blasterCurrentIndex >= blasterQuestionSet.length) {
        // Victory!
        endBlasterGame(true);
        return;
    }
    
    const currentCard = blasterQuestionSet[blasterCurrentIndex];
    const isDefPrompt = blasterPromptMode === 'def-to-concept';
    
    const questionText = isDefPrompt ? (currentCard.answer || currentCard.definition) : (currentCard.question || currentCard.term);
    const correctAnswerText = isDefPrompt ? (currentCard.question || currentCard.term) : (currentCard.answer || currentCard.definition);
    
    questionBox.innerHTML = `<strong>AIM & BLAST:</strong> ${escapeHTML(questionText)}`;
    
    // Choose 2 other incorrect options for floating choices
    const otherCards = currentGameSet.cards.filter(c => c !== currentCard);
    const shuffledOthers = otherCards.sort(() => Math.random() - 0.5).slice(0, 2);
    
    const options = [correctAnswerText];
    shuffledOthers.forEach(c => {
        options.push(isDefPrompt ? (c.question || c.term) : (c.answer || c.definition));
    });
    
    // Shuffle options order
    options.sort(() => Math.random() - 0.5);
    
    // Spawn targets
    const arenaWidth = document.getElementById('blaster-arena').clientWidth;
    const spacing = arenaWidth / (options.length + 1);
    
    options.forEach((optText, index) => {
        const targetEl = document.createElement('div');
        targetEl.className = 'blaster-target';
        targetEl.innerHTML = optText;
        layer.appendChild(targetEl);
        
        const isCorrect = optText === correctAnswerText;
        const targetWidth = targetEl.offsetWidth || 120;
        
        const initialX = spacing * (index + 1) - (targetWidth / 2);
        const initialY = -40 - (Math.random() * 50); // staggered starting heights
        
        targetEl.style.left = `${initialX}px`;
        targetEl.style.top = `${initialY}px`;
        
        blasterActiveTargets.push({
            element: targetEl,
            x: initialX,
            y: initialY,
            width: targetWidth,
            height: targetEl.offsetHeight || 36,
            text: optText,
            isCorrect: isCorrect,
            speedY: 0.7 + (Math.random() * 0.4) // staggered drift speeds
        });
    });
}

function blasterGameLoop(timestamp) {
    if (currentActiveGame !== 'blaster') return;
    
    // Keyboard movement
    const frogEl = document.getElementById('blaster-frog');
    const arena = document.getElementById('blaster-arena');
    if (!arena || !frogEl) return;
    
    const arenaWidth = arena.clientWidth;
    const arenaHeight = arena.clientHeight;
    
    if (blasterKeyStates.ArrowLeft) {
        blasterFrogX = Math.max(5, blasterFrogX - 1.8);
    }
    if (blasterKeyStates.ArrowRight) {
        blasterFrogX = Math.min(95, blasterFrogX + 1.8);
    }
    
    // Update frog visual position
    frogEl.style.left = `${blasterFrogX}%`;
    
    // Update target locations
    blasterActiveTargets.forEach(target => {
        target.y += target.speedY;
        target.element.style.top = `${target.y}px`;
        target.height = target.element.offsetHeight || 36;
        
        // Re-read width/offset in case layout shifts
        target.width = target.element.offsetWidth || 120;
        
        // Check if target hit the bottom
        if (target.y > arenaHeight - 70) {
            // If correct hit bottom, lose a life
            if (target.isCorrect) {
                blasterLives--;
                speak('taskOverdue'); // play sad sound or cue
                if (blasterLives <= 0) {
                    endBlasterGame(false);
                    return;
                } else {
                    blasterCurrentIndex++;
                    loadBlasterQuestion();
                }
            } else {
                // Wrong targets just float out of range
                target.y = -50;
                target.element.style.top = `${target.y}px`;
            }
        }
    });
    
    // Update bullets
    for (let bIdx = blasterActiveBullets.length - 1; bIdx >= 0; bIdx--) {
        const bullet = blasterActiveBullets[bIdx];
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        bullet.element.style.left = `${bullet.x}px`;
        bullet.element.style.top = `${bullet.y}px`;
        
        let hit = false;
        
        // Collision checks
        for (let tIdx = 0; tIdx < blasterActiveTargets.length; tIdx++) {
            const target = blasterActiveTargets[tIdx];
            
            // Check bounding box
            if (bullet.x >= target.x && bullet.x <= target.x + target.width &&
                bullet.y >= target.y && bullet.y <= target.y + target.height) {
                
                hit = true;
                bullet.element.remove();
                blasterActiveBullets.splice(bIdx, 1);
                
                spawnSplash(bullet.x, bullet.y);
                
                if (target.isCorrect) {
                    // Correct!
                    target.element.classList.add('target-correct-hit');
                    blasterScore += 10;
                    playRibbit();
                    
                    setTimeout(() => {
                        blasterCurrentIndex++;
                        loadBlasterQuestion();
                    }, 400);
                } else {
                    // Incorrect hit
                    target.element.classList.add('target-wrong-hit');
                    blasterLives--;
                    
                    setTimeout(() => {
                        target.element.classList.remove('target-wrong-hit');
                    }, 400);
                    
                    if (blasterLives <= 0) {
                        endBlasterGame(false);
                        return;
                    }
                    updateBlasterStatsDisplay();
                }
                break;
            }
        }
        
        if (!hit && (bullet.y < 0 || bullet.x < 0 || bullet.x > arenaWidth || bullet.y > arenaHeight)) {
            bullet.element.remove();
            blasterActiveBullets.splice(bIdx, 1);
        }
    }
    
    // Update particle splashes
    for (let sIdx = blasterActiveSplashes.length - 1; sIdx >= 0; sIdx--) {
        const splash = blasterActiveSplashes[sIdx];
        splash.life -= 0.05;
        if (splash.life <= 0) {
            splash.element.remove();
            blasterActiveSplashes.splice(sIdx, 1);
        } else {
            splash.x += splash.vx;
            splash.y += splash.vy;
            splash.element.style.left = `${splash.x}px`;
            splash.element.style.top = `${splash.y}px`;
            splash.element.style.opacity = splash.life;
        }
    }
    
    blasterGameLoopId = requestAnimationFrame(blasterGameLoop);
}

function spawnSplash(x, y) {
    const layer = document.getElementById('blaster-objects-layer');
    if (!layer) return;
    
    for (let i = 0; i < 6; i++) {
        const particle = document.createElement('div');
        particle.className = 'splash-particle';
        layer.appendChild(particle);
        
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.0 + Math.random() * 2.0;
        
        const px = x;
        const py = y;
        
        particle.style.left = `${px}px`;
        particle.style.top = `${py}px`;
        
        blasterActiveSplashes.push({
            element: particle,
            x: px,
            y: py,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0
        });
    }
}

function updateBlasterStatsDisplay() {
    const scoreEl = document.getElementById('blaster-score');
    const livesEl = document.getElementById('blaster-lives');
    const progressEl = document.getElementById('blaster-progress');
    
    if (scoreEl) scoreEl.textContent = `Score: ${blasterScore}`;
    if (livesEl) {
        let flowerStr = '';
        for (let i = 0; i < blasterLives; i++) flowerStr += '🌸';
        for (let i = blasterLives; i < 3; i++) flowerStr += '🤍';
        livesEl.textContent = flowerStr;
    }
    if (progressEl) {
        const total = blasterQuestionSet.length;
        progressEl.textContent = `${Math.min(total, blasterCurrentIndex + 1)}/${total}`;
    }
}

function endBlasterGame(victory) {
    cleanupBlasterGame();
    
    const resultsEmoji = document.getElementById('results-emoji');
    const resultsTitle = document.getElementById('results-title');
    const resultsMessage = document.getElementById('results-message');
    const curVal = document.getElementById('results-val-current');
    const bestVal = document.getElementById('results-val-best');
    const replayBtn = document.getElementById('btn-replay');
    
    if (resultsEmoji) resultsEmoji.textContent = victory ? '🐸🏆' : '🍂💀';
    if (resultsTitle) resultsTitle.textContent = victory ? 'Victory!' : 'Game Over!';
    
    const deckTitle = currentGameSet ? currentGameSet.title : 'deck';
    if (resultsMessage) {
        resultsMessage.textContent = victory 
            ? `Fantastic! You blasted all correct answers in "${deckTitle}"!`
            : `Oh no! Lily ran out of flowers. Try reviewing the cards in "${deckTitle}" and replay!`;
    }
    
    if (curVal) curVal.textContent = blasterScore;
    
    const key = `high_score_blaster_${currentGameSet.id}`;
    let best = localStorage.getItem(key) || 0;
    if (blasterScore > parseInt(best)) {
        localStorage.setItem(key, blasterScore);
        best = blasterScore;
        if (victory && resultsTitle) resultsTitle.textContent = 'New High Score! 🌟';
    }
    
    if (bestVal) bestVal.textContent = best;
    
    if (replayBtn) replayBtn.onclick = () => startBlasterGame();
    
    showView('game-results-view');
}

function cleanupBlasterGame() {
    if (blasterGameLoopId) {
        cancelAnimationFrame(blasterGameLoopId);
        blasterGameLoopId = null;
    }
    
    const arena = document.getElementById('blaster-arena');
    if (arena) {
        arena.removeEventListener('mousemove', handleBlasterMouseMove);
        arena.removeEventListener('click', handleBlasterMouseClick);
    }
    window.removeEventListener('keydown', handleBlasterKeyDown);
    window.removeEventListener('keyup', handleBlasterKeyUp);
    
    // Clear DOM objects
    const layer = document.getElementById('blaster-objects-layer');
    if (layer) layer.innerHTML = '';
    
    blasterActiveTargets = [];
    blasterActiveBullets = [];
    blasterActiveSplashes = [];
}


// --- RESTORE ORIGINAL WINDOW EXPORTS ---
window.openFrogGPTModal = openFrogGPTModal;
window.closeFrogGPTModal = closeFrogGPTModal;
window.handleQuickPrompt = handleQuickPrompt;
window.handleFrogGPTSubmit = handleFrogGPTSubmit;
window.openFlashcardsLibraryModal = openFlashcardsLibraryModal;
window.closeFlashcardsLibraryModal = closeFlashcardsLibraryModal;
window.loadWidgetFromWindow = loadWidgetFromWindow;
window.showLibraryInPanel = showLibraryInPanel;
window.showStudyPanelPlaceholder = showStudyPanelPlaceholder;
window.playFlashcardDeckInPanel = playFlashcardDeckInPanel;
window.deleteFlashcardDeckInPanel = deleteFlashcardDeckInPanel;
window.handleFileUpload = handleFileUpload;
window.clearImportedDocument = clearImportedDocument;
window.getQueryCountForToday = getQueryCountForToday;
window.incrementQueryCount = incrementQueryCount;
window.updateQueryCounterUI = updateQueryCounterUI;
window.switchFrogGPTTab = switchFrogGPTTab;
window.toggleFrogGPTHistoryList = toggleFrogGPTHistoryList;
window.startNewFrogGPTSession = startNewFrogGPTSession;
window.loadFrogGPTSession = loadFrogGPTSession;


function deleteNoteInPanel(noteId) {
    if (confirm("Are you sure you want to delete this note from your library?")) {
        let notes = loadSavedNotes();
        notes = notes.filter(n => n.id !== noteId);
        localStorage.setItem('saved_note_agent_notes', JSON.stringify(notes));
        activeLibraryItemId = null;
        showLibraryInPanel();
    }
}

// Note Library Helper Exports
window.openNotesLibraryDirectly = function() {
    try {
        closeNoteAgentModal();
        openFlashcardsLibraryModal();
        setLibraryTab('notes');
    } catch(err) {
        console.error("openNotesLibraryDirectly error:", err);
        alert("❌ Error opening note library: " + err.message);
    }
};
window.deleteNoteInPanel = deleteNoteInPanel;
window.exportNoteFromLibrary = async function(noteId, event) {
    const notesList = loadSavedNotes();
    const note = notesList.find(n => n.id === noteId);
    if (!note) return;

    const format = document.getElementById('library-export-format').value;
    const btn = event ? event.currentTarget : null;
    const originalText = btn ? btn.innerHTML : '📥 Export File';
    if (btn) {
        btn.innerHTML = '⏳ Exporting...';
        btn.setAttribute('disabled', 'true');
    }

    try {
        const res = await fetch('/api/notes/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                notes: note.notes,
                format: format,
                filename: note.title.replace(/[^a-z0-9_]/gi, '_').toLowerCase()
            })
        });

        if (res.ok) {
            const data = await res.json();
            if (data.success && data.download_url) {
                window.location.href = data.download_url;
            } else {
                alert("❌ Export failed: " + (data.error || "Unknown error"));
            }
        } else {
            alert("❌ Export server error.");
        }
    } catch(e) {
        console.error(e);
        alert("❌ Network error exporting note.");
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.removeAttribute('disabled');
        }
    }
};

window.studyNotesWithFrogGPT = function(noteId, action) {
    try {
        const notesList = loadSavedNotes();
        const note = notesList.find(n => n.id === noteId);
        if (!note) {
            // Fallback: check if we are studying the active note agents preview before saving
            if (noteId === 'active' && generatedNotesMarkdown) {
                const filenameInput = document.getElementById('note-filename');
                const tempNote = {
                    title: filenameInput && filenameInput.value ? filenameInput.value : 'Active Audio Summary',
                    notes: generatedNotesMarkdown
                };
                triggerAction(tempNote);
            } else {
                alert("No active notes found to study!");
            }
            return;
        }
        triggerAction(note);

        function triggerAction(targetNote) {
            try {
                // Set imported notes context globally
                importedDocumentText = targetNote.notes || '';
                importedDocumentName = targetNote.title || 'Note Context';

                const badge = document.getElementById('froggpt-import-badge');
                const badgeText = document.getElementById('froggpt-import-badge-text');
                if (badgeText) {
                    badgeText.innerText = `📎 Notes Imported: ${escapeHTML(importedDocumentName)} (${importedDocumentText.length} chars)`;
                }
                if (badge) {
                    badge.classList.remove('hidden');
                }

                let promptText = '';
                if (action === 'flashcards') {
                    promptText = `Generate flashcards`;
                } else if (action === 'quiz') {
                    promptText = `Generate quiz`;
                } else if (action === 'test') {
                    promptText = `Generate practice test`;
                } else if (action === 'guide') {
                    promptText = `Generate study guide`;
                } else if (action === 'chat') {
                    promptText = `I want to ask you questions about these notes. Please give me a brief summary of the key points first, and then let me know you are ready to answer my questions!`;
                }

                // Close modal
                closeNoteAgentModal();

                // Close Library view inside frogGPT if open
                showStudyPanelPlaceholder();

                // Start a fresh frogGPT session to avoid task routing conflicts
                startNewFrogGPTSession();

                // Open frogGPT chat
                openFrogGPTModal();
                switchFrogGPTTab('chat');

                // Submit prompt
                setTimeout(() => {
                    try {
                        handleQuickPrompt(promptText);
                    } catch(promptErr) {
                        console.error("handleQuickPrompt failed:", promptErr);
                        alert("❌ handleQuickPrompt failed: " + promptErr.message);
                    }
                }, 300);
            } catch(triggerErr) {
                console.error("triggerAction error:", triggerErr);
                alert("❌ triggerAction error: " + triggerErr.message);
            }
        }
    } catch(err) {
        console.error("studyNotesWithFrogGPT error:", err);
        alert("❌ Error starting study session: " + err.message);
    }
};

// Cozy Arcade Tab Switcher
window.switchCozyArcadeGame = function(gameType) {
    document.querySelectorAll('.games-tabs-bar .panel-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = 'var(--color-text-dim)';
    });
    
    const activeBtn = document.getElementById(`tab-game-${gameType}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.borderBottomColor = 'var(--color-sage)';
        activeBtn.style.color = 'var(--color-cream)';
    }
    
    const container2048 = document.querySelector('.game-container-2048');
    const containerStudy = document.getElementById('games-inner-content');
    
    if (gameType === '2048') {
        if (container2048) container2048.classList.remove('hidden');
        if (containerStudy) containerStudy.classList.add('hidden');
        cleanupMatchingGame();
        cleanupBlasterGame();
    } else {
        if (container2048) container2048.classList.add('hidden');
        if (containerStudy) {
            containerStudy.classList.remove('hidden');
            initGamesMenu();
        }
    }
};
// --- FLASHCARD SET CREATION & EDIT MODAL ---
function openAddSetModal(setId = null) {
    const modal = document.getElementById('add-set-modal');
    const form = document.getElementById('set-form');
    if (!modal) return;
    
    form.reset();
    document.getElementById('edit-set-id').value = '';
    document.getElementById('set-modal-title').textContent = 'Create Flashcard Set';
    document.getElementById('btn-save-set').textContent = 'Save Set';
    
    const container = document.getElementById('set-cards-list-container');
    if (container) container.innerHTML = '';
    
    let savedDecks = loadFlashcardSets();
    
    if (setId) {
        // Edit Mode
        const deck = savedDecks.find(d => d.id === setId);
        if (deck) {
            document.getElementById('edit-set-id').value = deck.id;
            document.getElementById('set-modal-title').textContent = 'Edit Flashcard Set';
            document.getElementById('btn-save-set').textContent = 'Save Changes';
            document.getElementById('set-title').value = deck.title || '';
            document.getElementById('set-description').value = deck.description || '';
            
            if (deck.cards && deck.cards.length > 0) {
                deck.cards.forEach(card => {
                    addNewCardRow(card.question || card.term || '', card.answer || card.definition || '');
                });
            } else {
                for (let i = 0; i < 3; i++) addNewCardRow();
            }
        }
    } else {
        // Create Mode - Start with 3 blank card rows
        for (let i = 0; i < 3; i++) addNewCardRow();
    }
    
    modal.classList.add('open');
}

function closeAddSetModal() {
    const modal = document.getElementById('add-set-modal');
    if (modal) modal.classList.remove('open');
}

function addNewCardRow(term = '', definition = '') {
    const container = document.getElementById('set-cards-list-container');
    if (!container) return;
    
    const rowEl = document.createElement('div');
    rowEl.className = 'card-row';
    rowEl.style.display = 'flex';
    rowEl.style.gap = '8px';
    rowEl.style.alignItems = 'center';
    rowEl.style.width = '100%';
    
    const termInput = document.createElement('textarea');
    termInput.placeholder = 'Term / Concept';
    termInput.className = 'card-term-input';
    termInput.value = term;
    termInput.required = true;
    termInput.rows = 1;
    termInput.style.resize = 'none';
    termInput.style.overflowY = 'hidden';
    termInput.oninput = function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    };
    
    const defInput = document.createElement('textarea');
    defInput.placeholder = 'Definition / Answer';
    defInput.className = 'card-def-input';
    defInput.value = definition;
    defInput.required = true;
    defInput.rows = 1;
    defInput.style.resize = 'none';
    defInput.style.overflowY = 'hidden';
    defInput.oninput = function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-delete-row';
    deleteBtn.innerHTML = '✕';
    deleteBtn.onclick = function() {
        rowEl.remove();
        // Keep at least 2 rows
        const remaining = container.querySelectorAll('.card-row');
        if (remaining.length < 2) {
            addNewCardRow();
        }
    };
    
    rowEl.appendChild(termInput);
    rowEl.appendChild(defInput);
    rowEl.appendChild(deleteBtn);
    container.appendChild(rowEl);
    
    // Auto-adjust height on initialization
    setTimeout(() => {
        termInput.style.height = 'auto';
        termInput.style.height = termInput.scrollHeight + 'px';
        defInput.style.height = 'auto';
        defInput.style.height = defInput.scrollHeight + 'px';
    }, 20);
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function handleSetFormSubmit(e) {
    e.preventDefault();
    
    const editId = document.getElementById('edit-set-id').value;
    const title = document.getElementById('set-title').value.trim();
    const description = document.getElementById('set-description').value.trim();
    
    if (!title) return;
    
    const container = document.getElementById('set-cards-list-container');
    if (!container) return;
    
    const rows = container.querySelectorAll('.card-row');
    const cards = [];
    
    rows.forEach(row => {
        const term = row.querySelector('.card-term-input').value.trim();
        const def = row.querySelector('.card-def-input').value.trim();
        
        if (term && def) {
            cards.push({
                question: term,
                answer: def
            });
        }
    });
    
    if (cards.length < 2) {
        alert("Please provide at least 2 terms and definitions, ribbit!");
        return;
    }
    
    let savedDecks = loadFlashcardSets();
    
    if (editId) {
        // Edit Mode
        const idx = savedDecks.findIndex(d => d.id === editId);
        if (idx !== -1) {
            savedDecks[idx].title = title;
            savedDecks[idx].description = description;
            savedDecks[idx].cards = cards;
            savedDecks[idx].timestamp = new Date().toISOString();
        }
    } else {
        // Create Mode
        const newDeck = {
            id: 'deck_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title: title,
            description: description,
            cards: cards,
            timestamp: new Date().toISOString()
        };
        savedDecks.push(newDeck);
    }
    
    localStorage.setItem('saved_flashcard_decks', JSON.stringify(savedDecks));
    
    // Refresh Library UI
    showLibraryInPanel();
    
    // Close modal
    closeAddSetModal();
}

window.openAddSetModal = openAddSetModal;
window.closeAddSetModal = closeAddSetModal;
window.addNewCardRow = addNewCardRow;
window.handleSetFormSubmit = handleSetFormSubmit;

// --- FLASHCARD LIBRARY UTILITY EXPORTS ---
window.selectLibraryDeck = function(deckId) {
    activeLibraryDeckId = deckId;
    const searchInput = document.getElementById('library-deck-search');
    const query = searchInput ? searchInput.value : '';
    showLibraryInPanel(query);
};

window.handleLibrarySearch = function(query) {
    showLibraryInPanel(query);
};

window.playMatchingFromLibrary = function(deckId) {
    closeFlashcardsLibraryModal();
    openGamesModal();
    switchCozyArcadeGame('study');
    const selectEl = document.getElementById('game-set-select');
    if (selectEl) {
        selectEl.value = deckId;
    }
    startMatchingGame();
};

window.playBlasterFromLibrary = function(deckId) {
    closeFlashcardsLibraryModal();
    openGamesModal();
    switchCozyArcadeGame('study');
    const selectEl = document.getElementById('game-set-select');
    if (selectEl) {
        selectEl.value = deckId;
    }
    setupBlasterGame();
};

/* --- Note Agent (AI Note Taker) Logic --- */
let noteMediaRecorder = null;
let noteAudioChunks = [];
let noteIsRecording = false;
let noteTimerInterval = null;
let noteRecordedBlob = null;
let noteAudioFile = null;
var generatedNotesMarkdown = "";

function openNoteAgentModal() {
    closeCalendarModal();
    closeGamesModal();
    closeFrogGPTModal();
    
    const modal = document.getElementById('note-agent-modal');
    if (modal) {
        modal.classList.add('open');
        const btn = document.getElementById('btn-sidebar-notes');
        if (btn) btn.classList.add('active');
        
        // Update quota counter UI
        updateQueryCounterUI();
    }
}

function closeNoteAgentModal() {
    const modal = document.getElementById('note-agent-modal');
    if (modal) {
        modal.classList.remove('open');
    }
    const btn = document.getElementById('btn-sidebar-notes');
    if (btn) btn.classList.remove('active');
    
    // Stop recording if active
    if (noteIsRecording) {
        stopAudioRecording(true); // silent stop
    }
}

async function toggleAudioRecording() {
    if (!noteIsRecording) {
        await startAudioRecording();
    } else {
        stopAudioRecording(false);
    }
}

async function startAudioRecording() {
    noteAudioChunks = [];
    noteRecordedBlob = null;
    noteAudioFile = null;
    
    const recordStatus = document.getElementById('record-status');
    const recordTimer = document.getElementById('record-timer');
    const recordWave = document.getElementById('record-wave');
    const micBtn = document.getElementById('btn-record-mic');
    const fileNameSpan = document.getElementById('audio-file-name');
    
    if (fileNameSpan) fileNameSpan.textContent = '';
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        noteMediaRecorder = new MediaRecorder(stream);
        
        noteMediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                noteAudioChunks.push(event.data);
            }
        };
        
        noteMediaRecorder.onstop = () => {
            noteRecordedBlob = new Blob(noteAudioChunks, { type: 'audio/webm' });
            if (recordStatus) recordStatus.textContent = 'Audio recorded successfully! Ready to transcribe.';
            enableTranscribeBtn(true);
        };
        
        noteMediaRecorder.start();
        noteIsRecording = true;
        
        // Update UI
        if (micBtn) {
            micBtn.style.background = '#ff595e';
            micBtn.style.boxShadow = '0 0 20px rgba(255,89,94,0.4)';
        }
        if (recordStatus) recordStatus.textContent = 'Recording live...';
        if (recordWave) recordWave.classList.remove('hidden');
        if (recordTimer) {
            recordTimer.style.display = 'block';
            recordTimer.textContent = '00:00';
        }
        
        let seconds = 0;
        noteTimerInterval = setInterval(() => {
            seconds++;
            const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
            const secs = String(seconds % 60).padStart(2, '0');
            if (recordTimer) recordTimer.textContent = `${mins}:${secs}`;
            
            // Calculate remaining minutes based on daily quota left (5 minutes per remaining call)
            const quotaData = getQueryCountForToday();
            const currentRecordingMins = seconds / 60;
            const remainingMins = Math.max(0, (20 - quotaData.count) * 5 - currentRecordingMins);
            
            window.noteDurationText = `⏱️ ${remainingMins.toFixed(2)} mins remaining`;
            const durElem = document.getElementById('note-recording-duration');
            if (durElem) {
                durElem.textContent = window.noteDurationText;
                durElem.style.display = 'inline-block';
            }
            
            // Update progress bar to reflect remaining minutes out of 100 total daily minutes
            const progressbar = document.getElementById('note-quota-progressbar');
            if (progressbar) {
                progressbar.style.width = `${Math.min(100, remainingMins)}%`;
            }
        }, 1000);
        
    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Microphone access denied or not supported in this browser. You can still upload local audio files below!");
    }
}

function stopAudioRecording(silent = false) {
    if (noteMediaRecorder && noteMediaRecorder.state !== 'inactive') {
        noteMediaRecorder.stop();
        // Stop stream tracks
        noteMediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    noteIsRecording = false;
    
    const recordTimer = document.getElementById('record-timer');
    const recordWave = document.getElementById('record-wave');
    const micBtn = document.getElementById('btn-record-mic');
    const recordStatus = document.getElementById('record-status');
    
    if (noteTimerInterval) {
        clearInterval(noteTimerInterval);
    }
    
    if (micBtn) {
        micBtn.style.background = 'var(--color-mint)';
        micBtn.style.boxShadow = '0 0 15px rgba(135,195,143,0.3)';
    }
    if (recordWave) recordWave.classList.add('hidden');
    if (recordTimer) recordTimer.style.display = 'none';
    if (!silent && recordStatus) {
        recordStatus.textContent = 'Processing recording...';
    }
    
    if (silent) {
        window.noteDurationText = "";
        const durElem = document.getElementById('note-recording-duration');
        if (durElem) durElem.style.display = 'none';
    }
}

function handleAudioFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file size (max 25MB to fit within Cloud Run's 32MB limit)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 25) {
        alert(`⚠️ Selected file is too large (${fileSizeMB.toFixed(2)} MB).\n\nCloud Run has a strict request limit of 32MB. Please upload a file smaller than 25MB, or import it using the Video URL box!`);
        event.target.value = ''; // Reset input selection
        return;
    }
    
    noteAudioFile = file;
    noteRecordedBlob = null; // Clear previous recording
    
    const fileNameSpan = document.getElementById('audio-file-name');
    const recordStatus = document.getElementById('record-status');
    
    if (fileNameSpan) fileNameSpan.textContent = `📁 Selected: ${file.name} (${fileSizeMB.toFixed(2)} MB)`;
    if (recordStatus) recordStatus.textContent = 'Audio/video file selected. Ready to transcribe.';
    
    // Get audio/video duration dynamically using appropriate HTML element
    const isVideo = file.type.startsWith('video/') || 
                    file.name.endsWith('.mp4') || 
                    file.name.endsWith('.mov') || 
                    file.name.endsWith('.avi') || 
                    file.name.endsWith('.mkv');
    const mediaElem = isVideo ? document.createElement('video') : document.createElement('audio');
    
    mediaElem.src = URL.createObjectURL(file);
    mediaElem.addEventListener('loadedmetadata', () => {
        const durationMins = (mediaElem.duration / 60).toFixed(2);
        window.noteDurationText = `⏱️ ${durationMins} mins`;
        const durElem = document.getElementById('note-recording-duration');
        if (durElem) {
            durElem.textContent = window.noteDurationText;
            durElem.style.display = 'inline-block';
        }
    });
    
    enableTranscribeBtn(true);
}

function enableTranscribeBtn(enabled) {
    const btn = document.getElementById('btn-transcribe-audio');
    if (!btn) return;
    
    if (enabled) {
        btn.removeAttribute('disabled');
        btn.style.background = 'var(--color-mint)';
        btn.style.borderColor = 'var(--color-mint)';
        btn.style.color = 'var(--bg-dark)';
        btn.style.cursor = 'pointer';
    } else {
        btn.setAttribute('disabled', 'true');
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.borderColor = 'var(--panel-border)';
        btn.style.color = 'var(--color-text-dim)';
        btn.style.cursor = 'not-allowed';
    }
}

async function transcribeAudio() {
    const fileToSend = noteAudioFile || noteRecordedBlob;
    if (!fileToSend) return;
    
    // Check quota limit first
    const quotaData = getQueryCountForToday();
    if (quotaData.count >= 20) {
        alert("⚠️ Daily Free Quota Reached (20/20). Please wait for the daily reset or try again tomorrow!");
        return;
    }
    
    const btn = document.getElementById('btn-transcribe-audio');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Transcribing Audio...';
    btn.setAttribute('disabled', 'true');
    btn.style.cursor = 'not-allowed';
    
    const formData = new FormData();
    const filename = noteAudioFile ? noteAudioFile.name : 'recorded_audio.webm';
    formData.append('audio', fileToSend, filename);
    
    const textarea = document.getElementById('note-transcript-text');
    if (textarea) textarea.placeholder = 'Lily is listening and transcribing your audio... Please wait.';
    
    try {
        const res = await fetch('/api/notes/transcribe', {
            method: 'POST',
            body: formData
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.transcript) {
                // Increment quota count
                incrementQueryCount(data.calls_made);
                
                if (textarea) {
                    textarea.value = data.transcript;
                    updateWordCount();
                }
                alert("✨ Audio transcribed successfully!");
            } else {
                alert("❌ Transcription failed: " + (data.error || "Unknown error"));
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            alert("❌ Transcription failed: " + (errData.error || res.statusText));
        }
    } catch (e) {
        console.error("Transcription error:", e);
        alert("❌ Error connecting to transcription server. Ensure your Gemini API Key is configured.");
    } finally {
        btn.innerHTML = originalText;
        enableTranscribeBtn(true);
    }
}

function updateWordCount() {
    const textarea = document.getElementById('note-transcript-text');
    const wordCountBadge = document.getElementById('word-count-badge');
    if (!textarea || !wordCountBadge) return;
    
    const text = textarea.value.trim();
    const count = text ? text.split(/\s+/).length : 0;
    wordCountBadge.textContent = `${count} word${count === 1 ? '' : 's'}`;
}

// Hook word count input
document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('note-transcript-text');
    if (textarea) {
        textarea.addEventListener('input', updateWordCount);
    }
});

async function summarizeTranscript() {
    const textarea = document.getElementById('note-transcript-text');
    if (!textarea || !textarea.value.trim()) {
        alert("Please record/upload audio or enter some text in the transcript review area first.");
        return;
    }
    
    // Check quota limit first
    const quotaData = getQueryCountForToday();
    if (quotaData.count >= 20) {
        alert("⚠️ Daily Free Quota Reached (20/20). Please wait for the daily reset or try again tomorrow!");
        return;
    }
    
    const btn = document.getElementById('btn-summarize-transcript');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⚡ Generating Summary...';
    btn.setAttribute('disabled', 'true');
    btn.style.cursor = 'not-allowed';
    
    const noteTypeEl = document.querySelector('input[name="note-agent-type"]:checked');
    const noteType = noteTypeEl ? noteTypeEl.value : 'lecture';
    
    const previewContainer = document.getElementById('note-summary-preview');
    if (previewContainer) {
        previewContainer.innerHTML = '<span style="color: var(--color-mint); font-style: italic;">🐸 Lily is analyzing your notes and formatting them... Please hold on!</span>';
    }
    
    let res;
    try {
        res = await fetch('/api/notes/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transcript: textarea.value.trim(),
                type: noteType
            })
        });
    } catch (e) {
        console.error("Network error fetching summary:", e);
        if (previewContainer) previewContainer.innerHTML = '<span style="color: #ff595e;">Error connecting to server.</span>';
        alert("❌ Error connecting to summary server. Please check your internet connection.");
        btn.innerHTML = originalText;
        btn.removeAttribute('disabled');
        btn.style.cursor = 'pointer';
        return;
    }

    if (res.ok) {
        let data;
        try {
            data = await res.json();
        } catch (e) {
            console.error("JSON parse error:", e);
            if (previewContainer) previewContainer.innerHTML = '<span style="color: #ff595e;">Failed to parse response.</span>';
            alert("❌ Summary failed: Server returned an invalid response.");
            btn.innerHTML = originalText;
            btn.removeAttribute('disabled');
            btn.style.cursor = 'pointer';
            return;
        }

        if (data.success && data.notes) {
            try {
                // Increment quota count
                try {
                    incrementQueryCount(data.calls_made);
                } catch(e) {
                    console.error("incrementQueryCount failed:", e);
                }
                
                generatedNotesMarkdown = data.notes;
                
                // Parse markdown preview
                let html = '';
                if (typeof marked !== 'undefined') {
                    try {
                        html = marked.parse(data.notes);
                    } catch(markedErr) {
                        console.error("marked.parse failed:", markedErr);
                        html = `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHTML(data.notes)}</pre>`;
                    }
                } else {
                    html = `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHTML(data.notes)}</pre>`;
                }
                
                const studyActionsHTML = `
                    <div class="study-actions-box" style="margin-top: 15px; padding: 12px; background: rgba(135,195,143,0.06); border: 1px solid rgba(135,195,143,0.15); border-radius: 12px; text-align: left;">
                        <div style="font-weight: bold; color: var(--color-mint); font-size: 0.85rem; margin-bottom: 8px;">🎓 Study & Practice with these Notes</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            <button class="btn btn-primary btn-sm" onclick="studyNotesWithFrogGPT('active', 'flashcards')" style="background: var(--color-sage); border: none; color: #fff; padding: 6px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">📇 Make Flashcards</button>
                            <button class="btn btn-primary btn-sm" onclick="studyNotesWithFrogGPT('active', 'quiz')" style="background: var(--color-sage); border: none; color: #fff; padding: 6px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">📝 Make Quiz</button>
                            <button class="btn btn-primary btn-sm" onclick="studyNotesWithFrogGPT('active', 'test')" style="background: var(--color-sage); border: none; color: #fff; padding: 6px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">✍️ Make Test</button>
                            <button class="btn btn-primary btn-sm" onclick="studyNotesWithFrogGPT('active', 'guide')" style="background: var(--color-sage); border: none; color: #fff; padding: 6px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">📚 Make Guide</button>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="studyNotesWithFrogGPT('active', 'chat')" style="width: 100%; margin-top: 8px; background: var(--color-mint); border: none; color: var(--bg-dark); padding: 8px; border-radius: 8px; font-size: 0.8rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">🤖 Ask frogGPT Questions about this Note</button>
                    </div>
                `;
                if (previewContainer) previewContainer.innerHTML = html + studyActionsHTML;
                
                // Set default generic filename based on type and timestamp
                const filenameInput = document.getElementById('note-filename');
                let displayTitle = '';
                if (filenameInput) {
                    const dateStr = new Date().toISOString().slice(0, 10);
                    filenameInput.value = `${noteType}_notes_${dateStr}`;
                    displayTitle = `${noteType === 'meeting' ? '👥 Meeting Notes' : '🎓 Lecture Summary'} (${dateStr})`;
                } else {
                    displayTitle = `${noteType === 'meeting' ? '👥 Meeting Notes' : '🎓 Lecture Summary'} - ${new Date().toLocaleDateString()}`;
                }
                
                // Save to study materials notes list
                try {
                    saveNoteToLocalStorage({
                        title: displayTitle,
                        type: noteType,
                        transcript: textarea.value.trim(),
                        notes: data.notes
                    });
                } catch(lsErr) {
                    console.warn("Could not save to localStorage (quota or block limit reached):", lsErr);
                }

                enableExportBtn(true);
                alert("✨ Summary generated successfully!");
            } catch(renderErr) {
                console.error("Rendering error:", renderErr);
                alert("❌ Render error: Failed to display the generated summary. Details: " + renderErr.message);
            }
        } else {
            if (previewContainer) previewContainer.innerHTML = '<span style="color: #ff595e;">Failed to generate notes.</span>';
            alert("❌ Summary failed: " + (data.error || "Unknown error"));
        }
    } else {
        const errData = await res.json().catch(() => ({}));
        if (previewContainer) previewContainer.innerHTML = '<span style="color: #ff595e;">Failed to generate notes.</span>';
        alert("❌ Summary failed: " + (errData.error || res.statusText));
    }

    btn.innerHTML = originalText;
    btn.removeAttribute('disabled');
    btn.style.cursor = 'pointer';
}

function enableExportBtn(enabled) {
    const btn = document.getElementById('btn-export-notes');
    if (!btn) return;
    
    if (enabled && generatedNotesMarkdown) {
        btn.removeAttribute('disabled');
        btn.style.background = 'var(--color-mint)';
        btn.style.borderColor = 'var(--color-mint)';
        btn.style.color = 'var(--bg-dark)';
        btn.style.cursor = 'pointer';
    } else {
        btn.setAttribute('disabled', 'true');
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.borderColor = 'var(--panel-border)';
        btn.style.color = 'var(--color-text-dim)';
        btn.style.cursor = 'not-allowed';
    }
}

async function exportNotes() {
    if (!generatedNotesMarkdown) return;
    
    const filenameEl = document.getElementById('note-filename');
    const formatEl = document.getElementById('note-format');
    
    const filename = filenameEl ? filenameEl.value.trim() : 'study_notes';
    const format = formatEl ? formatEl.value : 'pdf';
    
    const btn = document.getElementById('btn-export-notes');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Exporting...';
    btn.setAttribute('disabled', 'true');
    btn.style.cursor = 'not-allowed';
    
    try {
        const res = await fetch('/api/notes/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                notes: generatedNotesMarkdown,
                filename: filename,
                format: format
            })
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                // If running locally, let them know it saved to their Documents
                let successMsg = "🎉 Notes successfully exported!";
                if (data.saved_locally) {
                    successMsg += `\n\nSaved locally on your Mac at:\n/Documents/Note-Agent/Notes/${data.filename}`;
                } else {
                    successMsg += "\n\nDownloading file directly to your browser...";
                }
                alert(successMsg);
                
                // Trigger file download in browser
                window.location.href = '/api/notes/download';
            } else {
                alert("❌ Export failed: " + (data.error || "Unknown error"));
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            alert("❌ Export failed: " + (errData.error || res.statusText));
        }
    } catch (e) {
        console.error("Export error:", e);
        alert("❌ Error connecting to export server.");
    } finally {
        btn.innerHTML = originalText;
        enableExportBtn(true);
    }
}

async function importVideoLink() {
    const input = document.getElementById('video-link-input');
    if (!input || !input.value.trim()) {
        alert("Please paste a YouTube or direct video link first.");
        return;
    }

    // Check quota limit first
    const quotaData = getQueryCountForToday();
    if (quotaData.count >= 20) {
        alert("⚠️ Daily Free Quota Reached (20/20). Please wait for the daily reset or try again tomorrow!");
        return;
    }

    const btn = document.getElementById('btn-import-video-link');
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Loading...';
    btn.setAttribute('disabled', 'true');
    btn.style.cursor = 'not-allowed';

    const url = input.value.trim();
    const textarea = document.getElementById('note-transcript-text');
    if (textarea) textarea.placeholder = 'Lily is downloading/analyzing the video content to fetch the transcript... Please wait.';

    try {
        const res = await fetch('/api/notes/import-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });

        if (res.ok) {
            const data = await res.json();
            if (data.success && data.transcript) {
                // Increment quota count
                incrementQueryCount(data.calls_made);

                if (textarea) {
                    textarea.value = data.transcript;
                    updateWordCount();
                }
                alert("✨ Video content imported and transcribed successfully!");
                input.value = '';
            } else {
                alert("❌ Import failed: " + (data.error || "Unknown error"));
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            alert("❌ Import failed: " + (errData.error || res.statusText));
        }
    } catch(e) {
        console.error("Video import error:", e);
        alert("❌ Error connecting to import server.");
    } finally {
        btn.innerHTML = originalText;
        btn.removeAttribute('disabled');
        btn.style.cursor = 'pointer';
        if (textarea) textarea.placeholder = 'Your transcribed text will appear here. You can also type or paste content directly to summarize...';
    }
}

// --- Pomodoro Category and Logging Helpers ---

window.handleTimerCategorySelectChange = function(value) {
    const customGroup = document.getElementById('timer-custom-category-group');
    if (!customGroup) return;
    if (value === '__add_new__') {
        customGroup.classList.remove('hidden');
        const input = document.getElementById('timer-custom-category-name');
        if (input) input.focus();
    } else {
        customGroup.classList.add('hidden');
    }
};

window.saveTimerCustomCategory = function() {
    const input = document.getElementById('timer-custom-category-name');
    if (!input) return;
    const catName = input.value.trim();
    
    if (!catName) return;
    
    const exists = ['school', 'work', ...customCategories.map(c => c.toLowerCase())].includes(catName.toLowerCase());
    if (exists) {
        alert('This category already exists, ribbit!');
        return;
    }
    
    customCategories.push(catName);
    localStorage.setItem('froggy_custom_categories', JSON.stringify(customCategories));
    populateCategoryDropdowns();
    
    // Select the new category in the timer dropdown
    const select = document.getElementById('timer-category-select');
    if (select) {
        select.value = catName;
    }
    
    const customGroup = document.getElementById('timer-custom-category-group');
    if (customGroup) customGroup.classList.add('hidden');
    input.value = '';
};

async function logCompletedPomodoroSession() {
    const categorySelect = document.getElementById('timer-category-select');
    const category = categorySelect ? categorySelect.value : 'School';
    const workMin = parseInt(document.getElementById('session-length').value) || 25;
    
    // Format timestamp as YYYY-MM-DD HH:MM:SS
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    
    if (isLoggedIn) {
        try {
            await fetch('/api/pomodoro/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: category,
                    duration_minutes: workMin
                })
            });
        } catch (err) {
            console.error("Error logging pomodoro session to backend:", err);
        }
    } else {
        // Guest mode - store in localStorage
        const guestLogs = JSON.parse(localStorage.getItem('froggy_guest_pomodoro_logs') || '[]');
        guestLogs.push({
            category: category,
            duration_minutes: workMin,
            completed_at: timestamp
        });
        localStorage.setItem('froggy_guest_pomodoro_logs', JSON.stringify(guestLogs));
    }
}

// --- Statistics Modal Operations ---

window.openStatsModal = function() {
    try {
        closeCalendarModal();
        closeGamesModal();
        closeFrogGPTModal();
        closeNoteAgentModal();
        
        const modal = document.getElementById('stats-modal');
        if (modal) {
            modal.classList.add('open');
            const btn = document.getElementById('btn-sidebar-stats');
            if (btn) btn.classList.add('active');
            
            // Default month filter input to current month
            const now = new Date();
            const yyyymm = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
            const filter = document.getElementById('stats-month-filter');
            if (filter && !filter.value) {
                filter.value = yyyymm;
            }
            
            loadStatsForMonth(filter ? filter.value : yyyymm);
        } else {
            alert("❌ stats-modal element not found in DOM!");
        }
    } catch(err) {
        console.error("openStatsModal error:", err);
        alert("❌ Error opening stats: " + err.message);
    }
};

window.closeStatsModal = function() {
    const modal = document.getElementById('stats-modal');
    if (modal) {
        modal.classList.remove('open');
    }
    const btn = document.getElementById('btn-sidebar-stats');
    if (btn) btn.classList.remove('active');
};

window.loadStatsForMonth = async function(monthStr) {
    try {
        if (!monthStr) return;
        
        let pomodoroLogs = [];
        let completedTasks = [];
        
        if (isLoggedIn) {
            try {
                const response = await fetch(`/api/pomodoro/stats?month=${monthStr}`);
                if (response.ok) {
                    const data = await response.json();
                    pomodoroLogs = data.pomodoro_logs || [];
                    completedTasks = data.completed_tasks || [];
                }
            } catch (err) {
                console.error("Error loading monthly stats:", err);
            }
        } else {
            // Guest mode - read from localStorage
            const guestLogs = JSON.parse(localStorage.getItem('froggy_guest_pomodoro_logs') || '[]');
            pomodoroLogs = guestLogs.filter(log => log.completed_at && log.completed_at.startsWith(monthStr));
            
            const guestTasks = getLocalTasks();
            completedTasks = guestTasks.filter(task => task.completed === 1 && task.completed_at && task.completed_at.startsWith(monthStr));
        }
        
        renderStats({ pomodoro_logs: pomodoroLogs, completed_tasks: completedTasks }, monthStr);
    } catch(err) {
        console.error("loadStatsForMonth error:", err);
        alert("❌ Error loading stats for month: " + err.message);
    }
};

function renderStats(data, monthStr) {
    try {
        const pLogs = data.pomodoro_logs;
        const completedTasks = data.completed_tasks;
        
        // 1. Calculate Total Hours
        let totalMinutes = 0;
        const categoryMinutes = {};
        
        pLogs.forEach(log => {
            const mins = parseInt(log.duration_minutes) || 25;
            totalMinutes += mins;
            
            const cat = log.category || 'School';
            categoryMinutes[cat] = (categoryMinutes[cat] || 0) + mins;
        });
        
        const totalHours = (totalMinutes / 60).toFixed(1);
        document.getElementById('stats-total-hours').textContent = totalHours;
        
        // 2. Set Tasks Completed
        document.getElementById('stats-completed-tasks').textContent = completedTasks.length;
        
        // 3. Render Category Progress Bars
        const categoryBarsContainer = document.getElementById('stats-category-bars');
        if (categoryBarsContainer) {
            categoryBarsContainer.innerHTML = '';
            
            if (totalMinutes === 0) {
                categoryBarsContainer.innerHTML = `<div style="text-align: center; color: var(--color-sage); font-style: italic; font-size: 0.9rem; padding: 10px;">No focus hours logged for this month, ribbit.</div>`;
            } else {
                // Sort categories by focus duration descending
                const sortedCats = Object.entries(categoryMinutes).sort((a, b) => b[1] - a[1]);
                
                sortedCats.forEach(([cat, mins]) => {
                    const percent = Math.round((mins / totalMinutes) * 100);
                    const hrs = (mins / 60).toFixed(1);
                    
                    const barEl = document.createElement('div');
                    barEl.style.display = 'flex';
                    barEl.style.flexDirection = 'column';
                    barEl.style.gap = '4px';
                    
                    // Color palette lookup
                    let color = '#87c38f'; // Default green
                    if (cat.toLowerCase() === 'work') color = '#f29e4c';
                    else if (cat.toLowerCase() === 'school') color = '#87c38f';
                    else {
                        // Generate a color based on category name string hash
                        let hash = 0;
                        for (let i = 0; i < cat.length; i++) {
                            hash = cat.charCodeAt(i) + ((hash << 5) - hash);
                        }
                        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
                        color = '#' + '00000'.substring(0, 6 - c.length) + c;
                    }
                    
                    barEl.innerHTML = `
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--color-cream);">
                            <span>${escapeHTML(cat)}</span>
                            <span><strong>${hrs} hrs</strong> (${percent}%)</span>
                        </div>
                        <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.04);">
                            <div style="width: ${percent}%; height: 100%; background: ${color}; border-radius: 4px;"></div>
                        </div>
                    `;
                    categoryBarsContainer.appendChild(barEl);
                });
            }
        }
        
        // 4. Render Monthly Activity Log Log
        const logListContainer = document.getElementById('stats-activity-log-list');
        if (logListContainer) {
            logListContainer.innerHTML = '';
            
            // Combine pomodoro logs and task logs, sort by completed_at desc
            const allItems = [];
            
            pLogs.forEach(log => {
                allItems.push({
                    type: 'pomodoro',
                    title: `Completed focus session (${log.duration_minutes} min)`,
                    category: log.category,
                    time: log.completed_at
                });
            });
            
            completedTasks.forEach(task => {
                allItems.push({
                    type: 'task',
                    title: `Checked off task: "${task.title}"`,
                    category: task.category,
                    time: task.completed_at
                });
            });
            
            // Sort newest first
            allItems.sort((a, b) => new Date(b.time) - new Date(a.time));
            
            if (allItems.length === 0) {
                logListContainer.innerHTML = `<div style="text-align: center; color: var(--color-sage); font-style: italic; font-size: 0.9rem; padding: 10px;">No activity logged yet, ribbit!</div>`;
            } else {
                allItems.forEach(item => {
                    const itemEl = document.createElement('div');
                    itemEl.style.display = 'flex';
                    itemEl.style.justifyContent = 'space-between';
                    itemEl.style.alignItems = 'center';
                    itemEl.style.padding = '8px 10px';
                    itemEl.style.background = 'rgba(255, 255, 255, 0.02)';
                    itemEl.style.border = '1px solid rgba(255, 255, 255, 0.04)';
                    itemEl.style.borderRadius = '8px';
                    itemEl.style.fontSize = '0.85rem';
                    
                    const emoji = item.type === 'pomodoro' ? '⏱️' : '✅';
                    const formattedTime = item.time ? item.time.substring(5, 16) : ''; // MM-DD HH:MM
                    
                    itemEl.innerHTML = `
                        <div style="display: flex; gap: 8px; align-items: center; color: var(--color-cream); flex: 1; min-width: 0;">
                            <span>${emoji}</span>
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(item.title)}</span>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center; font-size: 0.8rem; color: var(--color-sage);">
                            <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${escapeHTML(item.category || 'School')}</span>
                            <span>${formattedTime}</span>
                        </div>
                    `;
                    logListContainer.appendChild(itemEl);
                });
            }
        }
    } catch(err) {
        console.error("renderStats error:", err);
        alert("❌ Error rendering stats: " + err.message);
    }
}

window.compileMonthlyReport = async function() {
    const filter = document.getElementById('stats-month-filter');
    const monthStr = filter ? filter.value : '';
    if (!monthStr) {
        alert("Please select a month for compiling the report, ribbit!");
        return;
    }
    
    if (isLoggedIn) {
        // Direct download using GET
        window.open(`/api/pomodoro/compile-report?month=${monthStr}`, '_blank');
    } else {
        // Guest mode: package guest data and post to endpoint
        try {
            const guestLogs = JSON.parse(localStorage.getItem('froggy_guest_pomodoro_logs') || '[]');
            const monthLogs = guestLogs.filter(log => log.completed_at && log.completed_at.startsWith(monthStr));
            
            const guestTasks = getLocalTasks();
            const monthTasks = guestTasks.filter(task => task.completed === 1 && task.completed_at && task.completed_at.startsWith(monthStr));
            
            const response = await fetch('/api/pomodoro/compile-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    month: monthStr,
                    pomodoro_logs: monthLogs,
                    completed_tasks: monthTasks.map(t => ({ title: t.title, category: t.category, completed_at: t.completed_at }))
                })
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Froggy_Pomodoro_Report_${monthStr}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                alert("❌ Failed to compile guest report.");
            }
        } catch (err) {
            console.error("Error compiling guest report:", err);
            alert("❌ Error compiling report.");
        }
    }
};

// Window exports
window.openNoteAgentModal = openNoteAgentModal;
window.closeNoteAgentModal = closeNoteAgentModal;
window.toggleAudioRecording = toggleAudioRecording;
window.handleAudioFileSelect = handleAudioFileSelect;
window.transcribeAudio = transcribeAudio;
window.summarizeTranscript = summarizeTranscript;
window.exportNotes = exportNotes;
window.updateWordCount = updateWordCount;
window.importVideoLink = importVideoLink;
