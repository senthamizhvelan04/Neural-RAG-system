import os
import base64
import subprocess
import pandas as pd
import mysql.connector
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Load environment variables
load_dotenv()

# --- LANGCHAIN IMPORTS ---
from langchain_openai import ChatOpenAI
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain.tools.retriever import create_retriever_tool
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.tools import tool

# --- ADVANCED RAG IMPORTS ---
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever, ContextualCompressionRetriever
from langchain.retrievers.document_compressors import FlashrankRerank

# ============================================================
# LOCAL VECTOR DB CONFIG
# ============================================================
CHROMA_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_db_data")
COLLECTION_NAME = "neuralrag_local"

# ============================================================
# API KEY POOL — auto-rotate on failure
# ============================================================
class KeyPool:
    """Manages multiple API keys per provider with automatic rotation."""

    def __init__(self):
        self.pools = {
            "gemini": [],
            "openrouter": [],
            "groq": [],
        }
        self.index = {"gemini": 0, "openrouter": 0, "groq": 0}
        self._load_from_env()

    def _load_from_env(self):
        """Load comma-separated keys from .env file."""
        env_map = {
            "gemini": "GOOGLE_API_KEYS",
            "openrouter": "OPENROUTER_API_KEYS",
            "groq": "GROQ_API_KEYS",
        }
        for provider, env_var in env_map.items():
            raw = os.getenv(env_var, os.getenv(env_var.replace("KEYS", "KEY"), ""))
            keys = [k.strip() for k in raw.split(",") if k.strip()]
            self.pools[provider] = keys
            self.index[provider] = 0

    def get_current_key(self, provider):
        """Get the current active key for a provider."""
        keys = self.pools.get(provider, [])
        if not keys:
            return None
        idx = self.index.get(provider, 0) % len(keys)
        return keys[idx]

    def rotate(self, provider):
        """Move to the next key. Returns True if a new key is available, False if all exhausted."""
        keys = self.pools.get(provider, [])
        if len(keys) <= 1:
            return False
        self.index[provider] = (self.index.get(provider, 0) + 1) % len(keys)
        return True

    def add_key(self, provider, key):
        """Add a new key at runtime."""
        key = key.strip()
        if key and key not in self.pools.get(provider, []):
            if provider not in self.pools:
                self.pools[provider] = []
            self.pools[provider].append(key)
            return True
        return False

    def get_status(self):
        """Return key counts and masked active key per provider."""
        status = {}
        for provider in self.pools:
            keys = self.pools[provider]
            current = self.get_current_key(provider)
            status[provider] = {
                "total": len(keys),
                "active_index": self.index.get(provider, 0) + 1 if keys else 0,
                "active_key_masked": f"{current[:8]}...{current[-4:]}" if current and len(current) > 12 else current or "none",
                "keys_masked": [f"{k[:8]}...{k[-4:]}" if len(k) > 12 else k for k in keys],
            }
        return status


key_pool = KeyPool()

# ============================================================
# MODEL CONFIGURATIONS
# ============================================================
MODEL_CONFIGS = {
    "groq": {
        "name": "Groq (Llama 3.3 70B)",
        "base_url": "https://api.groq.com/openai/v1",
        "key_provider": "groq",
        "model": "llama-3.3-70b-versatile",
    },
    "openrouter": {
        "name": "OpenRouter (Auto)",
        "base_url": "https://openrouter.ai/api/v1",
        "key_provider": "openrouter",
        "model": "meta-llama/llama-3.3-70b-instruct",
    },
    "gemini": {
        "name": "Gemini Flash (Latest)",
        "type": "gemini",
        "key_provider": "gemini",
        "model": "gemini-flash-latest",
    },
    "local": {
        "name": "LM Studio (Offline)",
        "base_url": "http://127.0.0.1:1234/v1",
        "key_provider": None,
        "model": "qwen2.5-14b-instruct",
    },
}

