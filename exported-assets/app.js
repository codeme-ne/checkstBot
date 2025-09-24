// Application State
let appState = {
    documents: [],
    activeDocument: null,
    chatHistory: {},
    selectedText: '',
    selectedRange: null,
    currentLLM: 'gpt4',
    highlightMode: false
};

// Sample data from the provided JSON
const sampleDocument = {
    title: "Machine Learning Grundlagen",
    content: `# Machine Learning Grundlagen

## 1. Einführung

Machine Learning ist ein Teilbereich der Künstlichen Intelligenz (KI), der es Computern ermöglicht, aus Daten zu lernen und Vorhersagen zu treffen, ohne explizit programmiert zu werden.

## 2. Haupttypen des Machine Learning

### 2.1 Supervised Learning (Überwachtes Lernen)
Beim überwachten Lernen wird das Modell mit Eingabe-Ausgabe-Paaren trainiert. Beispiele:
- **Klassifikation**: Spam-Erkennung in E-Mails
- **Regression**: Vorhersage von Hauspreisen

### 2.2 Unsupervised Learning (Unüberwachtes Lernen)
Hier lernt das Modell Muster in Daten ohne vorgegebene Antworten:
- **Clustering**: Kundensegmentierung
- **Dimensionalitätsreduktion**: Datenvisualisierung

### 2.3 Reinforcement Learning (Verstärkendes Lernen)
Das Modell lernt durch Belohnungen und Strafen:
- **Anwendungen**: Spielstrategien, autonome Fahrzeuge

## 3. Wichtige Algorithmen

### 3.1 Lineare Regression
Einfachster Algorithmus für Vorhersagen kontinuierlicher Werte.
**Formel**: y = mx + b

### 3.2 Decision Trees (Entscheidungsbäume)
Baumartige Struktur für Klassifikations- und Regressionsprobleme.
**Vorteile**: Leicht interpretierbar
**Nachteile**: Neigung zum Overfitting

### 3.3 Neural Networks (Neuronale Netze)
Inspiriert von der Funktionsweise des menschlichen Gehirns.
**Deep Learning**: Viele versteckte Schichten
**Anwendungen**: Bilderkennung, Sprachverarbeitung

## 4. Wichtige Konzepte

### 4.1 Overfitting und Underfitting
- **Overfitting**: Modell lernt Trainingsdaten zu spezifisch
- **Underfitting**: Modell ist zu simpel für die Daten
- **Lösung**: Cross-Validation, Regularisierung

### 4.2 Bias-Variance Tradeoff
Balance zwischen:
- **Bias**: Systematischer Fehler
- **Variance**: Sensitivität gegenüber Trainingsdaten

## 5. Evaluationsmetriken

### Für Klassifikation:
- **Accuracy**: Anteil korrekter Vorhersagen
- **Precision**: Anteil korrekt positiver Vorhersagen
- **Recall**: Anteil erkannter positiver Fälle
- **F1-Score**: Harmonisches Mittel aus Precision und Recall

### Für Regression:
- **Mean Squared Error (MSE)**: Durchschnittlicher quadratischer Fehler
- **R²**: Bestimmtheitsmaß

## 6. Praktische Schritte

1. **Problemdefinition**: Welche Art von ML-Problem?
2. **Datensammlung**: Relevante, qualitativ hochwertige Daten
3. **Datenbereinigung**: Umgang mit fehlenden Werten, Ausreißern
4. **Feature Engineering**: Auswahl und Transformation von Variablen
5. **Modellauswahl**: Algorithmus basierend auf Problemtyp
6. **Training**: Modell mit Trainingsdaten trainieren
7. **Evaluation**: Leistung auf Testdaten bewerten
8. **Deployment**: Modell in Produktionsumgebung einsetzen

## Fazit

Machine Learning ist ein mächtiges Werkzeug, aber erfordert sorgfältige Planung und Verständnis der zugrundeliegenden Konzepte. Der Schlüssel zum Erfolg liegt in der richtigen Problemformulierung und der Auswahl geeigneter Algorithmen.`,
    type: "markdown"
};

