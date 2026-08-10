"""
NeuralRAG — Comprehensive Test Suite
Tests all server functions, security hardening, and tool integrations.
Run: pytest tests/test_comprehensive.py -v
"""
import os
import sys
import pytest

# Add parent directory to path so we can import server
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ============================================================
# 1. IMPORT TESTS — Verify all modules load correctly
# ============================================================

class TestImports:
    """Ensure server.py and all its dependencies import without error."""

    def test_server_imports(self):
        """CRITICAL: server.py must import without errors on Render."""
        import server
        assert hasattr(server, 'app')

    def test_flask_app_exists(self):
        import server
        from flask import Flask
        assert isinstance(server.app, Flask)

    def test_web_search_tool_exists(self):
        """The custom web_search tool wrapper must exist."""
        import server
        assert hasattr(server, 'web_search')
        assert hasattr(server.web_search, 'invoke')

    def test_generate_chart_tool_exists(self):
        import server
        assert hasattr(server, 'generate_chart')
        assert hasattr(server.generate_chart, 'invoke')

    def test_system_control_tool_exists(self):
        import server
        assert hasattr(server, 'system_control')
        assert hasattr(server.system_control, 'invoke')

    def test_mysql_query_tool_exists(self):
        import server
        assert hasattr(server, 'mysql_query')
        assert hasattr(server.mysql_query, 'invoke')


# ============================================================
# 2. SECURITY TESTS — Verify all hardening is in place
# ============================================================

class TestSecurity:
    """Verify security hardening measures are active."""

    def test_cors_not_wildcard(self):
        """CORS must NOT be wildcard *."""
        import server
        # Check that allowed_origins is defined and restrictive
        assert hasattr(server, 'allowed_origins')
        assert len(server.allowed_origins) > 0
        assert "*" not in server.allowed_origins

    def test_upload_size_limit(self):
        """MAX_CONTENT_LENGTH must be set to prevent large uploads."""
        import server
        assert server.app.config.get('MAX_CONTENT_LENGTH') is not None
        assert server.app.config['MAX_CONTENT_LENGTH'] <= 16 * 1024 * 1024

    def test_is_render_detection(self):
        """IS_RENDER flag must exist for cloud deployment detection."""
        import server
        assert hasattr(server, 'IS_RENDER')

    def test_system_control_blocked_on_render(self):
        """system_control must return a block message when IS_RENDER is True."""
        import server
        original = server.IS_RENDER
        try:
            server.IS_RENDER = True
            result = server.system_control.invoke("open chrome")
            assert "disabled" in result.lower() or "security" in result.lower()
        finally:
            server.IS_RENDER = original

    def test_sql_injection_multi_statement_blocked(self):
        """Multi-statement SQL injection must be rejected."""
        import server
        result = server.mysql_query.invoke("SELECT 1; DROP TABLE users")
        assert "not allowed" in result.lower() or "multi-statement" in result.lower()

    def test_sql_injection_allowlist(self):
        """Only SELECT/SHOW/DESCRIBE/EXPLAIN queries allowed."""
        import server
        for bad_cmd in ["DROP TABLE users", "DELETE FROM customers", "INSERT INTO x VALUES(1)", "UPDATE x SET y=1", "CREATE TABLE z(id INT)"]:
            result = server.mysql_query.invoke(bad_cmd)
            assert "only select" in result.lower() or "not allowed" in result.lower(), f"Should block: {bad_cmd}"

    def test_sql_select_allowed(self):
        """SELECT queries should pass the allowlist check (may fail on DB connection, but NOT on allowlist)."""
        import server
        result = server.mysql_query.invoke("SELECT 1")
        # Should NOT say 'not allowed' — it should either succeed or give a DB connection error
        assert "only select" not in result.lower()

    def test_path_traversal_prevented(self):
        """secure_filename must strip path traversal characters."""
        from werkzeug.utils import secure_filename
        dangerous_names = [
            "../../etc/passwd",
            "../../../etc/shadow",
            "..\\..\\windows\\system32\\config\\sam",
            "normal_file.pdf",
            "",
        ]
        for name in dangerous_names:
            safe = secure_filename(name)
            assert "/" not in safe
            assert "\\" not in safe
            assert ".." not in safe

    def test_security_headers_present(self):
        """Security headers must be set on all responses."""
        import server
        client = server.app.test_client()
        resp = client.get("/api/files")
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
        assert resp.headers.get("X-Frame-Options") == "DENY"
        assert resp.headers.get("X-XSS-Protection") == "1; mode=block"

    def test_chat_history_cap(self):
        """MAX_CHAT_HISTORY must be defined and reasonable."""
        import server
        assert hasattr(server, 'MAX_CHAT_HISTORY')
        assert server.MAX_CHAT_HISTORY > 0
        assert server.MAX_CHAT_HISTORY <= 100

    def test_empty_sql_rejected(self):
        """Empty SQL queries must be rejected."""
        import server
        result = server.mysql_query.invoke("")
        assert "empty" in result.lower()