# ============================================================
# SYSTEM CONTROL TOOL
# ============================================================
APP_SHORTCUTS = {
    "chrome": "start chrome", "google chrome": "start chrome",
    "notepad": "start notepad", "calculator": "start calc", "calc": "start calc",
    "file explorer": "start explorer", "explorer": "start explorer",
    "cmd": "start cmd", "terminal": "start cmd", "command prompt": "start cmd",
    "powershell": "start powershell", "task manager": "start taskmgr",
    "paint": "start mspaint", "word": "start winword", "excel": "start excel",
    "vscode": "start code", "vs code": "start code", "spotify": "start spotify",
    "settings": "start ms-settings:", "snipping tool": "start snippingtool",
}

@tool
def system_control(command: str) -> str:
    """Execute a system command on the user's Windows PC.
    Use this to open applications (e.g. 'open chrome', 'open notepad'),
    run terminal commands (e.g. 'list files', 'show ip address'),
    or open websites (e.g. 'open youtube.com').
    Input should be a natural language description of what to do.
    """
    cmd_lower = command.lower().strip()
    for prefix in ["open ", "launch ", "start "]:
        if cmd_lower.startswith(prefix):
            target = cmd_lower[len(prefix):].strip()
            if target in APP_SHORTCUTS:
                try:
                    subprocess.Popen(APP_SHORTCUTS[target], shell=True)
                    return f"Opened {target} successfully."
                except Exception as e:
                    return f"Failed to open {target}: {e}"
            if "." in target and " " not in target:
                url = target if target.startswith("http") else f"https://{target}"
                try:
                    subprocess.Popen(f'start "" "{url}"', shell=True)
                    return f"Opened {url} in browser."
                except Exception as e:
                    return f"Failed to open URL: {e}"
            try:
                subprocess.Popen(f"start {target}", shell=True)
                return f"Tried to open '{target}'."
            except Exception as e:
                return f"Could not open '{target}': {e}"
    try:
        result = subprocess.run(cmd_lower, shell=True, capture_output=True, text=True, timeout=15)
        output = result.stdout.strip() or result.stderr.strip() or "Command executed (no output)."
        return f"Command result:\n{output}"
    except subprocess.TimeoutExpired:
        return "Command timed out after 15 seconds."
    except Exception as e:
        return f"Error running command: {e}"

# ============================================================
# MYSQL QUERY TOOL
# ============================================================
def get_mysql_connection():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "neuralrag_db")
    )

@tool
def mysql_query(query: str) -> str:
    """Run a SQL query on the connected MySQL database and return results.
    Use this when the user asks about customers, employees, products, orders, or any database data.
    You can run SELECT, SHOW, or DESCRIBE queries.
    Always use SELECT queries to answer questions about data.
    """
    query_stripped = query.strip().rstrip(';')
    first_word = query_stripped.split()[0].upper() if query_stripped else ""
    if first_word in ("DROP", "DELETE", "TRUNCATE", "ALTER", "UPDATE", "INSERT", "CREATE"):
        return "Only SELECT / SHOW / DESCRIBE queries are allowed for safety."
    try:
        conn = get_mysql_connection()
        cursor = conn.cursor()
        cursor.execute(query_stripped)
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        if not rows:
            return "Query returned 0 rows."

        header = "| " + " | ".join(columns) + " |"
        sep = "| " + " | ".join(["---"] * len(columns)) + " |"
        body = "\n".join("| " + " | ".join(str(v) for v in row) + " |" for row in rows[:50])
        result = f"{header}\n{sep}\n{body}"
        if len(rows) > 50:
            result += f"\n\n*...showing 50 of {len(rows)} rows*"
        return f"Query returned {len(rows)} rows:\n\n{result}"
    except Exception as e:
        return f"Database Error: {e}. IMPORTANT: The database is offline. Use 'knowledge_base_search' to look for the information in the user's uploaded files instead."

# ============================================================
# IMAGE GENERATION TOOL
# ============================================================
import urllib.parse

import requests
import time
import random
import urllib.parse