const llmModels = {
    gpt4: { name: "GPT-4", description: "Vielseitig, gut für komplexe Erklärungen" },
    claude: { name: "Claude 3.5", description: "Exzellent für detaillierte Analysen" },
    gemini: { name: "Gemini Pro", description: "Gut für technische Themen" },
    llama: { name: "Llama 2", description: "Open Source, schnelle Antworten" }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    // Load sample document
    const sampleDoc = {
        id: 'sample-ml',
        ...sampleDocument,
        uploadDate: new Date().toISOString()
    };
    
    appState.documents.push(sampleDoc);
    appState.activeDocument = sampleDoc.id;
    appState.chatHistory[sampleDoc.id] = [];
    
    // Initialize the UI and chat immediately
    updateUI();
    initializeChat(sampleDoc.id);
}

function setupEventListeners() {
    // File input handling
    const fileInput = document.getElementById('file-input');
    const uploadZone = document.getElementById('upload-zone');
    
    fileInput?.addEventListener('change', handleFileSelect);
    uploadZone?.addEventListener('click', () => fileInput?.click());
    uploadZone?.addEventListener('dragover', handleDragOver);
    uploadZone?.addEventListener('drop', handleFileDrop);
    uploadZone?.addEventListener('dragenter', e => e.preventDefault());
    uploadZone?.addEventListener('dragleave', handleDragLeave);
    
    // LLM selection
    const llmSelect = document.getElementById('llm-select');
    llmSelect?.addEventListener('change', (e) => {
        appState.currentLLM = e.target.value;
    });
    
    // Chat input
    const chatInput = document.getElementById('chat-input');
    chatInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Document search
    const docSearch = document.getElementById('document-search');
    docSearch?.addEventListener('input', (e) => {
        searchInDocument(e.target.value);
    });
    
    // Text selection handling
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('keyup', handleTextSelection);
}

// File handling
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    files.forEach(processFile);
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
        event.currentTarget.classList.remove('dragover');
    }
}

function handleFileDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = Array.from(event.dataTransfer.files);
    files.forEach(processFile);
}

function processFile(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const content = e.target.result;
        const document = {
            id: generateId(),
            title: file.name.replace(/\.[^/.]+$/, ""),
            content: content,
            type: getFileType(file.name),
            uploadDate: new Date().toISOString()
        };
        
        appState.documents.push(document);
        appState.chatHistory[document.id] = [];
        
        // Auto-select the new document
        appState.activeDocument = document.id;
        
        updateUI();
        showProcessingIndicator(document.id);
        
        // Simulate processing delay
        setTimeout(() => {
            hideProcessingIndicator();
            initializeChat(document.id);
        }, 2000);
    };
    
    reader.readAsText(file);
}

function getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const types = {
        'pdf': 'PDF',
        'docx': 'DOCX', 
        'txt': 'TXT',
        'md': 'Markdown'
    };
    return types[ext] || 'Unknown';
}

