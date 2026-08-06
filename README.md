# NeuralRAG: Autonomous Agentic RAG System

**Live Demo:** [https://neural-rag-system.onrender.com/](https://neural-rag-system.onrender.com/)

[![Python](https://img.shields.io/badge/Python-3.11+-blue?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![LangChain](https://img.shields.io/badge/LangChain-Enabled-lightgrey?style=for-the-badge)](https://langchain.com/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)

**NeuralRAG** is a production-ready, full-stack AI chat application built to demonstrate advanced **Retrieval-Augmented Generation (RAG)**, autonomous agentic workflows, and tool-calling capabilities. 

Moving beyond basic wrapper scripts, this system dynamically routes user queries to specialized tools, queries relational databases, performs hybrid vector searches, and synthesizes data—all through a sleek, responsive UI.

---

## Key Features

- **Advanced Document RAG (Hybrid Search)**: Upload diverse file types (PDF, DOCX, TXT, XLSX). The system chunks, embeds using `FastEmbed`, and stores data in a local Chroma vector database.
- **Autonomous Tool-Calling Agent**: Powered by LangChain, the core LLM acts as an autonomous routing agent that can intelligently decide when to use:
  - **SQL Query Agent**: Dynamically generates and executes safe `SELECT` queries against a MySQL database for structured data analysis.
  - **Web Search**: Integrates DuckDuckGo to pull real-time information when local knowledge is insufficient.
  - **Data Visualization**: Synthesizes tabular data into charts and visual graphs dynamically.
- **Dynamic Model Switching**: Hot-swap between cutting-edge LLMs on the fly, including **Groq (Llama-3)**, **Google Gemini**, **OpenRouter**, or fully offline via **LM Studio**.
- **Production-Hardened Backend**: Features a robust, multi-threaded Server-Sent Events (SSE) streaming architecture built to prevent Gunicorn worker deadlocks during heavy ONNX model inferencing.

---

## Tech Stack & Architecture

### Backend
* **Framework:** Python, Flask
* **AI Orchestration:** LangChain, OpenAI spec-compatible APIs
* **Vector DB & Embeddings:** ChromaDB, `FastEmbedEmbeddings` (ONNX Runtime)
* **Integrations:** MySQL Connector, DuckDuckGo Search, Pollinations Image Gen

### Frontend
* **Framework:** React 18, Vite, TypeScript
* **Styling & Animation:** Tailwind CSS, Framer Motion
* **Real-time UX:** Server-Sent Events (SSE) for sub-second token streaming and heartbeat keep-alives.

---

## How It Works Under the Hood

When a user submits a prompt, NeuralRAG performs the following pipeline:
1. **Context Hydration**: The system polls the active conversation history.
2. **Agentic Reasoning**: The LLM analyzes the prompt against available tools.
3. **Execution**: 
   - If the user asks about an uploaded document, the system performs a hybrid semantic search.
   - If the user asks about customer data, the system queries the MySQL database.
   - If the user wants a visualization, the agent writes a chart configuration.
4. **Streaming Response**: The execution loop yields intermediate reasoning steps (e.g., `Running tool: mysql_query`) to the frontend before streaming the final synthesized answer token-by-token.

---

## Getting Started Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- MySQL Server (optional, for DB tool)

### Installation
1. **Clone the repository:**
   ```bash
   git clone https://github.com/senthamizhvelan04/Neural-RAG-system.git
   cd Neural-RAG-system
   ```
2. **Setup Backend:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   GROQ_API_KEYS=your_groq_key
   GOOGLE_API_KEYS=your_gemini_key
   MYSQL_HOST=localhost
   MYSQL_USER=root
   MYSQL_PASSWORD=your_password
   MYSQL_DATABASE=neuralrag_db
   ```
4. **Run the Application:**
   ```bash
   python server.py
   ```
5. Open your browser and navigate to `http://localhost:5000`.

---

## Future Roadmap

- **WebSocket Migration**: Transitioning from SSE to full bi-directional WebSockets for enhanced interruption controls.
- **Role-Based DB Access**: Implementing strict read-only database connections with query sanitization layers to ensure absolute security in enterprise environments.
- **Cross-Encoder Reranking**: Re-enabling FlashRank rerankers for even higher precision semantic retrieval.

---

*Designed and engineered by [Senthamizhvelan](https://github.com/senthamizhvelan04).*
