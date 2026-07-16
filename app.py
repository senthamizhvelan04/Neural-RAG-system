import streamlit as st
import os
import base64
import time
import subprocess
import pandas as pd  # <--- CRITICAL: Import Pandas
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- IMPORTS ---
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_qdrant import QdrantVectorStore, RetrievalMode, FastEmbedSparse
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, AIMessage
from qdrant_client import QdrantClient
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# --- AGENT & TOOLS IMPORTS ---
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain.tools.retriever import create_retriever_tool
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.tools import tool

# --- SYSTEM CONTROL TOOL (MCP) ---
APP_SHORTCUTS = {
    "chrome": "start chrome",
    "google chrome": "start chrome",
    "notepad": "start notepad",
    "calculator": "start calc",
    "calc": "start calc",
    "file explorer": "start explorer",
    "explorer": "start explorer",
    "cmd": "start cmd",
    "terminal": "start cmd",
    "command prompt": "start cmd",
    "powershell": "start powershell",
    "task manager": "start taskmgr",
    "paint": "start mspaint",
    "word": "start winword",
    "excel": "start excel",
    "vscode": "start code",
    "vs code": "start code",
    "spotify": "start spotify",
    "settings": "start ms-settings:",
    "snipping tool": "start snippingtool",
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

    # 1. Check for "open <app>" pattern
    for prefix in ["open ", "launch ", "start "]:
        if cmd_lower.startswith(prefix):
            target = cmd_lower[len(prefix):].strip()

            # Check known app shortcuts
            if target in APP_SHORTCUTS:
                try:
                    subprocess.Popen(APP_SHORTCUTS[target], shell=True)
                    return f"✅ Opened {target} successfully."
                except Exception as e:
                    return f"❌ Failed to open {target}: {e}"

            # Check if it looks like a URL
            if "." in target and " " not in target:
                url = target if target.startswith("http") else f"https://{target}"
                try:
                    subprocess.Popen(f'start "" "{url}"', shell=True)
                    return f"✅ Opened {url} in browser."
                except Exception as e:
                    return f"❌ Failed to open URL: {e}"

            # Try opening as a generic command
            try:
                subprocess.Popen(f"start {target}", shell=True)
                return f"✅ Tried to open '{target}'."
            except Exception as e:
                return f"❌ Could not open '{target}': {e}"

    # 2. Direct shell command execution
    try:
        result = subprocess.run(
            cmd_lower, shell=True, capture_output=True, text=True, timeout=15
        )
        output = result.stdout.strip() or result.stderr.strip() or "Command executed (no output)."
        return f"✅ Command result:\n{output}"
    except subprocess.TimeoutExpired:
        return "⏱️ Command timed out after 15 seconds."
    except Exception as e:
        return f"❌ Error running command: {e}"

# --- FIX: Commented out broken imports ---
# from langchain.retrievers import ContextualCompressionRetriever
# from langchain.retrievers.document_compressors import FlashrankRerank

# --- PAGE CONFIG ---
st.set_page_config(page_title="Production RAG", layout="wide", page_icon="🧠")
st.title("Production RAG 🧠 (Hybrid + Memory + Excel Support)")

# 1. SETUP LLM
with st.sidebar:
    st.header("⚙️ Settings")
    model_choice = st.radio("Select AI Model 🤖", ["Gemini 2.5 Flash", "Local LM Studio (Offline)"])

if model_choice == "Gemini 2.5 Flash":
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash", 
        temperature=0,
        max_retries=2,
    )
else:
    from langchain_openai import ChatOpenAI
    llm = ChatOpenAI(
        base_url="http://127.0.0.1:1234/v1",
        api_key="lm-studio",
        model="local-model",
        temperature=0,
    )

# 2. SETUP QDRANT CLOUD
url = os.getenv("QDRANT_URL")
api_key = os.getenv("QDRANT_API_KEY")
collection_name = "production_hybrid_v4" 

if not url or not api_key:
    st.error("Missing keys in .env")
    st.stop()

client = QdrantClient(url=url, api_key=api_key)

# --- HELPER: STREAMING GENERATOR ---
def stream_text(text):
    for word in text.split(" "):
        yield word + " "
        time.sleep(0.02)

# --- HELPER: IMAGE TO TEXT ---
def summarize_image(image_file):
    image_bytes = image_file.getvalue()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    message = HumanMessage(
        content=[
            {"type": "text", "text": "Describe this image in detail for search indexing."},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}}
        ]
    )
    response = llm.invoke([message])
    return response.content

# --- HELPER: EXCEL TO TEXT (THE FIX) ---
def process_excel(file_path):
    """Reads Excel and converts it to text format for the AI"""
    try:
        df = pd.read_excel(file_path)
        # Convert to text so the AI can read it like a document
        return df.to_string(index=False)
    except Exception as e:
        return f"Error reading Excel: {str(e)}"

