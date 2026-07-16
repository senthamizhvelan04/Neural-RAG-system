/* NeuralRAG v2.0 — Dynamic Frontend JS */

// --- DOM Elements ---
const sidebar = document.getElementById('sidebar');
const chatArea = document.getElementById('chatArea');
const messagesContainer = document.getElementById('messages');
const welcome = document.getElementById('welcome');
const chatInput = document.getElementById('chatInput');
const btnSend = document.getElementById('btnSend');
const btnToggleSidebar = document.getElementById('btnToggleSidebar');
const btnClear = document.getElementById('btnClear');
const btnSaveBrain = document.getElementById('btnSaveBrain');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const uploadList = document.getElementById('uploadList');
const savedFilesList = document.getElementById('savedFilesList');
const topbarModel = document.getElementById('topbarModel');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const toastContainer = document.getElementById('toastContainer');

let pendingFiles = [];
let isProcessing = false;

// --- Marked.js Config ---
const renderer = new marked.Renderer();
renderer.image = function(href, title, text) {
    // Handle both old and new marked.js API
    const src = (typeof href === 'object') ? href.href : href;
    const alt = (typeof href === 'object') ? href.text : (text || '');
    return `<img src="${src}" alt="${alt}" style="max-width: 100%; border-radius: 8px; border: 1px solid #272a38; box-shadow: 0 4px 12px rgba(0,0,0,0.3); margin-top: 16px;">`;
};
marked.setOptions({
    breaks: true,
    gfm: true,
    renderer: renderer,
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    }
});

// ============================================================
// UI INITIALIZATION
// ============================================================
// Canvas removed for minimalist UI.

// ============================================================
// SIDEBAR TOGGLE
// ============================================================
btnToggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

// ============================================================
// MODEL SELECTOR
// ============================================================
const modelButtons = document.querySelectorAll('.model-btn');
const modelNames = {
    groq: 'Groq (Llama 3.3)',
    openrouter: 'OpenRouter',
    gemini: 'Gemini 2.5',
    local: 'LM Studio (Offline)'
};

modelButtons.forEach(btn => {
    btn.addEventListener('click', () => selectModel(btn.dataset.model));
});

function selectModel(model) {
    modelButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.model === model));
    topbarModel.textContent = modelNames[model] || model;
    updateSettings({ model });
}

// ============================================================
// TOGGLES
// ============================================================
document.getElementById('toggleWebSearch').addEventListener('change', (e) => updateSettings({ web_search: e.target.checked }));
document.getElementById('toggleSystemControl').addEventListener('change', (e) => updateSettings({ system_control: e.target.checked }));
document.getElementById('toggleMySQL').addEventListener('change', (e) => updateSettings({ mysql_enabled: e.target.checked }));

async function updateSettings(data) {
    try {
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch(e) {
        showToast('System configuration override failed.', 'error');
    }
}

// ============================================================
// CHAT INPUT, SEND & SPEECH RECOGNITION
// ============================================================
const btnMic = document.getElementById('btnMic');

// Speech Recognition Setup
let recognition = null;
let isRecording = false;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let originalText = '';

    recognition.onstart = () => {
        isRecording = true;
        btnMic.classList.add('active');
        chatInput.placeholder = "Listening...";
        originalText = chatInput.value;
        if (originalText && !originalText.endsWith(' ')) {
            originalText += ' ';
        }
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let newFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                newFinal += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        
        if (newFinal) {
            originalText += newFinal + ' ';
        }
        
        chatInput.value = originalText + interimTranscript;
        chatInput.dispatchEvent(new Event('input')); // Trigger height resize and btnSend state
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'no-speech') {
            // It's common to get 'no-speech' if the user is silent. Just stop recording nicely.
            showToast('Microphone paused (no speech detected)', 'info');
        } else if (event.error === 'audio-capture') {
            showToast('No microphone found. Please check Windows sound settings.', 'error');
        } else if (event.error === 'not-allowed') {
            showToast('Microphone access denied. Please allow it in browser settings.', 'error');
        } else {
            showToast('Microphone error: ' + event.error, 'error');
        }
        stopRecording();
    };

    recognition.onend = () => {
        stopRecording();
    };
} else {
    if (btnMic) btnMic.style.display = 'none'; // Hide if not supported
}

