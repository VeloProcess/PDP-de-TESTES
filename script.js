document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÕES E CONSTANTES GLOBAIS ---
    // IMPORTANTE: Substitua pela URL da sua NOVA implantação do Apps Script!
    const BACKEND_URL = "https://script.google.com/macros/s/AKfycbw6QUxdlbd6S8KJs0YVLOygcig75QSCA9cSd0HN6I-uT-POOihfYPhQdiIGil-LsYHK/exec";

    // --- SELETORES DE ELEMENTOS DOM ---
    const identificacaoOverlay = document.getElementById('identificacao-overlay');
    const formRegistro = document.getElementById('form-registro');
    const formLogin = document.getElementById('form-login');
    const statusMessage = document.getElementById('status-message');
    const registroView = document.getElementById('registro-view');
    const loginView = document.getElementById('login-view');
    const toggleLink = document.getElementById('toggle-link');
    const appWrapper = document.querySelector('.app-wrapper');

    // --- LÓGICA DE AUTENTICAÇÃO (MODIFICADA) ---

    /**
     * Função genérica para enviar dados (login/registro) para o back-end.
     * @param {object} payload - O objeto de dados a ser enviado, incluindo a 'action'.
     */
    async function enviarDadosAutenticacao(payload) {
        statusMessage.textContent = 'Processando...';
        statusMessage.style.color = 'var(--cor-texto-secundario)';

        try {
            // MUDANÇA PRINCIPAL: Enviamos a requisição sem o header 'Content-Type: application/json'.
            // Isso faz com que o navegador a trate como uma "requisição simples" (text/plain),
            // que NÃO precisa da verificação de segurança CORS (preflight) que está a causar o erro.
            const response = await fetch(BACKEND_URL, {
                method: 'POST',
                body: JSON.stringify(payload) // O corpo continua a ser uma string JSON
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Erro de rede: ${response.status}. Resposta: ${errorBody}`);
            }

            const data = await response.json();

            statusMessage.textContent = data.mensagem;

            if (data.status === 'sucesso') {
                statusMessage.style.color = 'var(--cor-sucesso)';
                
                if (payload.action === 'login') {
                    identificacaoOverlay.style.display = 'none';
                    appWrapper.style.display = 'grid';
                    iniciarBot({ email: payload.email, nome: payload.email.split('@')[0] });
                } else if (payload.action === 'registrar') {
                    formRegistro.reset();
                    toggleLink.click();
                }
            } else {
                statusMessage.style.color = 'var(--cor-erro)';
            }

        } catch (error) {
            statusMessage.textContent = 'Erro de conexão ou script. Verifique o console (F12).';
            statusMessage.style.color = 'var(--cor-erro)';
            console.error("Erro na autenticação:", error);
        }
    }

    // Listener para o formulário de REGISTRO
    formRegistro.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = document.getElementById('registro-email').value;
        const senha = document.getElementById('registro-senha').value;
        enviarDadosAutenticacao({ action: 'registrar', email, senha });
    });

    // Listener para o formulário de LOGIN
    formLogin.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = document.getElementById('login-email').value;
        const senha = document.getElementById('login-senha').value;
        enviarDadosAutenticacao({ action: 'login', email, senha });
    });

    // Listener para o link que alterna entre as telas
    toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        const isLoginVisible = loginView.style.display !== 'none';
        loginView.style.display = isLoginVisible ? 'none' : 'block';
        registroView.style.display = isLoginVisible ? 'block' : 'none';
        toggleLink.textContent = isLoginVisible ? 'Já tem uma conta? Faça login' : 'Não tem uma conta? Registre-se';
        statusMessage.textContent = '';
    });


    /**
     * Função principal que inicializa toda a lógica do chat APÓS o login bem-sucedido.
     * @param {object} dadosAtendente - Objeto com e-mail do usuário logado.
     */
    function iniciarBot(dadosAtendente) {
        const chatBox = document.getElementById('chat-box');
        const userInput = document.getElementById('user-input');
        const sendButton = document.getElementById('send-button');
        const themeSwitcher = document.getElementById('theme-switcher');
        const body = document.body;
        const questionSearch = document.getElementById('question-search');
        const allQuestions = document.querySelectorAll('#quick-questions-list li, .more-questions-list li');
        const expandableHeader = document.getElementById('expandable-faq-header');
        
        let ultimaPergunta = '';
        let ultimaLinhaDaFonte = null;
        let isTyping = false;

        // --- FUNÇÕES AUXILIARES E DE LÓGICA DO CHAT ---

        async function copiarTextoParaClipboard(texto) {
            try {
                await navigator.clipboard.writeText(texto);
                return true;
            } catch (err) {
                console.warn('Falha na API Clipboard, usando fallback.', err);
                const textArea = document.createElement("textarea");
                textArea.value = texto;
                textArea.style.position = "fixed";
                textArea.style.top = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    return successful;
                } catch (fallbackErr) {
                    console.error('Falha total ao tentar copiar.', fallbackErr);
                    document.body.removeChild(textArea);
                    return false;
                }
            }
        }

        function showTypingIndicator() {
            if (isTyping) return;
            isTyping = true;
            const typingContainer = document.createElement('div');
            typingContainer.className = 'message-container bot';
            typingContainer.id = 'typing-indicator';
            typingContainer.innerHTML = `
                <div class="avatar bot">🤖</div>
                <div class="message-content">
                    <div class="message typing-indicator">
                        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                    </div>
                </div>`;
            chatBox.appendChild(typingContainer);
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        function hideTypingIndicator() {
            isTyping = false;
            const typingIndicator = document.getElementById('typing-indicator');
            if (typingIndicator) typingIndicator.remove();
        }
        
        async function enviarFeedback(action, container, positiveBtn, negativeBtn) {
            if (!ultimaPergunta || !ultimaLinhaDaFonte) return;
            
            positiveBtn.disabled = true;
            negativeBtn.disabled = true;
            container.innerHTML = '<span style="font-size: 12px; color: var(--cor-texto-secundario);">Obrigado!</span>';

            try {
                await fetch(BACKEND_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: action,
                        question: ultimaPergunta,
                        sourceRow: ultimaLinhaDaFonte,
                        email: dadosAtendente.email
                    })
                });
            } catch (error) {
                console.error("Erro ao enviar feedback:", error);
                container.innerHTML = ''; 
                container.appendChild(positiveBtn);
                container.appendChild(negativeBtn);
                positiveBtn.disabled = false;
                negativeBtn.disabled = false;
            }
        }
        
        function addMessage(message, sender, options = {}) {
            hideTypingIndicator();
            const { sourceRow = null } = options;
            
            const messageContainer = document.createElement('div');
            messageContainer.classList.add('message-container', sender);
            
            const avatarDiv = `<div class="avatar ${sender}">${sender === 'user' ? '👤' : '🤖'}</div>`;
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
                copyBtn.onclick = () => {
                    const textToCopy = messageContainer.querySelector('.message').innerText;
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

                const messageContentEl = messageContainer.querySelector('.message-content');
                const feedbackContainer = document.createElement('div');
                feedbackContainer.className = 'feedback-container';

                const positiveBtn = document.createElement('button');
                positiveBtn.className = 'feedback-btn positive';
                positiveBtn.innerHTML = '�';
                positiveBtn.title = 'Resposta útil';

                const negativeBtn = document.createElement('button');
                negativeBtn.className = 'feedback-btn negative';
                negativeBtn.innerHTML = '👎';
                negativeBtn.title = 'Resposta incorreta';

                positiveBtn.onclick = () => {
                    positiveBtn.classList.add('active');
                    negativeBtn.classList.remove('active');
                    enviarFeedback('logFeedbackPositivo', feedbackContainer, positiveBtn, negativeBtn);
                };

                negativeBtn.onclick = () => {
                    negativeBtn.classList.add('active');
                    positiveBtn.classList.remove('active');
                    enviarFeedback('logFeedbackNegativo', feedbackContainer, positiveBtn, negativeBtn);
                };
                
                feedbackContainer.appendChild(positiveBtn);
                feedbackContainer.appendChild(negativeBtn);
                messageContentEl.appendChild(feedbackContainer);
            }
            
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        async function buscarResposta(textoDaPergunta) {
            ultimaPergunta = textoDaPergunta;
            ultimaLinhaDaFonte = null;
            if (!textoDaPergunta.trim()) return;

            addMessage(textoDaPergunta, 'user');
            userInput.value = '';
            showTypingIndicator();
            
            try {
                const url = `${BACKEND_URL}?pergunta=${encodeURIComponent(textoDaPergunta)}&email=${encodeURIComponent(dadosAtendente.email)}`;
                const response = await fetch(url);
                
                if (!response.ok) throw new Error(`Erro de rede: ${response.status}`);
                
                const data = await response.json();
                
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
            if (trimmedText) {
                buscarResposta(trimmedText);
            }
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

        // --- EVENT LISTENERS ---

        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage(userInput.value);
            }
        });
        
        sendButton.addEventListener('click', () => handleSendMessage(userInput.value));
        
        allQuestions.forEach(item => {
            item.addEventListener('click', (e) => handleSendMessage(e.currentTarget.getAttribute('data-question')));
        });

        questionSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            allQuestions.forEach(question => {
                const text = question.textContent.toLowerCase();
                question.style.display = text.includes(searchTerm) ? 'flex' : 'none';
            });
        });

        expandableHeader.addEventListener('click', (e) => {
            const container = e.currentTarget;
            container.classList.toggle('expanded');
            const content = document.getElementById('more-questions');
            content.style.display = container.classList.contains('expanded') ? 'block' : 'none';
        });

        themeSwitcher.addEventListener('click', () => {
            body.classList.toggle('dark-theme');
            const isDark = body.classList.contains('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeSwitcher.innerHTML = isDark ? '🌙' : '☀️';
        });
        
        // --- INICIALIZAÇÃO DO CHAT ---
        const primeiroNome = dadosAtendente.nome.split(' ')[0];
        addMessage(`Olá, ${primeiroNome}! Como posso te ajudar?`, 'bot');
        setInitialTheme();
    }

});