@tool
def generate_image(prompt: str) -> str:
    """Generate an image based on a description.
    Use this tool when the user asks you to 'draw', 'paint', 'create an image', or 'generate a picture'.
    The input MUST be a detailed descriptive prompt for the image.
    This tool returns a local URL for the generated image.
    """
    try:
        # Create directory if it doesn't exist
        gen_dir = os.path.join("static", "generated")
        if not os.path.exists(gen_dir):
            os.makedirs(gen_dir)
            
        encoded_prompt = urllib.parse.quote(prompt)
        seed = random.randint(1, 1000000)
        
        # Try different models to bypass specific overloaded queues
        models_to_try = ["flux", "turbo", ""]
        last_error = ""
        
        for model in models_to_try:
            model_param = f"&model={model}" if model else ""
            pollinations_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?seed={seed}&nologo=true{model_param}"
            
            try:
                # Fetch image on backend to bypass browser CORS/Referrer blocks
                response = requests.get(pollinations_url, timeout=45)
                if response.status_code == 200:
                    filename = f"gen_{int(time.time())}_{seed}.jpg"
                    filepath = os.path.join(gen_dir, filename)
                    with open(filepath, "wb") as f:
                        f.write(response.content)
                    
                    # Return local URL that the browser can always load
                    local_url = f"/static/generated/{filename}"
                    return f":::IMAGE:::{local_url}:::END:::"
                elif response.status_code == 429:
                    last_error = "429 Too Many Requests"
                    time.sleep(2) # Backoff before trying next model
                    continue
                else:
                    last_error = f"Status {response.status_code}"
            except requests.Timeout:
                last_error = "Timeout"
                continue
            except Exception as e:
                last_error = str(e)
                continue
                
        return f"Error: Image service is currently overloaded ({last_error}). Please try again later."
    except Exception as e:
        return f"Error generating image: {str(e)}"

@tool
def generate_chart(chart_type: str, title: str, labels: str, data: str) -> str:
    """Generate a data visualization chart (bar, line, or pie).
    Use this tool ONLY when the user asks to visualize data, plot a chart, or graph uploaded data.
    chart_type: 'bar', 'line', or 'pie'
    title: The title of the chart
    labels: Comma-separated labels for the X-axis or slices (e.g. "Arun,Priya,Rahul")
    data: Comma-separated numerical data (e.g. "55000,45000,50000")
    """
    labels_list = [l.strip() for l in labels.split(',')]
    data_list = [d.strip() for d in data.split(',')]
    
    import json
    config = {
        "type": chart_type,
        "data": {
            "labels": labels_list,
            "datasets": [{
                "label": title,
                "data": data_list,
                "backgroundColor": ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]
            }]
        },
        "options": {
            "title": { "display": True, "text": title }
        }
    }
    encoded_config = urllib.parse.quote(json.dumps(config))
    url = f"https://quickchart.io/chart?c={encoded_config}&w=800&h=400"
    
    try:
        gen_dir = os.path.join("static", "generated")
        if not os.path.exists(gen_dir): os.makedirs(gen_dir)
        
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            filename = f"chart_{int(time.time())}.png"
            filepath = os.path.join(gen_dir, filename)
            with open(filepath, "wb") as f:
                f.write(response.content)
            
            local_url = f"/static/generated/{filename}"
            return f":::CHART:::{local_url}:::END:::"
    except:
        pass
        
    return f":::CHART:::{url}:::END:::" # Fallback to direct URL if backend fetch fails

# ============================================================
# FLASK APP
# ============================================================
app = Flask(__name__, static_folder="frontend-react/dist", static_url_path="/")
CORS(app)

# --- LOCAL EMBEDDINGS (loaded once) ---
dense_embeddings = None

def get_embeddings():
    global dense_embeddings
    if dense_embeddings is None:
        print("[*] Loading embedding model (first time may take a moment)...")
        from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
        dense_embeddings = FastEmbedEmbeddings()
        print("[OK] Embedding model loaded!")
    return dense_embeddings

# --- STATE ---
app_state = {
    "model": "groq",  # Default to Groq on Render since LM Studio is not available
    "web_search": False,
    "system_control": True,
    "mysql_enabled": True,
    "image_gen_enabled": True,
    "chat_history": [],
    "uploaded_files": [],
}

