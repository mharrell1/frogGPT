import os
import sys
import sqlite3
from flask import Flask, render_template, request, jsonify, session, g
from werkzeug.security import generate_password_hash, check_password_hash

# Initialize ADK frogGPT runner if study-agent is available
froggpt_runner = None
froggpt_session_service = None

try:
    study_agent_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'study-agent')
    if study_agent_path not in sys.path:
        sys.path.insert(0, study_agent_path)
    
    # Load dotenv from study-agent with override=True
    from dotenv import load_dotenv
    load_dotenv(os.path.join(study_agent_path, '.env'), override=True)
    
    # Explicitly set mandatory environment variables for AI Studio API keys
    os.environ['GOOGLE_GENAI_USE_ENTERPRISE'] = 'False'
    os.environ['GOOGLE_GENAI_USE_VERTEXAI'] = 'False'

    from app.agent import root_agent
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService

    # Monkey patch to fix ADK 2.0 active task isolation scope bug
    import google.adk.runners as adk_runners
    def patched_find_active_task_isolation_scope(session):
        finished_scopes = set()
        for event in session.events:
            scope = event.isolation_scope
            if not scope:
                continue
            if event.content and event.content.parts:
                for part in event.content.parts:
                    fr = part.function_response
                    if fr and fr.name == 'finish_task':
                        response = fr.response or {}
                        if response.get('result') == 'Task completed.':
                            finished_scopes.add(scope)
                        break
        for event in reversed(session.events):
            scope = event.isolation_scope
            if scope and scope not in finished_scopes:
                return scope
        return None
    adk_runners._find_active_task_isolation_scope = patched_find_active_task_isolation_scope

    froggpt_session_service = InMemorySessionService()
    froggpt_runner = Runner(agent=root_agent, session_service=froggpt_session_service, app_name="frogGPT")
    print("Successfully initialized frogGPT ADK Runner.")
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"Failed to initialize frogGPT ADK Runner: {e}")

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'froggy-secret-key-12345')
app.config['SESSION_COOKIE_NAME'] = 'froggy_session'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

DATABASE = os.environ.get('DB_PATH', 'tasks.db')

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db_dir = os.path.dirname(DATABASE)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    db = get_db()
    # Create users table
    db.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    # Create tasks table if not exists
    db.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Add columns to tasks table if they don't exist
    cursor = db.execute("PRAGMA table_info(tasks)")
    columns = [row['name'] for row in cursor.fetchall()]
    if 'user_id' not in columns:
        db.execute("ALTER TABLE tasks ADD COLUMN user_id INTEGER REFERENCES users(id)")
    if 'due_date' not in columns:
        db.execute("ALTER TABLE tasks ADD COLUMN due_date TEXT")
    if 'category' not in columns:
        db.execute("ALTER TABLE tasks ADD COLUMN category TEXT")
    if 'urgency' not in columns:
        db.execute("ALTER TABLE tasks ADD COLUMN urgency TEXT")
    db.commit()

with app.app_context():
    init_db()

@app.route('/')
def index():
    return render_template('index.html')

# Authentication APIs
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    db = get_db()
    try:
        # Check if user already exists
        user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        if user:
            return jsonify({'error': 'Username already taken'}), 400

        password_hash = generate_password_hash(password)
        cursor = db.execute('INSERT INTO users (username, password) VALUES (?, ?)', (username, password_hash))
        db.commit()
        user_id = cursor.lastrowid

        session['user_id'] = user_id
        session['username'] = username
        return jsonify({'success': True, 'username': username})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if not user or not check_password_hash(user['password'], password):
        return jsonify({'error': 'Invalid username or password'}), 401

    session['user_id'] = user['id']
    session['username'] = user['username']
    return jsonify({'success': True, 'username': user['username']})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/user', methods=['GET'])
def get_user():
    if 'user_id' in session:
        return jsonify({'logged_in': True, 'username': session['username']})
    return jsonify({'logged_in': False})

# Task APIs
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    db = get_db()
    tasks = db.execute('SELECT * FROM tasks WHERE user_id = ? ORDER BY id DESC', (session['user_id'],)).fetchall()
    
    return jsonify([
        {
            'id': task['id'],
            'title': task['title'],
            'completed': bool(task['completed']),
            'created_at': task['created_at'],
            'due_date': task['due_date'],
            'category': task['category'] or 'School',
            'urgency': task['urgency'] or 'medium'
        } for task in tasks
    ])

