script.js
/**
 * Função de callback para o login do Google.
 * É chamada pela API do Google após o usuário fazer login.
 */
function handleCredentialResponse(response) {
    try {
        const userObject = JSON.parse(atob(response.credential.split('.')[1]));
        const dadosAtendente = {
            nome: userObject.name,
            email: userObject.email,
            foto: userObject.picture,
            timestamp: Date.now()
        };

        const DOMINIO_PERMITIDO = "@velotax.com.br";
        if (!dadosAtendente.email.endsWith(DOMINIO_PERMITIDO)) {
            alert("Acesso negado. Por favor, use uma conta Google com o domínio " + DOMINIO_PERMITIDO);
            return;
        }

        localStorage.setItem('dadosAtendenteChatbot', JSON.stringify(dadosAtendente));
        
        document.getElementById('login-screen').style.display = 'none';
        document.querySelector('.app-wrapper').classList.remove('hidden');
        
        iniciarBot(dadosAtendente);

    } catch (error) {
        console.error("Erro ao processar o login do Google:", error);
        alert("Ocorreu um erro ao tentar fazer o login. Verifique o console para mais detalhes.");
    }
}

/**
 * Função principal que inicia toda a lógica do chatbot e da interface.
 */
function iniciarBot(dadosAtendente) {
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const themeSwitcher = document.getElementById('theme-switcher');
    const body = document.body;
    const questionSearch = document.getElementById('question-search');
    
    let ultimaPergunta = '';
    let ultimaLinhaDaFonte = null;
    let isTyping = false;
    
    const BACKEND_URL = "https://script.google.com/macros/s/AKfycbw8n95lQr5-RbxG9qYG7O_3ZEOVkVQ3K50C3iFM9JViLyEsa8hiDuRuCzlgy_YPoI43/exec";

    async function copiarTextoParaClipboard(texto) {
        try {
            await navigator.clipboard.writeText(texto);
            return true;
        } catch (err) {
            console.warn('Método de cópia falhou', err);
            const textArea = document.createElement("textarea");
            textArea.value = texto;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            } catch (fallbackErr) {
                document.body.removeChild(textArea);
                return false;
            }
        }
    }

    function showTypingIndicator() {
        if (isTyping) return;
        isTyping = true;
        const typingContainer = document.createElement('div');
        typingContainer.className = 'message-container bot typing-indicator';
        typingContainer.id = 'typing-indicator';
        typingContainer.innerHTML = `<div class="avatar bot">🤖</div><div class="message-content"><div class="message"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
        chatBox.appendChild(typingContainer);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function hideTypingIndicator() {
        isTyping = false;
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    function addMessage(message, sender, options = {}) {
        const { sourceRow = null } = options;
        const messageContainer = document.createElement('div');
        messageContainer.classList.add('message-container', sender);
        
        const avatarDiv = `<div class="avatar ${sender}">${sender === 'user' ? '👤' : '🤖'}</div>`;
        const messageContentDiv = `<div class="message-content"><div class="message">${message.replace(/\n/g, '<br>')}</div></div>`;

        messageContainer.innerHTML = sender === 'user' ? messageContentDiv + avatarDiv : avatarDiv + messageContentDiv;
        chatBox.appendChild(messageContainer);

        if (sender === 'bot' && sourceRow) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.title = 'Copiar resposta';
            copyBtn.innerHTML = '📋';
            copyBtn.onclick = () => {
                const textToCopy = messageContainer.querySelector('.message').textContent;
                copiarTextoParaClipboard(textToCopy).then(success => {
                    if (success) {
                        copyBtn.innerHTML = '✅';
                        copyBtn.classList.add('copied');
                        setTimeout(() => {
                            copyBtn.innerHTML = '📋';
                            copyBtn.classList.remove('copied');
                        }, 2000);
                    }
                });
            };
            messageContainer.appendChild(copyBtn);

            const feedbackContainer = document.createElement('div');
            feedbackContainer.className = 'feedback-container';

            const positiveBtn = document.createElement('button');
            positiveBtn.className = 'feedback-btn positive';
            positiveBtn.innerHTML = '👍';
            positiveBtn.title = 'Resposta útil';
            positiveBtn.onclick = () => enviarFeedback('logFeedbackPositivo', feedbackContainer);
            
            const negativeBtn = document.createElement('button');
            negativeBtn.className = 'feedback-btn negative';
            negativeBtn.innerHTML = '👎';
            negativeBtn.title = 'Resposta incorreta';
            negativeBtn.onclick = () => enviarFeedback('logFeedbackNegativo', feedbackContainer);
            
            feedbackContainer.appendChild(positiveBtn);
            feedbackContainer.appendChild(negativeBtn);
            messageContainer.querySelector('.message-content').appendChild(feedbackContainer);
        }
        
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    
    async function enviarFeedback(action, container) {
        if (!ultimaPergunta || !ultimaLinhaDaFonte) return;
        container.innerHTML = '<span style="font-size: 12px; color: var(--cor-texto-secundario);">Obrigado!</span>';

        try {
            await fetch(BACKEND_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({
                    action: action,
                    question: ultimaPergunta,
                    sourceRow: ultimaLinhaDaFonte,
                    email: dadosAtendente.email
                })
            });
        } catch (error) {
            console.error("Erro ao enviar feedback:", error);
        }
    }
    
    async function buscarResposta(textoDaPergunta) {
        ultimaPergunta = textoDaPergunta;
        ultimaLinhaDaFonte = null;
        if (!textoDaPergunta.trim()) return;

        addMessage(textoDaPergunta, 'user');
        showTypingIndicator();

        try {
            const url = `${BACKEND_URL}?pergunta=${encodeURIComponent(textoDaPergunta)}&email=${encodeURIComponent(dadosAtendente.email)}`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error(`Erro de rede: ${response.status}`);
            
            const data = await response.json();
            hideTypingIndicator();

            if (data.status === 'sucesso') {
                ultimaLinhaDaFonte = data.sourceRow;
                addMessage(data.resposta, 'bot', { sourceRow: data.sourceRow });
            } else {
                addMessage(data.mensagem || "Ocorreu um erro.", 'bot');
            }
        } catch (error) {
            hideTypingIndicator();
            console.error("Erro ao buscar resposta:", error);
            addMessage("Erro de conexão. Verifique o console para mais detalhes.", 'bot');
        }
    }

    function handleSendMessage(text) {
        const trimmedText = text.trim();
        if (!trimmedText) return;
        buscarResposta(trimmedText);
        userInput.value = '';
    }

    function setInitialTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            body.classList.add('dark-theme');
            themeSwitcher.innerHTML = '🌙';
        } else {
            body.classList.remove('dark-theme');
            themeSwitcher.innerHTML = '☀️';
        }
    }
    
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSendMessage(userInput.value);
        }
    });

    sendButton.addEventListener('click', () => handleSendMessage(userInput.value));
    
    document.querySelectorAll('#quick-questions-list li, #more-questions-list-financeiro li, #more-questions-list-tecnico li').forEach(item => {
        item.addEventListener('click', (e) => handleSendMessage(e.currentTarget.getAttribute('data-question')));
    });

    document.getElementById('expandable-faq-header').addEventListener('click', (e) => {
        e.currentTarget.classList.toggle('expanded');
        document.getElementById('more-questions').style.display = e.currentTarget.classList.contains('expanded') ? 'block' : 'none';
    });

    themeSwitcher.addEventListener('click', () => {
        body.classList.toggle('dark-theme');
        const isDark = body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeSwitcher.innerHTML = isDark ? '🌙' : '☀️';
    });
    
    questionSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('#quick-questions-list li, #more-questions-list-financeiro li, #more-questions-list-tecnico li').forEach(question => {
            const text = question.textContent.toLowerCase();
            question.style.display = text.includes(searchTerm) ? 'flex' : 'none';
        });
    });

    setInitialTheme();
    const primeiroNome = dadosAtendente.nome.split(' ')[0];
    
    chatBox.innerHTML = '';
    addMessage(`Olá, ${primeiroNome}! Como posso te ajudar?`, 'bot');
}

/**
 * Verifica se há uma sessão de login válida no localStorage quando a página carrega.
 */
function verificarIdentificacao() {
    const loginScreen = document.getElementById('login-screen');
    const appWrapper = document.querySelector('.app-wrapper');
    const DOMINIO_PERMITIDO = "@velotax.com.br";
    const umDiaEmMs = 24 * 60 * 60 * 1000;
    let dadosSalvos = null;

    try {
        const dadosSalvosString = localStorage.getItem('dadosAtendenteChatbot');
        if (dadosSalvosString) dadosSalvos = JSON.parse(dadosSalvosString);
    } catch (e) {
        localStorage.removeItem('dadosAtendenteChatbot');
    }

    if (dadosSalvos && (Date.now() - dadosSalvos.timestamp < umDiaEmMs) && dadosSalvos.email.endsWith(DOMINIO_PERMITIDO)) {
        loginScreen.style.display = 'none';
        appWrapper.classList.remove('hidden');
        iniciarBot(dadosSalvos);
    } else {
        localStorage.removeItem('dadosAtendenteChatbot');
        loginScreen.style.display = 'flex';
        appWrapper.classList.add('hidden');
    }
}

// Executa a verificação de sessão assim que o DOM estiver pronto
document.addEventListener('DOMContentLoaded', verificarIdentificacao);