def get_llm():
    """Get LLM instance using current key from the pool."""
    model_key = app_state["model"]
    config = MODEL_CONFIGS.get(model_key, MODEL_CONFIGS["local"])

    # Gemini uses its own LangChain class
    if config.get("type") == "gemini":
        api_key = key_pool.get_current_key("gemini")
        if not api_key:
            raise ValueError("No Gemini API keys available. Add one via the sidebar.")
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=config["model"],
            google_api_key=api_key,
            temperature=0,
            max_retries=2,
        )

    # All others use OpenAI-compatible API (Groq, OpenRouter, LM Studio)
    provider = config.get("key_provider")
    if provider:
        api_key = key_pool.get_current_key(provider)
        if not api_key:
            raise ValueError(f"No {provider} API keys available. Add one via the sidebar.")
    else:
        api_key = "lm-studio"

    return ChatOpenAI(
        base_url=config["base_url"],
        api_key=api_key,
        model=config["model"],
        temperature=0,
    )

def get_vector_store():
    """Get or create the local ChromaDB vector store."""
    return Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=get_embeddings(),
        persist_directory=CHROMA_DB_PATH,
    )

# --- GLOBAL BM25 RETRIEVER ---
global_bm25_retriever = None

def update_bm25_retriever():
    """Rebuild BM25 sparse index from ChromaDB."""
    global global_bm25_retriever
    try:
        vs = get_vector_store()
        db_data = vs.get(include=["documents", "metadatas"])
        docs = []
        if db_data and db_data.get("documents"):
            for doc_text, meta in zip(db_data["documents"], db_data["metadatas"]):
                if doc_text:
                    docs.append(Document(page_content=doc_text, metadata=meta))
        
        if docs:
            global_bm25_retriever = BM25Retriever.from_documents(docs)
            global_bm25_retriever.k = 15
            print(f"[OK] BM25 Sparse Index rebuilt with {len(docs)} documents.")
        else:
            global_bm25_retriever = None
    except Exception as e:
        print(f"[Warning] Failed to initialize BM25: {e}")

# Do NOT initialize on startup to avoid Gunicorn fork() deadlocks with ONNX Runtime!
# update_bm25_retriever()

def get_agent():
    llm = get_llm()
    vector_store = get_vector_store()
    
    # 1. Dense Retriever (Chroma)
    dense_retriever = vector_store.as_retriever(search_kwargs={"k": 15})
    
    # 2. Hybrid Search (Ensemble: Dense + Sparse)
    if global_bm25_retriever:
        ensemble_retriever = EnsembleRetriever(
            retrievers=[dense_retriever, global_bm25_retriever], 
            weights=[0.5, 0.5]
        )
    else:
        ensemble_retriever = dense_retriever
        
    # 3. Cross-Encoder Reranking (FlashRank) - DISABLED for Render deployment due to 30s timeout
    # compressor = FlashrankRerank(top_n=5)
    # advanced_retriever = ContextualCompressionRetriever(
    #     base_compressor=compressor, 
    #     base_retriever=ensemble_retriever
    # )
    advanced_retriever = ensemble_retriever

    retriever_tool = create_retriever_tool(
        advanced_retriever, 
        "knowledge_base_search",
        "Use this tool to find information in uploaded documents and Excel files. This uses an advanced Hybrid Search + Reranker pipeline."
    )

    tools = [retriever_tool]
    if app_state["web_search"]:
        tools.append(DuckDuckGoSearchRun())
    if app_state["system_control"]:
        tools.append(system_control)
    if app_state["mysql_enabled"]:
        tools.append(mysql_query)
    if app_state.get("image_gen_enabled", True):
        tools.append(generate_image)
        tools.append(generate_chart)

    db_info = ""
    if app_state["mysql_enabled"]:
        db_info = """\n        6. If you think the user is asking about the database, use 'mysql_query'.
           Write proper SQL SELECT queries. The database tables are:
           - customers, employees, offices, orderdetails, orders, payments, productlines, products
           CRITICAL: If 'mysql_query' returns a Database Error, use 'knowledge_base_search' to find the answer in uploaded files instead.
        """

    prompt = ChatPromptTemplate.from_messages([
        ("system", f"""You are a smart assistant with system control, database, and image generation capabilities.
        1. FIRST check 'chat_history' for context.
        2. THEN use 'knowledge_base_search' to find answers in the uploaded files.
        3. If the user asks about a specific row or data point in an Excel file, search for the keywords in that row.
        4. If the user asks to open an application or run a system command, use the 'system_control' tool.
        5. CRITICAL: If the user asks to draw, paint, or generate an artistic picture, use 'generate_image'. If the user asks to visualize data, plot a chart, or create a graph from data, use the 'generate_chart' tool. Both tools return an HTML img tag. You MUST include this EXACT HTML tag in your final response without modifying it.
        6. Format your responses using Markdown for readability.
        {db_info}"""),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        ("placeholder", "{agent_scratchpad}"),
    ])

    agent = create_tool_calling_agent(llm, tools, prompt)
    return AgentExecutor(agent=agent, tools=tools, verbose=True, return_intermediate_steps=True)