@app.route('/api/tasks', methods=['POST'])
def add_task():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    title = data.get('title', '').strip()
    due_date = data.get('due_date', '').strip() or None
    category = data.get('category', 'School').strip() or 'School'
    urgency = data.get('urgency', 'medium').strip() or 'medium'

    if not title:
        return jsonify({'error': 'Task title is required'}), 400

    db = get_db()
    try:
        cursor = db.execute(
            'INSERT INTO tasks (user_id, title, completed, due_date, category, urgency) VALUES (?, ?, 0, ?, ?, ?)',
            (session['user_id'], title, due_date, category, urgency)
        )
        db.commit()
        task_id = cursor.lastrowid
        
        task = db.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
        return jsonify({
            'id': task['id'],
            'title': task['title'],
            'completed': bool(task['completed']),
            'created_at': task['created_at'],
            'due_date': task['due_date'],
            'category': task['category'] or 'School',
            'urgency': task['urgency'] or 'medium'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    completed = data.get('completed')
    title = data.get('title')
    due_date = data.get('due_date')
    category = data.get('category')
    urgency = data.get('urgency')

    db = get_db()
    task = db.execute('SELECT * FROM tasks WHERE id = ? AND user_id = ?', (task_id, session['user_id'])).fetchone()
    if not task:
        return jsonify({'error': 'Task not found'}), 404

    try:
        update_fields = []
        params = []
        if completed is not None:
            update_fields.append("completed = ?")
            params.append(1 if completed else 0)
        if title is not None:
            update_fields.append("title = ?")
            params.append(title.strip())
        if due_date is not None:
            update_fields.append("due_date = ?")
            params.append(due_date.strip() or None)
        if category is not None:
            update_fields.append("category = ?")
            params.append(category.strip() or 'School')
        if urgency is not None:
            update_fields.append("urgency = ?")
            params.append(urgency.strip() or 'medium')

        if not update_fields:
            return jsonify({'error': 'No fields to update'}), 400

        params.append(task_id)
        query = f"UPDATE tasks SET {', '.join(update_fields)} WHERE id = ?"
        db.execute(query, tuple(params))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    db = get_db()
    task = db.execute('SELECT * FROM tasks WHERE id = ? AND user_id = ?', (task_id, session['user_id'])).fetchone()
    if not task:
        return jsonify({'error': 'Task not found'}), 404

    try:
        db.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def run_async(coro):
    import asyncio
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)

def run_external_llm(message_text, model_name, user_id, session_id, imported_content=None):
    # Load session history if possible
    history_str = ""
    try:
        sess = froggpt_session_service.get_session_sync(user_id=user_id, session_id=session_id, app_name="frogGPT")
        if sess and sess.events:
            for ev in sess.events:
                if ev.author == 'user' and ev.content and ev.content.parts:
                    text = "".join([p.text for p in ev.content.parts if getattr(p, 'text', None)])
                    history_str += f"User: {text}\n"
                elif ev.author == 'study_agent' and ev.content and ev.content.parts:
                    text = "".join([p.text for p in ev.content.parts if getattr(p, 'text', None)])
                    history_str += f"Assistant: {text}\n"
    except Exception as e:
        print(f"Error loading history: {e}")

    # Build prompt
    system_prompt = """You are frogGPT, a friendly AI study assistant. Your name is Lily. You help the user study topics, explain concepts, make flashcards, generate practice tests, and quizzes.

CRITICAL INSTRUCTION FOR STUDY TOOLS:
If the user asks you to generate flashcards, a quiz, a study guide, or a practice test, you MUST generate structured JSON data matching the appropriate schema and embed it in your response inside a single markdown JSON code block like this:
```json
<JSON_DATA>
```

Choose the appropriate schema based on the tool:
1. Flashcard Deck schema:
{
  "title": "Title of the deck",
  "description": "Short description",
  "cards": [
    {"topic": "Subtopic", "question": "Question", "answer": "Answer"}
  ]
}

2. Quiz schema:
{
  "title": "Quiz Title",
  "topic": "Topic name",
  "difficulty": "easy/medium/hard",
  "questions": [
    {
      "question": "Question text",
      "options": ["A) Opt 1", "B) Opt 2", "C) Opt 3", "D) Opt 4"],
      "correct_answer": "Letter of correct option (A, B, C, or D)",
      "explanation": "Why this is correct"
    }
  ]
}

3. Practice Test schema:
{
  "title": "Practice Test Title",
  "topic": "Topic name",
  "instructions": "General instructions",
  "total_points": 10,
  "time_limit_minutes": 20,
  "true_false": [
    {"statement": "Statement", "correct_answer": "True/False", "explanation": "Explanation", "points": 1}
  ],
  "multiple_choice": [
    {
      "question": "Question",
      "options": ["A) Opt 1", "B) Opt 2", "C) Opt 3", "D) Opt 4"],
      "correct_answer": "A",
      "explanation": "Explanation",
      "points": 1
    }
  ],
  "short_answer": [
    {
      "question": "Question",
      "sample_answer": "Model answer",
      "key_points": ["Point 1", "Point 2"],
      "points": 3
    }
  ]
}

4. Study Guide schema:
{
  "title": "Study Guide Title",
  "overview": "Overview of the topic",
  "sections": [
    {
      "heading": "Section Heading",
      "summary": "Summary text",
      "key_concepts": [{"term": "Term", "definition": "Definition", "example": "Optional example"}],
      "bullet_points": ["Point 1", "Point 2"]
    }
  ],
  "summary": "Final summary"
}

Outside of the json block, always include a warm, helpful ribbiting message summarizing what you generated.
"""

    prompt = ""
    if history_str:
        prompt += f"Conversation history:\n{history_str}\n"
    if imported_content:
        prompt += f"Imported Notes/Document Content:\n{imported_content}\n\n"
    prompt += f"User message: {message_text}\n"

    import urllib.request
    import json

    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()

    if model_name == 'gpt-4o':
        if not openai_key:
            raise ValueError("OPENAI_API_KEY is not set. Please add it to your .env file in the project folder.")
        
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {openai_key}"
        }
        data = {
            "model": "gpt-4o",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3
        }
        
        req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers)
        with urllib.request.urlopen(req) as res:
            res_data = json.loads(res.read().decode('utf-8'))
            return res_data['choices'][0]['message']['content']

    elif model_name == 'claude-3-5-sonnet':
        if not anthropic_key:
            raise ValueError("ANTHROPIC_API_KEY is not set. Please add it to your .env file in the project folder.")
            
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "Content-Type": "application/json",
            "x-api-key": anthropic_key,
            "anthropic-version": "2023-06-01"
        }
        data = {
            "model": "claude-3-5-sonnet-20241022",
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 4000,
            "temperature": 0.3
        }
        
        req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers)
        with urllib.request.urlopen(req) as res:
            res_data = json.loads(res.read().decode('utf-8'))
            return res_data['content'][0]['text']

    raise ValueError(f"Unknown model name: {model_name}")