function generateId() {
    return 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// UI Updates
function updateUI() {
    updateDocumentTabs();
    updateDocumentViewer();
    updateChatPanel();
}

function updateDocumentTabs() {
    const tabsContainer = document.getElementById('document-tabs');
    const uploadZone = document.getElementById('upload-zone');
    
    if (appState.documents.length === 0) {
        tabsContainer.style.display = 'none';
        uploadZone.style.display = 'flex';
        return;
    }
    
    tabsContainer.style.display = 'flex';
    uploadZone.style.display = 'none';
    
    tabsContainer.innerHTML = appState.documents.map(doc => `
        <button class="document-tab ${doc.id === appState.activeDocument ? 'active' : ''}"
                onclick="switchToDocument('${doc.id}')">
            <span>${doc.title}</span>
            <button class="tab-close" onclick="closeDocument('${doc.id}')" title="Dokument schließen">×</button>
        </button>
    `).join('');
}

function updateDocumentViewer() {
    const viewer = document.getElementById('document-viewer');
    const activeDoc = appState.documents.find(d => d.id === appState.activeDocument);
    
    if (!activeDoc) {
        viewer.style.display = 'none';
        return;
    }
    
    viewer.style.display = 'flex';
    
    const titleEl = document.getElementById('document-title');
    const contentEl = document.getElementById('document-content');
    
    if (titleEl) titleEl.textContent = activeDoc.title;
    if (contentEl) contentEl.innerHTML = renderMarkdown(activeDoc.content);
}

function updateChatPanel() {
    const chatStatus = document.getElementById('chat-status');
    const quickActions = document.getElementById('quick-actions');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input-container');
    
    if (!appState.activeDocument) {
        chatStatus.style.display = 'flex';
        quickActions.style.display = 'none';
        chatMessages.style.display = 'none';
        chatInput.style.display = 'none';
        return;
    }
    
    chatStatus.style.display = 'none';
    quickActions.style.display = 'block';
    chatMessages.style.display = 'flex';
    chatInput.style.display = 'block';
    
    renderChatMessages();
}

// Document management
function switchToDocument(docId) {
    appState.activeDocument = docId;
    updateUI();
    // Don't re-initialize chat if it already exists
    if (!appState.chatHistory[docId] || appState.chatHistory[docId].length === 0) {
        initializeChat(docId);
    } else {
        renderChatMessages();
    }
}

function closeDocument(docId) {
    event.stopPropagation();
    
    appState.documents = appState.documents.filter(d => d.id !== docId);
    delete appState.chatHistory[docId];
    
    if (appState.activeDocument === docId) {
        appState.activeDocument = appState.documents.length > 0 ? appState.documents[0].id : null;
    }
    
    updateUI();
    
    if (appState.activeDocument) {
        initializeChat(appState.activeDocument);
    }
}

function initializeChat(docId) {
    const messages = appState.chatHistory[docId] || [];
    
    if (messages.length === 0) {
        // Add welcome message
        const welcomeMessage = {
            role: 'assistant',
            content: `Hallo! Ich bin Ihr intelligenter Lernassistent und helfe Ihnen dabei, dieses Dokument zu verstehen. Sie können mir Fragen stellen oder eine der Schnellaktionen verwenden.

**Möglichkeiten:**
• Stellen Sie spezifische Fragen zum Inhalt
• Markieren Sie Text für detaillierte Erklärungen  
• Nutzen Sie die Schnellaktionen für Zusammenfassungen
• Ich erkläre komplexe Konzepte in einfachen Worten

Womit kann ich Ihnen helfen?`,
            timestamp: new Date().toISOString(),
            model: appState.currentLLM
        };
        
        appState.chatHistory[docId] = [welcomeMessage];
    }
    
    renderChatMessages();
}

// Markdown rendering
function renderMarkdown(content) {
    // Simple markdown parser
    let html = content
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold and italic
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Lists
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        // Paragraphs
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    
    // Wrap in paragraphs
    html = '<p>' + html + '</p>';
    
    // Fix list items
    html = html.replace(/(<li>.*?<\/li>)/gs, (match) => {
        return '<ul>' + match + '</ul>';
    });
    
    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p><br><\/p>/g, '');
    
    return html;
}

