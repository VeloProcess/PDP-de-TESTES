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

 * Função principal que inicia toda a lógica do chatbot e da interface.
document.addEventListener('DOMContentLoaded', () => {
            const identificacaoOverlay = document.getElementById('identificacao-overlay');
            const identificacaoForm = document.getElementById('identificacao-form');
            const appWrapper = document.querySelector('.app-wrapper');

            function verificarIdentificacao() {
                const DOMINIO_PERMITIDO = "@velotax.com.br";
                const umDiaEmMs = 24 * 60 * 60 * 1000;
                let dadosSalvos = null;
                try {
                    const dadosSalvosString = localStorage.getItem('dadosAtendenteChatbot');
                    if(dadosSalvosString) dadosSalvos = JSON.parse(dadosSalvosString);
                } catch(e) { 
                    localStorage.removeItem('dadosAtendenteChatbot'); 
                }
                
                if (!dadosSalvos || (Date.now() - dadosSalvos.timestamp > umDiaEmMs) || !dadosSalvos.email.endsWith(DOMINIO_PERMITIDO)) {
                    identificacaoOverlay.style.display = 'flex';
                    appWrapper.style.visibility = 'hidden';
                } else {
                    identificacaoOverlay.style.display = 'none';
                    appWrapper.style.visibility = 'visible';
                    iniciarBot(dadosSalvos);
                }
            }

            identificacaoForm.addEventListener('submit', function(event) {
                event.preventDefault();
                const DOMINIO_PERMITIDO = "@velotax.com.br";
                const nome = document.getElementById('nome-input').value.trim();
                const email = document.getElementById('email-input').value.trim().toLowerCase();
                const errorMsg = document.getElementById('identificacao-error');

                if (nome && email && email.endsWith(DOMINIO_PERMITIDO)) {
                    const dadosAtendente = { nome, email, timestamp: Date.now() };
                    localStorage.setItem('dadosAtendenteChatbot', JSON.stringify(dadosAtendente));
                    identificacaoOverlay.style.display = 'none';
                    appWrapper.style.visibility = 'visible';
                    iniciarBot(dadosAtendente);
                } else {
                    errorMsg.style.display = 'block';
                }
            });

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
    
    const BACKEND_URL = "https://script.google.com/macros/s/AKfycbx0u-3qCjA-sVmkOSPDJSf4R2OKRnLxAb0j_gPQ_RaNLN8DzrMj9ZgFQWsUe8diN2grFg/exec";

    // ✅ FUNÇÃO DE AJUDA PARA COPIAR (A QUE ESTAVA FALTANDO)
   async function copiarTextoParaClipboard(texto) {
    try {
        // Tenta o método moderno. Ele pode falhar por falta de permissão.
        await navigator.clipboard.writeText(texto);
        return true; // Sucesso com o método moderno!
    } catch (err) {
        // Se o método moderno falhar, o 'catch' é ativado e tentamos o método antigo.
        console.warn('Método moderno de cópia falhou, tentando fallback...', err);
        
        const textArea = document.createElement("textarea");
        textArea.value = texto;
        textArea.style.position = "fixed";
        textArea.style.top = "-9999px";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            // Tenta executar o comando de cópia antigo
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful) {
                return true; // Sucesso com o método antigo!
            } else {
                return false; // O comando de cópia antigo não foi bem-sucedido
            }
        } catch (fallbackErr) {
            console.error('Falha total ao copiar com ambos os métodos:', fallbackErr);
            document.body.removeChild(textArea);
            return false; // Falha total
        }
    }
}

    questionSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const questions = document.querySelectorAll('#quick-questions-list li, #more-questions-list li');
        
        questions.forEach(question => {
            const text = question.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                question.style.display = 'block';
            } else {
                question.style.display = 'none';
            }
        });
    });

    function showTypingIndicator() {
        if (isTyping) return;
        isTyping = true;
        const typingContainer = document.createElement('div');
        typingContainer.className = 'message-container bot typing-indicator';
        typingContainer.id = 'typing-indicator';
        typingContainer.innerHTML = `
            <div class="avatar bot">🤖</div>
            <div class="message-content">
                <div class="message">
                    <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                </div>
            </div>`;
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
        
        const avatarDiv = `<div class="avatar">${sender === 'user' ? '👤' : '🤖'}</div>`;
        
        const messageContentDiv = `
            <div class="message-content">
                <div class="message">${message.replace(/\n/g, '<br>')}</div>
            </div>`;

        messageContainer.innerHTML = sender === 'user' ? messageContentDiv + avatarDiv : avatarDiv + messageContentDiv;
        
        chatBox.appendChild(messageContainer);

        if (sender === 'bot' && sourceRow) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.title = 'Copiar resposta';
            copyBtn.innerHTML = '📋';

            // ATUALIZADO PARA USAR A FUNÇÃO DE AJUDA
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
                    } else {
                        alert('Não foi possível copiar o texto.');
                    }
                });
            };
            messageContainer.appendChild(copyBtn);

            const feedbackContainer = document.createElement('div');
            feedbackContainer.className = 'feedback-container';

            const positiveBtn = document.createElement('button');
            positiveBtn.className = 'feedback-btn';
            positiveBtn.innerHTML = '👍';
            positiveBtn.title = 'Resposta útil';
            positiveBtn.onclick = () => enviarFeedback('logFeedbackPositivo', feedbackContainer);
            
            const negativeBtn = document.createElement('button');
            negativeBtn.className = 'feedback-btn';
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

        showTypingIndicator();
        
        try {
            const url = `${BACKEND_URL}?pergunta=${encodeURIComponent(textoDaPergunta)}&email=${encodeURIComponent(dadosAtendente.email)}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Erro de rede: ${response.status}`);
            }
            
            const data = await response.json();
            hideTypingIndicator();
            
            if (data.status === 'sucesso') {
                ultimaLinhaDaFonte = data.sourceRow;
                addMessage(data.resposta, 'bot', { sourceRow: data.sourceRow });
            } else {
                addMessage(data.mensagem || "Ocorreu um erro ao processar sua pergunta.", 'bot');
            }
        } catch (error) {
            hideTypingIndicator();
            console.error("Erro ao buscar resposta:", error);
            addMessage("Erro de conexão. Verifique o console (F12) para mais detalhes.", 'bot');
        }
    }

    function handleSendMessage(text) {
        const trimmedText = text.trim();
        if (!trimmedText) return;
        addMessage(trimmedText, 'user');
        buscarResposta(trimmedText);
        userInput.value = '';
    }

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSendMessage(userInput.value); }
    });
    
    sendButton.addEventListener('click', () => handleSendMessage(userInput.value));
    
    document.querySelectorAll('#quick-questions-list li, #more-questions-list li').forEach(item => {
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
    
    const primeiroNome = dadosAtendente.nome.split(' ')[0];
    addMessage(`Olá, ${primeiroNome}! Como posso te ajudar?`, 'bot');
    
    setInitialTheme();
}

            verificarIdentificacao();
        });