def process_excel(file_path):
    try:
        df = pd.read_excel(file_path)
        content = f"Source File: {os.path.basename(file_path)}\n\n"
        content += df.to_string(index=False)
        return content
    except Exception as e:
        return f"Error reading Excel: {str(e)}"

# ============================================================
# ROUTES
# ============================================================


import json
from flask import Response

@app.route("/api/chat_stream", methods=["POST"])
def chat_stream():
    try:
        data = request.json
        user_message = data.get("message", "").strip()
        if not user_message:
            return jsonify({"error": "Empty message"}), 400

        chat_history = []
        for msg in app_state["chat_history"]:
            if msg["role"] == "user":
                chat_history.append(HumanMessage(content=msg["content"]))
            else:
                chat_history.append(AIMessage(content=msg["content"]))
        
        def generate():
            import threading
            import queue
            q = queue.Queue()
            
            # Pre-load embeddings and BM25 in the main thread to avoid ONNX thread deadlocks
            get_embeddings()
            if global_bm25_retriever is None:
                update_bm25_retriever()
            
            def run_agent():
                try:
                    agent_executor = get_agent()
                    for chunk in agent_executor.stream({"input": user_message, "chat_history": chat_history}):
                        q.put({"type": "chunk", "data": chunk})
                    q.put({"type": "done"})
                except Exception as e:
                    q.put({"type": "error", "error": str(e)})

            t = threading.Thread(target=run_agent)
            t.start()

            try:
                yield f"data: {json.dumps({'status': 'Connecting to AI model...'})}\n\n"
                final_answer = ""
                tools_used = []
                
                while True:
                    try:
                        item = q.get(timeout=5.0)
                    except queue.Empty:
                        # Keep-alive to prevent Gunicorn timeout
                        yield f"data: {json.dumps({'status': 'Processing...'})}\n\n"
                        continue
                        
                    if item["type"] == "error":
                        yield f"data: {json.dumps({'error': item['error']})}\n\n"
                        break
                    elif item["type"] == "done":
                        if tools_used:
                            observations = "\n".join([f"Used tool: {t}" for t in set(tools_used)])
                            if observations not in final_answer:
                                final_answer += f"\n\n{observations}"
                                token_val = "\n\n" + observations
                                yield f"data: {json.dumps({'token': token_val})}\n\n"
                        yield f"data: [DONE]\n\n"
                        
                        # Save to history AFTER yielding done
                        app_state["chat_history"].append({"role": "user", "content": user_message})
                        app_state["chat_history"].append({"role": "assistant", "content": final_answer})
                        break
                    elif item["type"] == "chunk":
                        chunk = item["data"]
                        # Langchain stream yields dicts like {'actions': ...} or {'steps': ...} or {'output': ...}
                        if "actions" in chunk:
                            for action in chunk["actions"]:
                                yield f"data: {json.dumps({'status': f'Running tool: {action.tool}'})}\n\n"
                                tools_used.append(action.tool)
                        elif "steps" in chunk:
                            pass
                        elif "output" in chunk:
                            answer = chunk["output"]
                            yield f"data: {json.dumps({'token': answer})}\n\n"
                            final_answer += answer

            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return Response(generate(), mimetype="text/event-stream", headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        user_message = data.get("message", "").strip()
        if not user_message:
            return jsonify({"error": "Empty message"}), 400

        chat_history = []
        for msg in app_state["chat_history"]:
            if msg["role"] == "user":
                chat_history.append(HumanMessage(content=msg["content"]))
            else:
                chat_history.append(AIMessage(content=msg["content"]))

        # --- Auto-rotation: try current key, rotate on failure ---
        model_key = app_state["model"]
        config = MODEL_CONFIGS.get(model_key, {})
        provider = config.get("key_provider")
        max_retries = len(key_pool.pools.get(provider, [])) if provider else 1
        max_retries = max(max_retries, 1)

        last_error = None
        for attempt in range(max_retries):
            try:
                agent_executor = get_agent()
                response = agent_executor.invoke({
                    "input": user_message,
                    "chat_history": chat_history
                })
                answer = response["output"]

                # Force-append image/chart HTML if the LLM stripped it
                if "intermediate_steps" in response:
                    for action, observation in response["intermediate_steps"]:
                        if action.tool in ["generate_image", "generate_chart"]:
                            if observation not in answer:
                                answer += f"\n\n{observation}"

                app_state["chat_history"].append({"role": "user", "content": user_message})
                app_state["chat_history"].append({"role": "assistant", "content": answer})

                return jsonify({"response": answer})

            except Exception as e:
                last_error = str(e)
                # Automatically rotate key on ANY error (quota, invalid key, rate limit, API down)
                if provider:
                    old_key = key_pool.get_current_key(provider)
                    rotated = key_pool.rotate(provider)
                    new_key = key_pool.get_current_key(provider)
                    if rotated and new_key != old_key:
                        print(f"[KEY ROTATION] {provider}: Attempt {attempt+1} failed with error '{last_error[:50]}...'. Switching to next key.")
                        continue
                # Non-rotatable error or no more keys available
                break

        return jsonify({"error": f"All {provider or model_key} keys exhausted. Last error: {last_error}"}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/ping_groq", methods=["GET"])
def ping_groq():
    import requests
    try:
        api_key = key_pool.get_current_key("groq")
        if not api_key:
            return jsonify({"status": "no key"})
        # 5 second timeout
        res = requests.get("https://api.groq.com/openai/v1/models", headers={"Authorization": f"Bearer {api_key}"}, timeout=5)
        return jsonify({"status": res.status_code, "text": res.text[:100]})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)})