// Chat functionality
function renderChatMessages() {
    const container = document.getElementById('chat-messages');
    if (!container || !appState.activeDocument) return;
    
    const messages = appState.chatHistory[appState.activeDocument] || [];
    
    container.innerHTML = messages.map(msg => `
        <div class="chat-message ${msg.role}">
            <div class="message-content">${msg.content}</div>
            <div class="message-meta">
                ${msg.role === 'assistant' ? llmModels[msg.model]?.name || 'AI' : 'Sie'} • 
                ${formatTime(msg.timestamp)}
            </div>
        </div>
    `).join('');
    
    container.scrollTop = container.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message || !appState.activeDocument) return;
    
    // Add user message
    const userMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
    };
    
    appState.chatHistory[appState.activeDocument].push(userMessage);
    input.value = '';
    
    renderChatMessages();
    showTypingIndicator();
    
    // Generate AI response
    setTimeout(() => {
        const response = generateAIResponse(message, appState.activeDocument);
        const aiMessage = {
            role: 'assistant',
            content: response,
            timestamp: new Date().toISOString(),
            model: appState.currentLLM
        };
        
        appState.chatHistory[appState.activeDocument].push(aiMessage);
        hideTypingIndicator();
        renderChatMessages();
    }, 1500 + Math.random() * 1000);
}

function generateAIResponse(question, docId) {
    const doc = appState.documents.find(d => d.id === docId);
    if (!doc) return "Entschuldigung, ich kann das Dokument nicht finden.";
    
    const content = doc.content.toLowerCase();
    const questionLower = question.toLowerCase();
    
    // Simulate RAG by finding relevant sections
    const relevantSections = findRelevantSections(content, questionLower);
    
    // Generate contextual response based on question type
    if (questionLower.includes('zusammenfassung') || questionLower.includes('summary')) {
        return generateSummary(doc);
    } else if (questionLower.includes('hauptpunkt') || questionLower.includes('wichtig')) {
        return generateMainPoints(doc);
    } else if (questionLower.includes('beispiel')) {
        return generateExamples(doc);
    } else if (questionLower.includes('erkläre') || questionLower.includes('erklär')) {
        return generateExplanation(question, doc, relevantSections);
    } else if (questionLower.includes('unterschied') || questionLower.includes('difference')) {
        return generateComparison(question, doc);
    } else {
        return generateGeneralResponse(question, doc, relevantSections);
    }
}