@app.route('/api/froggpt/import', methods=['POST'])
def froggpt_import_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in request'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
        
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    
    if ext not in ['.txt', '.md', '.docx', '.pdf']:
        return jsonify({'error': 'Unsupported file format. Please upload .txt, .md, .docx, or .pdf files.'}), 400
        
    try:
        content = ""
        if ext in ['.txt', '.md']:
            content = file.read().decode('utf-8', errors='ignore')
        elif ext == '.docx':
            import docx
            from io import BytesIO
            doc = docx.Document(BytesIO(file.read()))
            paragraphs = [p.text for p in doc.paragraphs]
            content = "\n".join(paragraphs)
        elif ext == '.pdf':
            import pypdf
            from io import BytesIO
            reader = pypdf.PdfReader(BytesIO(file.read()))
            text_list = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    text_list.append(t)
            content = "\n".join(text_list)
            
        return jsonify({
            'success': True,
            'filename': filename,
            'content': content,
            'char_count': len(content)
        })
    except Exception as e:
        return jsonify({'error': f'Failed to parse file: {str(e)}'}), 500

# frogGPT AI Study Agent API
@app.route('/api/froggpt', methods=['POST'])
def froggpt_chat():
    if not froggpt_runner or not froggpt_session_service:
        return jsonify({'error': 'frogGPT is not initialized properly. Check server logs and environment variables.'}), 500

    data = request.get_json() or {}
    message_text = data.get('message', '').strip()
    if not message_text:
        return jsonify({'error': 'Message is required'}), 400

    # Get or create session ID for the user
    user_id = session.get('username', 'guest_user')
    session_id = data.get('session_id')
    
    if session_id:
        try:
            sess = froggpt_session_service.get_session_sync(user_id=user_id, session_id=session_id, app_name="frogGPT")
            if not sess:
                session_id = None
        except Exception:
            session_id = None

    if not session_id:
        try:
            new_sess = froggpt_session_service.create_session_sync(user_id=user_id, app_name="frogGPT")
            session_id = new_sess.id
        except Exception as e:
            return jsonify({'error': f'Failed to create session: {e}'}), 500

    try:
        from google.genai import types
        from google.adk.agents.run_config import RunConfig, StreamingMode
        
        model_name = data.get('model', 'gemini-2.5-flash').strip()
        imported_content = data.get('imported_content', '').strip()
        
        # 1. Claude and ChatGPT Integration
        if model_name in ['gpt-4o', 'claude-3-5-sonnet']:
            try:
                sess = froggpt_session_service.get_session_sync(user_id=user_id, session_id=session_id, app_name="frogGPT")
                reply = run_external_llm(message_text, model_name, user_id, session_id, imported_content)
                
                import re
                import json
                structured_data = None
                subagent_author = None
                
                json_match = re.search(r'```json\s*(.*?)\s*```', reply, re.DOTALL)
                if json_match:
                    try:
                        json_str = json_match.group(1).strip()
                        structured_data = json.loads(json_str)
                        
                        if 'cards' in structured_data:
                            subagent_author = 'flashcard_agent'
                        elif 'difficulty' in structured_data or ('questions' in structured_data and 'options' in str(structured_data)):
                            subagent_author = 'quiz_agent'
                        elif 'true_false' in structured_data or 'multiple_choice' in structured_data:
                            subagent_author = 'test_agent'
                        elif 'sections' in structured_data:
                            subagent_author = 'study_guide_agent'
                            
                        reply = reply.replace(json_match.group(0), "").strip()
                    except Exception as e:
                        print(f"Failed to parse JSON from external model response: {e}")
                
                # Append events to history
                import uuid
                from google.adk.events.event import Event
                
                user_content = types.Content(role="user", parts=[types.Part.from_text(text=message_text)])
                assistant_content = types.Content(role="model", parts=[types.Part.from_text(text=reply)])
                
                user_event = Event(
                    invocation_id=str(uuid.uuid4()),
                    author='user',
                    content=user_content
                )
                assistant_event = Event(
                    invocation_id=str(uuid.uuid4()),
                    author='study_agent',
                    content=assistant_content
                )
                
                run_async(froggpt_session_service.append_event(sess, user_event))
                run_async(froggpt_session_service.append_event(sess, assistant_event))
                
                return jsonify({
                    'success': True,
                    'response': reply,
                    'session_id': session_id,
                    'structured_data': structured_data,
                    'subagent_author': subagent_author
                })
            except Exception as err:
                err_str = str(err)
                print(f"Error calling {model_name}: {err_str}")
                # Prepend a warning and fall through to Gemini!
                fallback_msg = f"⚠️ **Could not connect to {model_name.upper()}**\n\n🐸 Lily tried to call {model_name.upper()}, but got an error: `{err_str}`.\n\nTo use this model, please ensure you have added your API key (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) to the `.env` file in the project folder.\n\n🔄 **Fallback**: Routing your request on **Gemini 2.5 Flash** instead so you don't lose progress!\n\n---\n\n"
                g.fallback_prefix = fallback_msg
                # Fallback to default Gemini
                model_name = 'gemini-2.5-flash'

        # 2. Gemini Pipeline (Default ADK)
        # Prepend imported notes if present
        if imported_content:
            message_text = f"Imported Notes/Document Content:\n{imported_content}\n\nUser request: {message_text}"

        allowed_models = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro']
        if model_name not in allowed_models:
            model_name = 'gemini-2.5-flash'
            
        agents_to_update = [root_agent]
        if hasattr(root_agent, 'sub_agents') and root_agent.sub_agents:
            agents_to_update.extend(root_agent.sub_agents)
            
        for ag in agents_to_update:
            if hasattr(ag, 'model') and ag.model:
                if hasattr(ag.model, 'model'):
                    ag.model.model = model_name

        msg = types.Content(role="user", parts=[types.Part.from_text(text=message_text)])
        events = list(
            froggpt_runner.run(
                new_message=msg,
                user_id=user_id,
                session_id=session_id,
                run_config=RunConfig(streaming_mode=StreamingMode.SSE),
            )
        )
        
        # Check if any sub-agent successfully produced a structured output dict
        subagent_markdown = ""
        structured_data = None
        subagent_author = None
        try:
            from app.tools import (
                format_flashcards_markdown,
                format_study_guide_markdown,
                format_quiz_markdown,
                format_practice_test_markdown,
                format_explanation_markdown,
            )
            import json
            
            for event in events:
                if getattr(event, 'output', None) and isinstance(event.output, dict):
                    author = getattr(event, 'author', '')
                    out_json = json.dumps(event.output)
                    res = {}
                    if author == 'quiz_agent' or ('questions' in event.output and 'options' in str(event.output)):
                        res = format_quiz_markdown(out_json)
                        if res.get('status') == 'success':
                            structured_data = event.output
                            subagent_author = 'quiz_agent'
                    elif author == 'flashcard_agent' or 'cards' in event.output:
                        res = format_flashcards_markdown(out_json)
                        if res.get('status') == 'success':
                            structured_data = event.output
                            subagent_author = 'flashcard_agent'
                    elif author == 'study_guide_agent' or 'sections' in event.output:
                        res = format_study_guide_markdown(out_json)
                        if res.get('status') == 'success':
                            structured_data = event.output
                            subagent_author = 'study_guide_agent'
                    elif author == 'test_agent' or 'true_false' in event.output or 'multiple_choice' in event.output:
                        res = format_practice_test_markdown(out_json)
                        if res.get('status') == 'success':
                            structured_data = event.output
                            subagent_author = 'test_agent'
                    elif author == 'explain_agent' or 'simple_explanation' in event.output or 'analogy' in event.output:
                        res = format_explanation_markdown(out_json)
                        if res.get('status') == 'success':
                            structured_data = event.output
                            subagent_author = 'explain_agent'
                    
                    if res.get('status') == 'success' and res.get('markdown'):
                        subagent_markdown = res['markdown']
                        break
        except Exception as fmt_err:
            print(f"Debug - error formatting subagent output: {fmt_err}")

        # First try to find the final aggregated event
        full_text = subagent_markdown
        if not full_text:
            for event in events:
                if not getattr(event, 'partial', False) and getattr(event, 'content', None) and getattr(event.content, 'parts', None):
                    text_parts = [part.text for part in event.content.parts if getattr(part, 'text', None)]
                    if text_parts:
                        full_text = "".join(text_parts)
                    
        # If no final aggregated event found, concatenate all partial events
        if not full_text:
            for event in events:
                if getattr(event, 'partial', True) and getattr(event, 'content', None) and getattr(event.content, 'parts', None):
                    for part in event.content.parts:
                        if getattr(part, 'text', None):
                            full_text += part.text
                        
        if not full_text:
            print(f"Debug - events received: {events}")
            # Try to extract any error or quota information from the events
            err_msg = ""
            for event in events:
                if getattr(event, 'error', None):
                    err_msg += str(event.error) + " "
                elif getattr(event, 'status', None) and str(event.status) != "OK":
                    err_msg += str(event.status) + " "
            
            events_str = str(events)
            if err_msg or "429" in events_str or "quota" in events_str.lower() or "resource_exhausted" in events_str.lower():
                full_text = f"⚠️ **Google AI Studio Quota Exceeded / Rate Limit**\n\n🐸 Lily tried to answer, but the Gemini API free tier quota was reached (`429 Too Many Requests`).\n\n**Details**: {err_msg or 'Free tier limits requests to 20 per minute or daily limits.'}\n\n⏳ **Fix**: Please wait about 45–60 seconds, take a deep breath, and try clicking the button again!"
            else:
                full_text = f"⚠️ **Google AI Studio Rate Limit / No Response**\n\n🐸 Lily couldn't generate a text response. This usually happens when the Gemini API free tier rate limit (`429 Resource Exhausted`) is reached during a multi-agent workflow.\n\n`Debug Info: {events_str}`\n\n⏳ **Fix**: Please wait about 60 seconds and try asking again!"

        final_response_text = getattr(g, 'fallback_prefix', '') + full_text

        return jsonify({
            'success': True,
            'response': final_response_text,
            'session_id': session_id,
            'structured_data': structured_data,
            'subagent_author': subagent_author
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Check if the exception itself is a quota error
        err_str = str(e)
        if "429" in err_str or "quota" in err_str.lower() or "resource_exhausted" in err_str.lower():
            return jsonify({'success': True, 'response': f"⚠️ **Google AI Studio Quota Exceeded (`429`)**\n\n🐸 Lily tried to answer, but the Gemini API free tier quota was reached.\n\n**Error Details**: {err_str}\n\n⏳ **Fix**: Please wait about 45–60 seconds, take a deep breath, and try again!", 'session_id': session_id})
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