function stopRecording() {
    isRecording = false;
    if (btnMic) btnMic.classList.remove('active');
    chatInput.placeholder = "Message NeuralRAG...";
    if (recognition) recognition.stop();
}

if (btnMic) {
    btnMic.addEventListener('click', () => {
        if (!recognition) {
            showToast('Speech recognition not supported in this browser.', 'error');
            return;
        }
        if (isRecording) {
            stopRecording();
        } else {
            try {
                recognition.start();
            } catch(e) {
                console.error(e);
            }
        }
    });
}

chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
    btnSend.disabled = !chatInput.value.trim();
});

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (chatInput.value.trim() && !isProcessing) sendMessage();
    }
});

btnSend.addEventListener('click', () => {
    if (chatInput.value.trim() && !isProcessing) sendMessage();
});

document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
        chatInput.value = chip.dataset.prompt;
        chatInput.dispatchEvent(new Event('input'));
        sendMessage();
    });
});

async function sendMessage() {
    const msg = chatInput.value.trim();
    if (!msg) return;
    
    isProcessing = true;
    statusDot.classList.add('busy');
    if (statusText) statusText.textContent = 'PROCESSING...';
    welcome.classList.add('hidden');
    
    addMessage('user', msg);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    btnSend.disabled = true;
    
    const typingEl = addTypingIndicator();
    
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        
        typingEl.remove();
        
        if (data.error) {
            addMessage('assistant', `⚠️ **SYSTEM ERROR:** ${data.error}`);
            showToast('Protocol error detected.', 'error');
        } else {
            addMessage('assistant', data.response);
        }
    } catch(e) {
        typingEl.remove();
        addMessage('assistant', '⚠️ **CONNECTION LOST.** Unable to reach core systems.');
        showToast('Connection failed', 'error');
    } finally {
        isProcessing = false;
        statusDot.classList.remove('busy');
        if (statusText) statusText.textContent = 'ONLINE';
    }
}

// ============================================================
// UI RENDERERS
// ============================================================
const userAvatarSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const aiAvatarSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;

function addMessage(role, content) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    
    const avatar = role === 'user' ? userAvatarSVG : aiAvatarSVG;
    const roleName = role === 'user' ? 'OPERATOR' : 'NEURAL_CORE';
    
    // Extract image/chart tokens before markdown parsing
    const mediaItems = [];
    let textContent = content;
    
    if (role === 'assistant') {
        // Extract :::IMAGE:::url:::END::: tokens
        textContent = textContent.replace(/:::IMAGE:::(.*?):::END:::/g, (_, url) => {
            mediaItems.push({ type: 'image', url: url.trim() });
            return '';
        });
        // Extract :::CHART:::url:::END::: tokens
        textContent = textContent.replace(/:::CHART:::(.*?):::END:::/g, (_, url) => {
            mediaItems.push({ type: 'chart', url: url.trim() });
            return '';
        });
    }
    
    const html = role === 'assistant' ? marked.parse(textContent.trim()) : escapeHtml(content);
    
    div.innerHTML = `
        <div class="message-inner">
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-role">${roleName}</div>
                <div class="message-body">${html}</div>
            </div>
        </div>
    `;
    
    // Programmatically create img elements (bypasses all HTML escaping)
    if (mediaItems.length > 0) {
        const bodyEl = div.querySelector('.message-body');
        mediaItems.forEach(item => {
            const wrapper = document.createElement('div');
            wrapper.className = 'media-wrapper';
            wrapper.style.cssText = 'position: relative; min-height: 200px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); border-radius: 8px; margin-top: 16px; border: 1px solid var(--border-subtle); overflow: hidden;';
            
            const loader = document.createElement('div');
            loader.className = 'media-loader';
            loader.innerHTML = `
                <div class="typing-indicator" style="margin-bottom: 8px;">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); font-family: var(--font-mono);">SYNTHESIZING...</div>
            `;
            wrapper.appendChild(loader);

            const img = document.createElement('img');
            img.alt = item.type === 'chart' ? 'Data Visualization' : 'Generated Image';
            img.style.cssText = 'max-width: 100%; display: none; border-radius: 8px;';
            if (item.type === 'chart') img.style.background = 'white';
            
            img.onload = () => {
                loader.style.display = 'none';
                img.style.display = 'block';
                wrapper.style.minHeight = 'auto';
                wrapper.style.background = 'transparent';
                wrapper.style.border = 'none';
            };
            
            img.onerror = () => {
                loader.innerHTML = `
                    <div style="color: #ef4444; margin-bottom: 8px;">⚠️ LOAD FAILED</div>
                    <button class="btn-retry" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--text-base); padding: 4px 12px; border-radius: 4px; font-size: 11px; cursor: pointer;">RETRY</button>
                `;
                loader.querySelector('.btn-retry').onclick = () => {
                    loader.innerHTML = 'RETRYING...';
                    img.src = item.url + (item.url.includes('?') ? '&' : '?') + 't=' + Date.now();
                };
            };

            img.referrerPolicy = 'no-referrer';
            img.src = item.url;
            wrapper.appendChild(img);
            bodyEl.appendChild(wrapper);
        });
    }
    
    messagesContainer.appendChild(div);
    scrollToBottom();
    
    if (role === 'assistant') {
        div.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
    }
}

function addTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.innerHTML = `
        <div class="message-inner">
            <div class="message-avatar">${aiAvatarSVG}</div>
            <div class="message-content">
                <div class="message-role">NEURAL_CORE</div>
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(div);
    scrollToBottom();
    return div;
}

function scrollToBottom() {
    chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// ============================================================
// FILE UPLOAD
// ============================================================
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files);
    fileInput.value = '';
});

function handleFiles(files) {
    for (const f of files) {
        pendingFiles.push(f);
        addFileToList(f);
    }
    btnSaveBrain.disabled = pendingFiles.length === 0;
}

function addFileToList(file) {
    const icons = { pdf: '📄', txt: '📝', xlsx: '📊', xls: '📊', jpg: '🖼️', jpeg: '🖼️', png: '🖼️' };
    const ext = file.name.split('.').pop().toLowerCase();
    
    const div = document.createElement('div');
    div.className = 'upload-item';
    div.innerHTML = `
        <span class="upload-item-icon">${icons[ext] || '📎'}</span>
        <span class="upload-item-name">${file.name}</span>
        <button class="upload-item-remove" title="Remove">✕</button>
    `;
    
    div.querySelector('.upload-item-remove').addEventListener('click', () => {
        pendingFiles = pendingFiles.filter(f => f !== file);
        div.remove();
        btnSaveBrain.disabled = pendingFiles.length === 0;
    });
    
    uploadList.appendChild(div);
}

async function fetchSavedFiles() {
    if (!savedFilesList) return;
    try {
        const res = await fetch('/api/files');
        const data = await res.json();
        savedFilesList.innerHTML = '';
        
        const icons = { pdf: '📄', txt: '📝', xlsx: '📊', xls: '📊', jpg: '🖼️', jpeg: '🖼️', png: '🖼️' };
        data.files.forEach(name => {
            const ext = name.split('.').pop().toLowerCase();
            const div = document.createElement('div');
            div.className = 'upload-item saved';
            div.innerHTML = `
                <span class="upload-item-icon">${icons[ext] || '📎'}</span>
                <span class="upload-item-name">${name}</span>
                <button class="upload-item-remove" title="Remove from Brain">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            `;
            
            div.querySelector('.upload-item-remove').addEventListener('click', async () => {
                if (!confirm(`Are you sure you want to remove "${name}" from the AI's knowledge base?`)) return;
                try {
                    const delRes = await fetch(`/api/files/${encodeURIComponent(name)}`, { method: 'DELETE' });
                    
                    // If the server returns a 404 or 405, it might be HTML, not JSON.
                    if (!delRes.ok) {
                        const errText = await delRes.text();
                        console.error("Server Error:", errText);
                        // This usually happens if the server wasn't restarted and the DELETE route is missing
                        if (delRes.status === 404 || delRes.status === 405) {
                            showToast('Server route missing. Did you restart the server?', 'error');
                        } else {
                            showToast(`Server error: ${delRes.status}`, 'error');
                        }
                        return;
                    }
                    
                    const delData = await delRes.json();
                    if (delData.error) {
                        showToast(delData.error, 'error');
                    } else {
                        showToast(delData.message, 'success');
                        fetchSavedFiles(); // Refresh list
                    }
                } catch(e) {
                    console.error("Fetch failed:", e);
                    showToast('Failed to delete file. Check console.', 'error');
                }
            });

            savedFilesList.appendChild(div);
        });
    } catch(e) {
        console.error("Could not fetch saved vectors:", e);
    }
}
fetchSavedFiles();