# --- 3. SIDEBAR (DATA LOADING) ---
with st.sidebar:
    use_web_search = st.toggle("Enable Web Search 🌍", value=False)
    use_system_control = st.toggle("Enable System Control 🖥️", value=True)
    
    if st.button("🧹 Clear Chat History"):
        st.session_state.messages = []
        st.rerun()
    
    st.divider()
    st.header("📂 Knowledge Base")
    
    # --- THE FIX IS HERE: Added "xlsx" and "xls" to allowed types ---
    uploaded_files = st.file_uploader(
        "Upload Data", 
        type=["pdf", "txt", "jpg", "png", "xlsx", "xls"], 
        accept_multiple_files=True
    )
    
    user_text_input = st.text_area("Paste Text:", height=100)
    process_btn = st.button("Save to Brain")

    if process_btn:
        documents = []
        with st.spinner("Processing & Vectorizing..."):
            # 1. Handle Files
            if uploaded_files:
                for uploaded_file in uploaded_files:
                    file_path = f"./temp_{uploaded_file.name}"
                    
                    # Image Logic
                    if uploaded_file.type in ["image/jpeg", "image/png"]:
                        desc = summarize_image(uploaded_file)
                        documents.append(Document(page_content=desc, metadata={"source": uploaded_file.name}))
                    
                    # Document Logic
                    else:
                        with open(file_path, "wb") as f:
                            f.write(uploaded_file.getbuffer())
                        
                        if uploaded_file.name.endswith(".pdf"):
                            documents.extend(PyPDFLoader(file_path).load())
                        
                        # --- EXCEL LOGIC ---
                        elif uploaded_file.name.endswith((".xlsx", ".xls")):
                            text_data = process_excel(file_path)
                            documents.append(Document(page_content=text_data, metadata={"source": uploaded_file.name}))
                        
                        # Text Logic
                        else:
                            documents.extend(TextLoader(file_path, encoding="utf-8").load())
            
            # 2. Handle Pasted Text
            if user_text_input:
                documents.append(Document(page_content=user_text_input, metadata={"source": "User Paste"}))

            # 3. Save to Vector DB
            if documents:
                text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
                chunks = text_splitter.split_documents(documents)
                
                dense_embeddings = FastEmbedEmbeddings() 
                sparse_embeddings = FastEmbedSparse(model_name="Qdrant/bm25") 
                
                QdrantVectorStore.from_documents(
                    chunks, 
                    embedding=dense_embeddings, 
                    sparse_embedding=sparse_embeddings, 
                    url=url, 
                    api_key=api_key, 
                    collection_name=collection_name, 
                    retrieval_mode=RetrievalMode.HYBRID, 
                    prefer_grpc=True
                )
                st.success(f"Saved {len(chunks)} chunks! Now you can ask about the file.")
            else:
                st.warning("No data found to save!")

# --- 4. SETUP TOOLS & AGENT ---
dense_embeddings = FastEmbedEmbeddings()
sparse_embeddings = FastEmbedSparse(model_name="Qdrant/bm25")

try:
    vector_store = QdrantVectorStore(
        client=client, 
        collection_name=collection_name, 
        embedding=dense_embeddings,
        sparse_embedding=sparse_embeddings,
        retrieval_mode=RetrievalMode.HYBRID 
    )
    
    # --- FIX: BYPASS RERANKER TO PREVENT ERRORS ---
    base_retriever = vector_store.as_retriever(search_kwargs={"k": 50})
    
    # compressor = FlashrankRerank(model="ms-marco-MiniLM-L-12-v2")
    # compression_retriever = ContextualCompressionRetriever(
    #    base_compressor=compressor, 
    #    base_retriever=base_retriever
    # )

    retriever_tool = create_retriever_tool(
        base_retriever,  # <--- CHANGED THIS from compression_retriever to base_retriever
        "knowledge_base_search",
        "Use this tool to find information in uploaded documents and Excel files."
    )

    tools = [retriever_tool]
    
    if use_web_search:
        tools.append(DuckDuckGoSearchRun())
    
    if use_system_control:
        tools.append(system_control)

    prompt = ChatPromptTemplate.from_messages([
        ("system", """
        You are a smart assistant with system control capabilities.
        1. FIRST check 'chat_history' for context.
        2. THEN use 'knowledge_base_search' to find answers in the uploaded files.
        3. If the user asks about a specific row or data point in an Excel file, search for the keywords in that row.
        4. If the user asks to open an application (e.g. "open chrome", "open notepad", "open youtube.com") or run a system command (e.g. "show my IP", "list files"), use the 'system_control' tool.
           Pass the user's request directly to system_control. For example: "open chrome", "open youtube.com", "ipconfig".
        """),
        MessagesPlaceholder(variable_name="chat_history"), 
        ("human", "{input}"),
        ("placeholder", "{agent_scratchpad}"),
    ])

    agent = create_tool_calling_agent(llm, tools, prompt)
    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

except Exception as e:
    st.error(f"⚠️ Database Error: {e}")
    st.stop()

# --- 5. CHAT INTERFACE ---
if "messages" not in st.session_state:
    st.session_state.messages = []

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

if prompt_input := st.chat_input("Ask about your Excel file..."):
    with st.chat_message("user"):
        st.markdown(prompt_input)

    chat_history = []
    for msg in st.session_state.messages:
        if msg["role"] == "user":
            chat_history.append(HumanMessage(content=msg["content"]))
        else:
            chat_history.append(AIMessage(content=msg["content"]))

    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            response = agent_executor.invoke({
                "input": prompt_input,
                "chat_history": chat_history 
            })
            answer = response["output"]
        st.write_stream(stream_text(answer))
    
    st.session_state.messages.append({"role": "user", "content": prompt_input})
    st.session_state.messages.append({"role": "assistant", "content": answer})