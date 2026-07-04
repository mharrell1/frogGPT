import io
import json
import os
import sys
import importlib.util
from unittest.mock import MagicMock, patch

import pytest

# Add the project root to sys.path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# We need to make sure study-agent is in sys.path since app.py expects it
study_agent_path = os.path.join(project_root, 'study-agent')
if study_agent_path not in sys.path:
    sys.path.insert(0, study_agent_path)

# Load main.py as a module named "flask_app" to avoid package name conflicts with study-agent/app/
spec = importlib.util.spec_from_file_location("flask_app", os.path.join(project_root, "main.py"))
flask_app = importlib.util.module_from_spec(spec)
sys.modules["flask_app"] = flask_app
spec.loader.exec_module(flask_app)

@pytest.fixture
def client():
    flask_app.app.config['TESTING'] = True
    flask_app.app.config['WTF_CSRF_ENABLED'] = False
    with flask_app.app.test_client() as client:
        yield client

@pytest.fixture
def mock_genai_client():
    mock_client = MagicMock()
    
    # Mock models.generate_content
    mock_response = MagicMock()
    mock_response.text = "This is a mock response from Gemini."
    mock_client.models.generate_content.return_value = mock_response
    
    # Store original client
    orig_client = flask_app.genai_client
    flask_app.genai_client = mock_client
    
    yield mock_client
    
    # Restore original client
    flask_app.genai_client = orig_client

def test_notes_transcribe_no_file(client):
    """Test transcribe endpoint when no file is uploaded."""
    res = client.post('/api/notes/transcribe')
    assert res.status_code == 400
    data = json.loads(res.data.decode('utf-8'))
    assert 'error' in data
    assert data['error'] == 'No audio file provided'

def test_notes_transcribe_empty_filename(client):
    """Test transcribe endpoint when file has an empty filename."""
    data = {
        'audio': (io.BytesIO(b"fake audio data"), '')
    }
    res = client.post('/api/notes/transcribe', data=data, content_type='multipart/form-data')
    assert res.status_code == 400
    data = json.loads(res.data.decode('utf-8'))
    assert 'error' in data
    assert data['error'] == 'No selected audio file'

def test_notes_transcribe_success(client, mock_genai_client):
    """Test transcribe endpoint on successful audio upload."""
    mock_response = MagicMock()
    mock_response.text = "Hello study partner!"
    mock_genai_client.models.generate_content.return_value = mock_response

    data = {
        'audio': (io.BytesIO(b"fake audio data"), 'test.webm')
    }
    res = client.post('/api/notes/transcribe', data=data, content_type='multipart/form-data')
    assert res.status_code == 200
    res_data = json.loads(res.data.decode('utf-8'))
    assert res_data['success'] is True
    assert res_data['transcript'] == "Hello study partner!"
    
    # Verify mock was called
    mock_genai_client.models.generate_content.assert_called_once()

def test_notes_summarize_no_transcript(client):
    """Test summarize endpoint with empty transcript."""
    res = client.post('/api/notes/summarize', json={})
    assert res.status_code == 400
    data = json.loads(res.data.decode('utf-8'))
    assert 'error' in data

def test_notes_summarize_meeting_success(client, mock_genai_client):
    """Test summarize endpoint with meeting note type."""
    mock_response = MagicMock()
    mock_response.text = "### Meeting Notes Summary"
    mock_genai_client.models.generate_content.return_value = mock_response

    payload = {
        'transcript': 'We decided to deploy to Cloud Run on Friday.',
        'type': 'meeting'
    }
    res = client.post('/api/notes/summarize', json=payload)
    assert res.status_code == 200
    res_data = json.loads(res.data.decode('utf-8'))
    assert res_data['success'] is True
    assert res_data['notes'] == "### Meeting Notes Summary"
    
    # Verify mock was called with correct prompt
    args, kwargs = mock_genai_client.models.generate_content.call_args
    assert 'Generate highly structured meeting notes' in kwargs['contents']

