# NeuralRAG 

NeuralRAG is a personal learning project I built to explore Retrieval-Augmented Generation (RAG), LangChain agents, and autonomous tool-calling. I wanted to move beyond basic API scripts and build a full-stack chat application that can read local files, query a database, and dynamically search the web.

## What It Does
NeuralRAG provides a unified chat interface with several key capabilities:
- **Local File RAG**: Upload diverse file types (PDF, TXT, XLSX). The system chunks, embeds (using FastEmbed), and stores this data in a local Chroma vector database for semantic retrieval.
- **Agentic Tool Execution**: Based on the user's prompt, the LangChain agent dynamically routes to specialized tools:
  - Database querying for structured data analysis.
  - Web search for real-time information retrieval.
  - Visual synthesis for generating charts and images.
- **Model Switching**: Easily swap between local models (via LM Studio) and cloud models (Groq, Gemini, OpenRouter) depending on the task.

## Architecture
The backend is a Python Flask server orchestrating LangChain frameworks, ChromaDB, and custom Python tool functions. The frontend is built with vanilla JavaScript, HTML, and CSS, designed to be lightweight and responsive without heavy modern framework dependencies.

## What I'd Improve Next
Building this taught me a lot, but there's plenty of room for improvement:
1. **Error Handling & State Sync**: The connection between the Flask backend and vanilla JS frontend occasionally drops state during long-running agent tasks. I'd migrate to WebSockets or Server-Sent Events (SSE) for true streaming.
2. **Database Security**: The SQL querying agent currently has too much unconstrained access. In a real-world scenario, this needs strict read-only roles and query sanitization.
3. **Agent Loop Control**: The LangChain agent occasionally gets stuck in thought loops when a tool fails to return expected data. I need to implement better fallback handlers and execution timeouts.

## Setup
1. Clone the repository.
2. Install dependencies: `pip install -r requirements.txt`
3. Configure `.env` variables if using cloud models or the database.
4. Run the backend: `python server.py`
5. Open `http://localhost:5000` in your browser.

---
Built by Senthamizhvelan