function findRelevantSections(content, question) {
    const sections = content.split(/##\s+/);
    const relevant = [];
    
    sections.forEach(section => {
        const words = question.split(' ');
        let score = 0;
        
        words.forEach(word => {
            if (word.length > 3 && section.includes(word)) {
                score++;
            }
        });
        
        if (score > 0) {
            relevant.push({ section: section.substring(0, 200) + '...', score });
        }
    });
    
    return relevant.sort((a, b) => b.score - a.score).slice(0, 2);
}

function generateSummary(doc) {
    return `**📋 Zusammenfassung von "${doc.title}":**

• **Kern**: Machine Learning ermöglicht Computern das Lernen aus Daten ohne explizite Programmierung

• **Haupttypen**: 
  - Supervised Learning (mit Beispiel-Antworten)
  - Unsupervised Learning (Muster finden)
  - Reinforcement Learning (durch Belohnung lernen)

• **Wichtige Algorithmen**: Lineare Regression, Decision Trees, Neural Networks

• **Herausforderungen**: Overfitting vs. Underfitting, Bias-Variance Tradeoff

• **Praktischer Prozess**: Von Problemdefinition bis Deployment in 8 Schritten

*Relevante Textstelle: Einführung und Fazit*`;
}

function generateMainPoints(doc) {
    return `**🎯 Hauptpunkte aus "${doc.title}":**

**1. Grundlagen**
• ML ist Teil der KI und ermöglicht automatisches Lernen
• Drei Hauptkategorien mit unterschiedlichen Ansätzen

**2. Praktische Algorithmen**
• Lineare Regression für kontinuierliche Vorhersagen
• Decision Trees für interpretierbare Entscheidungen
• Neural Networks für komplexe Muster

**3. Kritische Konzepte**
• Balance zwischen Über- und Unteranpassung finden
• Bias-Variance Tradeoff verstehen und handhaben

**4. Erfolgreiche Umsetzung**
• Systematischer 8-Schritte-Prozess
• Von Datensammlung bis zur produktiven Nutzung

*Relevante Textstelle: Abschnitte 2-6*`;
}

function generateExamples(doc) {
    return `**💡 Praktische Beispiele aus dem Dokument:**

**Supervised Learning:**
• Spam-Erkennung in E-Mails (Klassifikation)
• Vorhersage von Hauspreisen (Regression)

**Unsupervised Learning:**
• Kundensegmentierung durch Clustering
• Datenvisualisierung via Dimensionalitätsreduktion

**Reinforcement Learning:**
• Entwicklung von Spielstrategien
• Training autonomer Fahrzeuge

**Neural Networks Anwendungen:**
• Bilderkennung und Computer Vision
• Natürliche Sprachverarbeitung

Diese Beispiele zeigen die Vielseitigkeit von ML in verschiedenen Bereichen.

*Relevante Textstelle: Abschnitte 2.1-3.3*`;
}

function generateExplanation(question, doc, relevantSections) {
    const explanations = {
        'overfitting': `**🎯 Overfitting einfach erklärt:**

**Problem**: Das Modell "merkt sich" die Trainingsdaten zu genau
• Wie ein Student, der nur Musterlösungen auswendig lernt
• Hohe Genauigkeit bei bekannten, schlechte bei neuen Daten

**Lösung**: 
• Mehr und vielfältigere Trainingsdaten
• Regularisierung (künstliche "Bremse")
• Cross-Validation zur Kontrolle

**Merkregel**: Overfitting = zu spezifisch, zu wenig allgemein

*Relevante Textstelle: Abschnitt 4.1*`,
        
        'neural': `**🧠 Neural Networks verständlich:**

**Grundidee**: Nachbau der Funktionsweise des Gehirns
• Künstliche "Neuronen" verarbeiten Informationen
• Viele Schichten = Deep Learning

**Stärken**:
• Erkennen komplexer Muster
• Flexibel für verschiedene Probleme

**Anwendungen**:
• Bilderkennung (Was ist auf dem Foto?)
• Sprachverarbeitung (Übersetzen, Verstehen)

*Relevante Textstelle: Abschnitt 3.3*`
    };
    
    // Find best matching explanation
    for (const [key, explanation] of Object.entries(explanations)) {
        if (question.toLowerCase().includes(key)) {
            return explanation;
        }
    }
    
    return `**📚 Erklärung zu Ihrer Frage:**

Basierend auf dem Dokument kann ich folgende Punkte hervorheben:

${relevantSections.map(section => `• ${section.section}`).join('\n')}

Möchten Sie, dass ich einen bestimmten Aspekt genauer erkläre?

*Relevante Textstellen gefunden und analysiert*`;
}

function generateComparison(question, doc) {
    if (question.toLowerCase().includes('overfitting') && question.toLowerCase().includes('underfitting')) {
        return `**⚖️ Overfitting vs. Underfitting - Der Unterschied:**

**Overfitting** (Überanpassung):
• Modell lernt Trainingsdaten zu spezifisch
• Hohe Trainings-, niedrige Testgenauigkeit
• Wie auswendig lernen ohne Verständnis

**Underfitting** (Unteranpassung):
• Modell ist zu simpel für die Daten
• Niedrige Genauigkeit bei Training UND Test
• Wie zu einfache Regeln für komplexe Probleme

**Die Balance finden:**
• Cross-Validation zur Überwachung
• Regularisierung gegen Overfitting
• Komplexere Modelle gegen Underfitting

*Relevante Textstelle: Abschnitt 4.1*`;
    }
    
    return generateGeneralResponse(question, doc, []);
}

function generateGeneralResponse(question, doc, relevantSections) {
    const responses = [
        `**📖 Antwort basierend auf "${doc.title}":**

Das Dokument behandelt Ihre Frage im Kontext von Machine Learning Grundlagen. 

${relevantSections.length > 0 ? 
    `**Relevante Inhalte:**\n${relevantSections.map(s => `• ${s.section}`).join('\n')}\n` : 
    ''
}

Für eine detailliertere Antwort können Sie:
• Einen spezifischen Textabschnitt markieren
• Eine der Schnellaktionen verwenden
• Eine präzisere Frage stellen

*Kontext aus Dokumentenanalyse*`,

        `**🤖 ${llmModels[appState.currentLLM].name} Analyse:**

Ihre Frage bezieht sich auf wichtige ML-Konzepte. Das Dokument bietet eine solide Grundlage zum Verständnis.

**Empfehlung**: 
• Nutzen Sie die Suchfunktion für spezifische Begriffe
• Markieren Sie relevante Textpassagen für detaillierte Erklärungen
• Stellen Sie Follow-up-Fragen für tieferes Verständnis

Welchen Aspekt möchten Sie vertiefen?

*Intelligente Dokumentenanalyse aktiv*`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}

// Quick actions
function askQuickQuestion(question) {
    const input = document.getElementById('chat-input');
    if (input) {
        input.value = question;
        sendMessage();
    }
}

// Text selection and highlighting
function handleTextSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText && selectedText.length > 5) {
        appState.selectedText = selectedText;
        appState.selectedRange = selection.getRangeAt(0);
        
        const explainBtn = document.getElementById('explain-btn');
        if (explainBtn) {
            explainBtn.disabled = false;
            explainBtn.textContent = `"${selectedText.substring(0, 30)}..." erklären`;
        }
    } else {
        appState.selectedText = '';
        appState.selectedRange = null;
        
        const explainBtn = document.getElementById('explain-btn');
        if (explainBtn) {
            explainBtn.disabled = true;
            explainBtn.textContent = 'Erklären';
        }
    }
}

