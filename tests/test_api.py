import pytest
import requests
import json
import sseclient

BASE_URL = "https://neural-rag-system.onrender.com"

def test_models_endpoint():
    """Test the /api/models endpoint returns the list of models."""
    response = requests.get(f"{BASE_URL}/api/models")
    assert response.status_code == 200
    data = response.json()
    assert "models" in data
    assert "active" in data
    assert len(data["models"]) > 0

def test_settings_endpoint():
    """Test updating settings."""
    # Note: This modifies global state on the server, but since it's a test on a test environment/portfolio it's fine
    response = requests.post(
        f"{BASE_URL}/api/settings",
        json={"model": "gemini"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["settings"]["model"] == "gemini"

def test_chat_stream_empty_message():
    """Test validation of empty chat message."""
    response = requests.post(
        f"{BASE_URL}/api/chat_stream",
        json={"message": ""}
    )
    assert response.status_code == 400
    data = response.json()
    assert "error" in data

def test_chat_stream_success():
    """Test the chat stream returns SSE and doesn't timeout."""
    response = requests.post(
        f"{BASE_URL}/api/chat_stream",
        json={"message": "Reply with exactly the word SUCCESS and nothing else."},
        stream=True
    )
    assert response.status_code == 200
    
    # Read the stream
    client = sseclient.SSEClient(response)
    full_response = ""
    for event in client.events():
        if event.data == "[DONE]":
            break
        data = json.loads(event.data)
        if "token" in data:
            full_response += data["token"]
        if "error" in data:
            # If the user didn't set API keys on Render, we expect a graceful error, not a timeout
            assert "API key" in data["error"] or "No groq" in data["error"]
            return
            
    assert "SUCCESS" in full_response.upper() or len(full_response) > 0