@app.route("/api/upload", methods=["POST"])
def upload():
    try:
        files = request.files.getlist("files")
        paste_text = request.form.get("paste_text", "").strip()
        documents = []

        for f in files:
            app_state["uploaded_files"].append(f.filename)
            file_path = f"./temp_{f.filename}"
            f.save(file_path)
            if f.filename.endswith(".pdf"):
                loaded = PyPDFLoader(file_path).load()
                for doc in loaded:
                    doc.page_content = f"Source: {f.filename}\n" + doc.page_content
                documents.extend(loaded)
            elif f.filename.endswith(".docx"):
                loaded = Docx2txtLoader(file_path).load()
                for doc in loaded:
                    doc.page_content = f"Source: {f.filename}\n" + doc.page_content
                documents.extend(loaded)
            elif f.filename.endswith((".xlsx", ".xls")):
                text_data = process_excel(file_path)
                documents.append(Document(page_content=text_data, metadata={"source": f.filename}))
            elif f.filename.endswith((".jpg", ".jpeg", ".png")):
                with open(file_path, "rb") as img_file:
                    image_b64 = base64.b64encode(img_file.read()).decode("utf-8")
                llm = get_llm()
                message = HumanMessage(content=[
                    {"type": "text", "text": "Describe this image in detail for search indexing."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}}
                ])
                desc = llm.invoke([message]).content
                documents.append(Document(page_content=desc, metadata={"source": f.filename}))
            else:
                documents.extend(TextLoader(file_path, encoding="utf-8").load())

        if paste_text:
            documents.append(Document(page_content=paste_text, metadata={"source": "User Paste"}))

        if not documents:
            return jsonify({"error": "No data found to save"}), 400

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(documents)

        vector_store = get_vector_store()
        vector_store.add_documents(chunks)
        
        # Rebuild BM25 with the new chunks
        update_bm25_retriever()

        return jsonify({"message": f"Saved {len(chunks)} chunks to brain! (stored locally)", "chunks": len(chunks)})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/settings", methods=["POST"])