function explainSelected() {
    if (!appState.selectedText) return;
    
    const question = `Erkläre diesen Textabschnitt genauer: "${appState.selectedText}"`;
    const input = document.getElementById('chat-input');
    if (input) {
        input.value = question;
        sendMessage();
    }
}

function toggleHighlightMode() {
    appState.highlightMode = !appState.highlightMode;
    // Implementation for highlight mode would go here
}

// Search functionality
function searchInDocument(query) {
    if (!query || !appState.activeDocument) return;
    
    const contentEl = document.getElementById('document-content');
    const doc = appState.documents.find(d => d.id === appState.activeDocument);
    
    if (!doc || !contentEl) return;
    
    let content = renderMarkdown(doc.content);
    
    if (query.length > 2) {
        const regex = new RegExp(`(${query})`, 'gi');
        content = content.replace(regex, '<mark class="search-highlight">$1</mark>');
    }
    
    contentEl.innerHTML = content;
}

// UI helpers
function showTypingIndicator() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'chat-message assistant';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = `
        <div class="message-content loading-message">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
            <span>Denkt nach...</span>
        </div>
    `;
    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

function showProcessingIndicator(docId) {
    const viewer = document.getElementById('document-viewer');
    if (!viewer) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'processing-indicator';
    indicator.id = 'processing-indicator';
    indicator.innerHTML = `
        <div class="spinner"></div>
        <span>Dokument wird analysiert...</span>
    `;
    viewer.appendChild(indicator);
}

function hideProcessingIndicator() {
    const indicator = document.getElementById('processing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'gerade eben';
    if (diff < 3600000) return `vor ${Math.floor(diff / 60000)} Min`;
    if (diff < 86400000) return `vor ${Math.floor(diff / 3600000)} Std`;
    
    return date.toLocaleDateString('de-DE', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// Global functions for HTML onclick handlers
window.switchToDocument = switchToDocument;
window.closeDocument = closeDocument;
window.sendMessage = sendMessage;
window.askQuickQuestion = askQuickQuestion;
window.explainSelected = explainSelected;
window.toggleHighlightMode = toggleHighlightMode;