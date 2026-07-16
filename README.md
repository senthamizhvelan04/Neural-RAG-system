# NeuralRAG System

## Overview
NeuralRAG is an enterprise-grade AI Command Center designed to bridge the gap between static data repositories and actionable, dynamic intelligence. By implementing an advanced Retrieval-Augmented Generation (RAG) architecture alongside an autonomous tool-calling engine, NeuralRAG transforms passive documents and databases into an interactive knowledge hub.

## The Problem
Modern organizations suffer from fragmented data silos. Knowledge is trapped within disparate file formats (PDFs, Excel spreadsheets, Text documents) or rigid relational databases. Traditional search tools only return links or raw text, forcing users to manually synthesize information, write complex SQL queries, or rely on separate tools for visualization and web research. 

This fragmentation results in significant context-switching, decreased productivity, and a steep learning curve for non-technical stakeholders who need immediate, synthesized answers from complex datasets.

## The Solution
NeuralRAG solves this by providing a unified, natural language interface to all organizational knowledge. It acts as an intelligent intermediary that can simultaneously read local files, query structured databases, and search the open web, synthesizing the results into coherent, context-aware responses.

Key capabilities include:
- **Intelligent Contextualization**: Users can upload diverse file types (PDF, TXT, XLSX). The system chunks, embeds, and stores this data in a local Chroma vector database for precise semantic retrieval.
- **Autonomous Tool Execution**: The AI engine dynamically selects and executes specialized tools based on the user's intent:
  - Database querying for structured data analysis.
  - Web search for real-time information retrieval.
  - Visual synthesis for generating charts and images natively within the interface.
- **Model Agnosticism**: Built on LangChain, the system supports seamless switching between local models (via LM Studio for complete data privacy) and high-performance cloud models (Groq, Gemini, OpenRouter).

## Implementation Architecture
NeuralRAG is built with a focus on robust backend orchestration and a premium, distraction-free user experience.

### Backend Pipeline
The backend is powered by a Python Flask server integrating LangChain frameworks.
1. **Document Processing**: Uploaded documents are parsed via specialized loaders, split using recursive character strategies, and embedded using FastEmbed before being indexed in a local ChromaDB instance.
2. **Agent Orchestration**: A central agent executor manages tool routing. When a user submits a query, the agent evaluates the context and determines whether to perform a vector search, execute a SQL query, fetch real-time web data, or generate a visual asset.
3. **Self-Healing Visual Delivery**: Image and chart generation utilizes a local proxy architecture to bypass browser-level CORS policies and tracking blockers, ensuring 100% reliable delivery of visual assets.

### Frontend Interface
The frontend is a lightweight, dependency-free vanilla JavaScript, HTML, and CSS application. It utilizes a bioluminescent, deep-ocean aesthetic designed for professional, low-fatigue interaction. The interface features:
- Asynchronous token-based DOM injection for reliable rendering of complex media.
- Responsive, dynamic tool toggling.
- Secure, client-side API key management.

## Getting Started

### Prerequisites
- Python 3.10+
- An active MySQL installation (if database querying is enabled)
- (Optional) LM Studio for local, offline model execution

### Installation
1. Clone the repository.
2. Install the required Python dependencies:
   `pip install -r requirements.txt`
3. Configure your local environment variables in a `.env` file (e.g., database credentials).
4. Run the Flask server:
   `python server.py`
5. Navigate to `http://localhost:5000` in your web browser.