btnSaveBrain.addEventListener('click', async () => {
    if (pendingFiles.length === 0) return;
    
    btnSaveBrain.disabled = true;
    btnSaveBrain.innerHTML = `
        <svg class="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
        SYNCING...
    `;
    
    const fd = new FormData();
    pendingFiles.forEach(f => fd.append('files', f));
    
    try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        
        if (data.error) {
            showToast(data.error, 'error');
        } else {
            showToast(data.message, 'success');
            pendingFiles = [];
            uploadList.innerHTML = '';
            fetchSavedFiles();
        }
    } catch(e) {
        showToast('Sync failed', 'error');
    } finally {
        btnSaveBrain.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Sync to Brain
        `;
        btnSaveBrain.disabled = pendingFiles.length === 0;
    }
});

// ============================================================
// CLEAR CHAT
// ============================================================
btnClear.addEventListener('click', async () => {
    try {
        await fetch('/api/clear', { method: 'POST' });
        messagesContainer.innerHTML = '';
        welcome.classList.remove('hidden');
        showToast('Memory purged.', 'info');
    } catch(e) {
        showToast('Failed to purge', 'error');
    }
});

// ============================================================
// TOAST
// ============================================================
function showToast(message, type = 'info') {
    const icons = {
        success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
        error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };
    
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `${icons[type] || ''} <span>${message}</span>`;
    
    toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// ============================================================
// API KEY MANAGER
// ============================================================
const keyProvider = document.getElementById('keyProvider');
const keyInput = document.getElementById('keyInput');
const btnAddKey = document.getElementById('btnAddKey');
const keyList = document.getElementById('keyList');

async function fetchKeys() {
    if (!keyList) return;
    try {
        const res = await fetch('/api/keys');
        const data = await res.json();
        keyList.innerHTML = '';
        
        const labels = { gemini: 'Gemini', groq: 'Groq', openrouter: 'OpenRouter' };
        
        for (const [provider, info] of Object.entries(data)) {
            // Only show providers that have keys or are part of the main options
            if (info.total === 0) continue;
            
            const sec = document.createElement('div');
            sec.className = 'key-provider-section';
            
            let kh = '';
            info.keys_masked.forEach((k, i) => {
                const active = (i + 1) === info.active_index;
                kh += `
                    <div class="key-item ${active ? 'active' : ''}">
                        <span class="key-dot ${active ? 'active' : ''}"></span>
                        <span class="key-masked">${k}</span>
                    </div>
                `;
            });
            
            sec.innerHTML = `
                <div class="key-provider-header" title="Keys are automatically rotated when rate limits or exhaustion occurs.">
                    <span style="display: flex; align-items: center; gap: 6px;">
                        ${labels[provider] || provider}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.5"><path d="M21.5 2v6h-6M2.13 15.57a10 10 0 1 0 4.43-11l-5.69 5.69M2.5 22v-6h6"/></svg>
                    </span>
                    <span class="key-count">${info.total} TKN</span>
                </div>
                ${kh}
            `;
            keyList.appendChild(sec);
        }
    } catch(e) {
        console.error("Could not fetch keys:", e);
    }
}

if (btnAddKey) {
    btnAddKey.addEventListener('click', async () => {
        const provider = keyProvider.value;
        const key = keyInput.value.trim();
        
        if (!key) {
            showToast('Invalid token string.', 'error');
            return;
        }
        
        btnAddKey.disabled = true;
        
        try {
            const res = await fetch('/api/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, key })
            });
            const data = await res.json();
            
            if (data.error) showToast(data.error, 'error');
            else {
                showToast('Token accepted.', 'success');
                keyInput.value = '';
                fetchKeys();
            }
        } catch(e) {
            showToast('System failure.', 'error');
        } finally {
            btnAddKey.disabled = false;
        }
    });
}
fetchKeys();
