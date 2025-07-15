document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONFIGURAÇÕES E CONSTANTES GLOBAIS ---
    const DOMINIO_PERMITIDO = "@velotax.com.br";
    const BACKEND_URL = "https://script.google.com/macros/s/AKfycbx0u-3qCjA-sVmkOSPDJSf4R2OKRnLxAb0j_gPQ_RaNLN8DzrMj9ZgFQWsUe8diN2grFg/exec";
    const UM_DIA_EM_MS = 24 * 60 * 60 * 1000; // 86,400,000 milissegundos

    // --- SELETORES DE ELEMENTOS DOM PRINCIPAIS ---
    const identificacaoOverlay = document.getElementById('identificacao-overlay');
    const identificacaoForm = document.getElementById('identificacao-form');
    const appWrapper = document.querySelector('.app-wrapper');

    // --- LÓGICA DE AUTENTICAÇÃO E INICIALIZAÇÃO ---

    /**
     * Verifica se existe uma sessão válida no localStorage.
     * Se não for válida, mostra o overlay de login.
     * Se for válida, inicia o aplicativo de chat.
     */
    function verificarIdentificacao() {
        let dadosSalvos = null;
        try {
            const dadosSalvosString = localStorage.getItem('dadosAtendenteChatbot');
            if (dadosSalvosString) {
                dadosSalvos = JSON.parse(dadosSalvosString);
            }
        } catch (e) {
            console.error("Erro ao ler dados do localStorage:", e);
            localStorage.removeItem('dadosAtendenteChatbot');
        }

        const sessaoValida = dadosSalvos && 
                             dadosSalvos.email &&
                             dadosSalvos.email.endsWith(DOMINIO_PERMITIDO) &&
                             (Date.now() - dadosSalvos.timestamp < UM_DIA_EM_MS);

        if (!sessaoValida) {
            identificacaoOverlay.style.display = 'flex';
            appWrapper.style.visibility = 'hidden';
        } else {
            identificacaoOverlay.style.display = 'none';
            appWrapper.style.visibility = 'visible';
            iniciarBot(dadosSalvos);
        }
    }

    /**
     * Listener para o formulário de identificação.
     * Valida os dados e, se corretos, armazena no localStorage e inicia o chat.
     */
    identificacaoForm.addEventListener('submit', (event) => {
        event.preventDefault();
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

    /**
     * Função principal que inicializa toda a lógica do chat após a autenticação.
     * @param {object} dadosAtendente - Objeto com nome e e-mail do usuário.
     */
    function iniciarBot(dadosAtendente) {
        // Seletores de elementos do Chat
        const chatBox = document.getElementById('chat-box');
        const userInput = document.getElementById('user-input');
        const sendButton = document.getElementById('send-button');
        const themeSwitcher = document.getElementById('theme-switcher');
        const body = document.body;
        const questionSearch = document.getElementById('question-search');
        const allQuestions = document.querySelectorAll('#quick-questions-list li, .more-questions-list li');
        const expandableHeader = document.getElementById('expandable-faq-header');
        
        // Variáveis de estado do chat
        let ultimaPergunta = '';
        let ultimaLinhaDaFonte = null;
        let isTyping = false;

        // --- FUNÇÕES AUXILIARES E DE LÓGICA DO CHAT ---

        /**
         * Copia um texto para a área de transferência, com fallback para métodos antigos.
         * @param {string} texto - O texto a ser copiado.
         * @returns {Promise<boolean>} - True se a cópia foi bem-sucedida, false caso contrário.
         */
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

        /**
         * Mostra o indicador de "digitando...".
         */
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

        /**
         * Esconde o indicador de "digitando...".
         */
        function hideTypingIndicator() {
            isTyping = false;
            const typingIndicator = document.getElementById('typing-indicator');
            if (typingIndicator) typingIndicator.remove();
        }
        
        /**
         * Envia o feedback (positivo ou negativo) para o backend.
         * @param {string} action - Ação a ser registrada (ex: 'logFeedbackPositivo').
         * @param {HTMLElement} container - O elemento que contém os botões de feedback.
         * @param {HTMLElement} positiveBtn - O botão de feedback positivo.
         * @param {HTMLElement} negativeBtn - O botão de feedback negativo.
         */
        async function enviarFeedback(action, container, positiveBtn, negativeBtn) {
            if (!ultimaPergunta || !ultimaLinhaDaFonte) return;
            
            positiveBtn.disabled = true;
            negativeBtn.disabled = true;

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
                container.innerHTML = ''; 
                container.appendChild(positiveBtn);
                container.appendChild(negativeBtn);
                positiveBtn.disabled = false;
                negativeBtn.disabled = false;
            }
        }
        
        /**
         * Adiciona uma nova mensagem à caixa de chat.
         * @param {string} message - O conteúdo da mensagem.
         * @param {string} sender - 'user' ou 'bot'.
         * @param {object} options - Opções adicionais, como 'sourceRow'.
         */
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
                positiveBtn.innerHTML = '👍';
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

        /**
         * Busca a resposta para uma pergunta no backend.
         * @param {string} textoDaPergunta - A pergunta do usuário.
         */
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

        /**
         * Função de conveniência para lidar com o envio de uma mensagem.
         * @param {string} text - O texto a ser enviado.
         */
        function handleSendMessage(text) {
            const trimmedText = text.trim();
            if (trimmedText) {
                buscarResposta(trimmedText);
            }
        }
        
        /**
         * Define o tema inicial (claro ou escuro) com base no localStorage.
         */
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

        // --- EVENT LISTENERS (OUVINTES DE EVENTOS) ---

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

    // --- PONTO DE ENTRADA PRINCIPAL DA APLICAÇÃO ---
    verificarIdentificacao();
});