def settings():
    data = request.json
    if "model" in data:
        app_state["model"] = data["model"]
    if "web_search" in data:
        app_state["web_search"] = data["web_search"]
    if "system_control" in data:
        app_state["system_control"] = data["system_control"]
    if "mysql_enabled" in data:
        app_state["mysql_enabled"] = data["mysql_enabled"]
    if "image_gen_enabled" in data:
        app_state["image_gen_enabled"] = data["image_gen_enabled"]
    return jsonify({"status": "ok", "settings": app_state})

@app.route("/api/clear", methods=["POST"])
def clear():
    app_state["chat_history"] = []
    return jsonify({"status": "ok"})

@app.route("/api/files", methods=["GET"])
def get_files():
    return jsonify({"files": app_state["uploaded_files"]})

@app.route("/api/files/<path:filename>", methods=["DELETE"])
def delete_file(filename):
    try:
        if filename in app_state["uploaded_files"]:
            app_state["uploaded_files"].remove(filename)
            
        file_path = f"./temp_{filename}"
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass
                
        # Remove from Chroma DB
        try:
            vector_store = get_vector_store()
            vector_store._collection.delete(where={"source": filename})
            update_bm25_retriever()
        except Exception as e:
            print(f"[Warning] Could not delete '{filename}' from ChromaDB: {e}")
            
        return jsonify({"message": "File removed successfully", "status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ============================================================
# API KEY MANAGEMENT ROUTES
# ============================================================

@app.route("/api/keys", methods=["GET"])
def get_keys():
    """Return masked key info for all providers."""
    return jsonify(key_pool.get_status())

@app.route("/api/keys", methods=["POST"])
def add_key():
    """Add a new API key for a provider."""
    data = request.json
    provider = data.get("provider", "").strip().lower()
    key = data.get("key", "").strip()

    if provider not in key_pool.pools:
        return jsonify({"error": f"Unknown provider: {provider}. Use: gemini, openrouter, groq"}), 400
    if not key:
        return jsonify({"error": "API key cannot be empty"}), 400

    added = key_pool.add_key(provider, key)
    if added:
        return jsonify({"message": f"Key added to {provider}! Total keys: {len(key_pool.pools[provider])}", "status": key_pool.get_status()})
    else:
        return jsonify({"error": "Key already exists or is invalid"}), 400

@app.route("/api/keys/active", methods=["POST"])
def set_active_key():
    """Manually set the active key for a provider."""
    data = request.json
    provider = data.get("provider", "").strip().lower()
    index_str = data.get("index")
    
    if provider in key_pool.pools and index_str is not None:
        try:
            idx = int(index_str) - 1
            if 0 <= idx < len(key_pool.pools[provider]):
                key_pool.index[provider] = idx
                return jsonify({"message": f"Active key set", "status": key_pool.get_status()})
        except ValueError:
            pass
    return jsonify({"error": "Invalid request"}), 400

@app.route("/api/models", methods=["GET"])
def list_models():
    """Return available models for the frontend."""
    models = []
    for key, config in MODEL_CONFIGS.items():
        provider = config.get("key_provider")
        has_key = True
        if provider:
            has_key = bool(key_pool.get_current_key(provider))
        models.append({
            "id": key,
            "name": config["name"],
            "available": has_key,
        })
    return jsonify({"models": models, "active": app_state["model"]})

from flask import send_from_directory

@app.route('/static/generated/<path:filename>')
def serve_generated_images(filename):
    return send_from_directory('static/generated', filename)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    import webbrowser, threading
    def open_browser():
        webbrowser.open("http://localhost:5000")
    threading.Timer(1.5, open_browser).start()

    print("\n========================================")
    print("  NeuralRAG Server - Local Vector DB")
    print("========================================")
    print(f"  URL:     http://localhost:5000")
    print(f"  Vectors: {CHROMA_DB_PATH}")
    print(f"  Model:   {MODEL_CONFIGS[app_state['model']]['name']}")
    print(f"  Keys:    Gemini={len(key_pool.pools['gemini'])}, Groq={len(key_pool.pools['groq'])}, OpenRouter={len(key_pool.pools['openrouter'])}")
    print("========================================\n")

    app.run(host="0.0.0.0", port=5000, debug=False)