# ============================================================
# 3. API ROUTE TESTS — Verify all endpoints respond correctly
# ============================================================

class TestAPIRoutes:
    """Test all Flask API endpoints."""

    @pytest.fixture
    def client(self):
        import server
        server.app.config['TESTING'] = True
        return server.app.test_client()

    def test_get_files(self, client):
        resp = client.get("/api/files")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "files" in data

    def test_get_models(self, client):
        resp = client.get("/api/models")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "models" in data
        assert "active" in data
        assert len(data["models"]) > 0

    def test_get_keys(self, client):
        resp = client.get("/api/keys")
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, dict)

    def test_clear_chat(self, client):
        resp = client.post("/api/clear")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "ok"

    def test_settings_update(self, client):
        resp = client.post("/api/settings",
                           json={"web_search": True},
                           content_type="application/json")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "ok"

    def test_chat_empty_message(self, client):
        """Empty messages must return 400."""
        resp = client.post("/api/chat",
                           json={"message": ""},
                           content_type="application/json")
        assert resp.status_code == 400

    def test_chat_stream_empty_message(self, client):
        """Empty messages must return 400."""
        resp = client.post("/api/chat_stream",
                           json={"message": ""},
                           content_type="application/json")
        assert resp.status_code == 400

    def test_upload_no_files(self, client):
        """Upload with no files and no paste text should return 400."""
        resp = client.post("/api/upload")
        assert resp.status_code == 400 or resp.status_code == 500

    def test_add_key_invalid_provider(self, client):
        """Adding a key for an unknown provider should return 400."""
        resp = client.post("/api/keys",
                           json={"provider": "invalid_provider", "key": "test123"},
                           content_type="application/json")
        assert resp.status_code == 400

    def test_add_key_empty_key(self, client):
        """Adding an empty key should return 400."""
        resp = client.post("/api/keys",
                           json={"provider": "gemini", "key": ""},
                           content_type="application/json")
        assert resp.status_code == 400

    def test_upload_size_limit(self, client):
        """Uploads exceeding MAX_CONTENT_LENGTH should be rejected."""
        import server
        limit = server.app.config.get('MAX_CONTENT_LENGTH', 16 * 1024 * 1024)
        # We can't easily test this without creating a huge file,
        # but verify the config is set
        assert limit is not None
        assert limit == 16 * 1024 * 1024


# ============================================================
# 4. TOOL FUNCTION TESTS — Verify each tool works correctly
# ============================================================

class TestTools:
    """Test individual tool functions."""

    def test_web_search_returns_results(self):
        """web_search tool must return actual search results."""
        import server
        result = server.web_search.invoke("Python programming language")
        assert isinstance(result, str)
        assert len(result) > 50  # Should have substantial content

    def test_web_search_error_handling(self):
        """web_search must handle errors gracefully."""
        import server
        # Even with an unusual query, it should return something
        result = server.web_search.invoke("asdkjfhaskjdhfkajsdhf")
        assert isinstance(result, str)

    def test_system_control_allowlist(self):
        """system_control should only run allowlisted commands."""
        import server
        original = server.IS_RENDER
        try:
            server.IS_RENDER = False
            # Unknown commands should be blocked
            result = server.system_control.invoke("delete everything")
            assert "unknown command" in result.lower() or "only application shortcuts" in result.lower()
        finally:
            server.IS_RENDER = original

    def test_generate_chart_returns_marker(self):
        """generate_chart must return :::CHART::: markers."""
        import server
        result = server.generate_chart.invoke({
            "chart_type": "bar",
            "title": "Test",
            "labels": "A,B,C",
            "data": "1,2,3"
        })
        assert ":::CHART:::" in result
        assert ":::END:::" in result


# ============================================================
# 5. STATE MANAGEMENT TESTS
# ============================================================

class TestState:
    """Test application state management."""

    def test_initial_state(self):
        import server
        assert "model" in server.app_state
        assert "web_search" in server.app_state
        assert "chat_history" in server.app_state
        assert "uploaded_files" in server.app_state

    def test_key_pool_initialization(self):
        import server
        assert hasattr(server, 'key_pool')
        status = server.key_pool.get_status()
        assert "gemini" in status
        assert "groq" in status
        assert "openrouter" in status

    def test_key_pool_masking(self):
        """API keys should be masked in status output."""
        import server
        server.key_pool.add_key("gemini", "test_key_1234567890abcdef")
        status = server.key_pool.get_status()
        for provider_info in status.values():
            for masked_key in provider_info.get("keys_masked", []):
                # Keys longer than 12 chars should be masked
                if len(masked_key) > 12:
                    assert "..." in masked_key


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
