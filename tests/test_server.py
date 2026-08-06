import sys
from unittest.mock import MagicMock

# Mock all heavy and missing dependencies
mock_modules = [
    'langchain_google_genai', 'langchain_openai', 'fastembed', 
    'chromadb', 'langchain.agents', 'langchain.tools', 
    'langchain_community.tools', 'langchain_core', 'langchain_core.messages',
    'langchain_core.prompts', 'langchain.retrievers', 'langchain.retrievers.contextual_compression',
    'langchain.retrievers.document_compressors', 'langchain.tools.retriever',
    'pandas', 'mysql.connector', 'flask_cors'
]

for mod in mock_modules:
    sys.modules[mod] = MagicMock()

# Also mock submodules if needed
sys.modules['langchain_google_genai'].ChatGoogleGenerativeAI = MagicMock()
sys.modules['langchain_openai'].ChatOpenAI = MagicMock()
sys.modules['fastembed'].FastEmbedEmbeddings = MagicMock()
sys.modules['chromadb'].Chroma = MagicMock()
sys.modules['langchain.agents'].AgentExecutor = MagicMock()
sys.modules['langchain.agents'].create_tool_calling_agent = MagicMock()
sys.modules['langchain_core.messages'].AIMessage = MagicMock
sys.modules['langchain_core.messages'].HumanMessage = MagicMock
sys.modules['langchain_core.prompts'].ChatPromptTemplate = MagicMock()

import pytest
import os
import json
from server import app, app_state, key_pool

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_models_api(client):
    """Test that /api/models returns correctly."""
    response = client.get('/api/models')
    assert response.status_code == 200
    data = response.get_json()
    assert "models" in data
    assert "active" in data
    assert data["active"] == "groq"

def test_settings_api(client):
    """Test updating the active model via /api/settings."""
    response = client.post('/api/settings', json={"model": "gemini"})
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"
    assert data["settings"]["model"] == "gemini"
    assert app_state["model"] == "gemini"

def test_chat_stream_missing_key(client):
    """Test that missing API keys gracefully stream an error without crashing."""
    key_pool.pools["groq"] = []
    app_state["model"] = "groq"
    
    response = client.post('/api/chat_stream', json={"message": "hello"})
    assert response.status_code == 200
    assert response.mimetype == "text/event-stream"
    
    output = response.get_data(as_text=True)
    assert "data: " in output
    assert "No groq API keys available" in output

def test_chat_stream_empty_message(client):
    """Test empty message validation."""
    response = client.post('/api/chat_stream', json={"message": ""})
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
    assert data["error"] == "Empty message"

def test_chat_stream_missing_message_key(client):
    """Test missing message key validation."""
    response = client.post('/api/chat_stream', json={})
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
    assert data["error"] == "Invalid request payload"

def test_env_loading():
    """Test that singular and plural env variables work for API keys."""
    os.environ["GROQ_API_KEY"] = "singular_key_test"
    key_pool._load_from_env()
    assert "singular_key_test" in key_pool.pools["groq"]
    
    os.environ["GROQ_API_KEYS"] = "plural_key_test"
    key_pool._load_from_env()
    assert "plural_key_test" in key_pool.pools["groq"]