def test_notes_summarize_lecture_success(client, mock_genai_client):
    """Test summarize endpoint with lecture note type."""
    mock_response = MagicMock()
    mock_response.text = "### Lecture Summary"
    mock_genai_client.models.generate_content.return_value = mock_response

    payload = {
        'transcript': 'Today we are studying photosynthesis in biology class.',
        'type': 'lecture'
    }
    res = client.post('/api/notes/summarize', json=payload)
    assert res.status_code == 200
    res_data = json.loads(res.data.decode('utf-8'))
    assert res_data['success'] is True
    assert res_data['notes'] == "### Lecture Summary"
    
    # Verify mock was called with correct prompt
    args, kwargs = mock_genai_client.models.generate_content.call_args
    assert 'Generate a structured lecture summary' in kwargs['contents']

def test_notes_export_empty_notes(client):
    """Test export endpoint with empty notes."""
    res = client.post('/api/notes/export', json={})
    assert res.status_code == 400
    data = json.loads(res.data.decode('utf-8'))
    assert 'error' in data

def test_notes_export_pdf_success(client):
    """Test export endpoint for PDF format."""
    payload = {
        'notes': 'Some lecture notes content',
        'filename': 'my_notes',
        'format': 'pdf'
    }
    with patch('app.tools.export_as_pdf') as mock_export:
        mock_export.return_value = {
            'status': 'success',
            'file_path': '/tmp/my_notes.pdf'
        }
        res = client.post('/api/notes/export', json=payload)
        assert res.status_code == 200
        res_data = json.loads(res.data.decode('utf-8'))
        assert res_data['success'] is True
        assert res_data['filename'] == 'my_notes.pdf'

def test_notes_download_not_found(client):
    """Test download endpoint when no export has been made."""
    res = client.get('/api/notes/download')
    assert res.status_code == 404

def test_notes_import_link_no_url(client, mock_genai_client):
    """Test import-link endpoint with no URL."""
    res = client.post('/api/notes/import-link', json={})
    assert res.status_code == 400
    data = json.loads(res.data.decode('utf-8'))
    assert 'error' in data
    assert data['error'] == 'No URL provided'

def test_notes_import_link_youtube_api_success(client, mock_genai_client):
    """Test import-link endpoint when the youtube-transcript.ai API returns a transcript."""
    payload = {'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'}
    
    mock_api_response = MagicMock()
    mock_api_response.status_code = 200
    mock_api_response.text = "## Transcript\nThis is a youtube transcript from the external API."
    
    with patch('requests.get') as mock_get:
        mock_get.return_value = mock_api_response
        res = client.post('/api/notes/import-link', json=payload)
        assert res.status_code == 200
        res_data = json.loads(res.data.decode('utf-8'))
        assert res_data['success'] is True
        assert "This is a youtube transcript" in res_data['transcript']

def test_notes_import_link_direct_youtube_fallback(client, mock_genai_client):
    """Test import-link endpoint when the external API fails, but the direct Gemini multimodal fallback succeeds."""
    payload = {'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'}
    
    mock_api_response = MagicMock()
    mock_api_response.status_code = 500
    
    mock_gemini_response = MagicMock()
    mock_gemini_response.text = "This is a transcript generated directly by Gemini."
    mock_genai_client.models.generate_content.return_value = mock_gemini_response
    
    with patch('requests.get') as mock_get:
        mock_get.return_value = mock_api_response
        res = client.post('/api/notes/import-link', json=payload)
        assert res.status_code == 200
        res_data = json.loads(res.data.decode('utf-8'))
        assert res_data['success'] is True
        assert res_data['transcript'] == "This is a transcript generated directly by Gemini."

def test_quota_accurate_counting(client):
    """Test that multiple generate_content calls correctly increment calls_made in the response."""
    mock_response = MagicMock()
    mock_response.text = "Hello study partner!"
    
    with patch.object(flask_app, 'orig_generate_content', return_value=mock_response):
        data = {
            'audio': (io.BytesIO(b"audio"), 'test.webm')
        }
        res = client.post('/api/notes/transcribe', data=data, content_type='multipart/form-data')
        assert res.status_code == 200
        res_data = json.loads(res.data.decode('utf-8'))
        assert res_data['success'] is True
        assert res_data['calls_made'] == 1



