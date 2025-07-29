document.addEventListener('DOMContentLoaded', () => {
    // ================== CONFIGURAÇÕES ==================
    // ⚠️ ATENÇÃO: Cole aqui a URL do seu PROXY ou do seu SCRIPT DO GOOGLE.
    const BACKEND_URL = "https://script.google.com/macros/s/AKfycbzaR1T6Ngr9AUZuiG2-erzwC6xEISQgUUKTpe5VBtF6DVs0V-j-sKfNykaZgKcWczV6hQ/exec";
    
    const DOMINIO_PERMITIDO = "@velotax.com.br";
    const CLIENT_ID = '827325386401-ahi2f9ume9i7lc28lau7j4qlviv5d22k.apps.googleusercontent.com';

    // ================== ELEMENTOS DO DOM ==================
    const appWrapper = document.querySelector('.app-wrapper');
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    
    // Elementos do Modal de Curadoria
    const curadoriaOverlay = document.getElementById('curadoria-overlay');
    const curadoriaForm = document.getElementById('curadoria-form');
    const curadoriaCancelBtn = document.getElementById('curadoria-cancel');
    const curadoriaComentario = document.getElementById('curadoria-comentario');

    // ================== VARIÁVEIS DE ESTADO ==================
    let ultimaPergunta = '';
    let dadosAtendente = null; // Guardará {nome, email}
    
    // Variável para guardar os dados da resposta que está a receber feedback
    let dadosParaFeedback = null; 

    // ================== LÓGICA DE AUTENTICAÇÃO (Exemplo simplificado) ==================
    function simularLogin() {
        // Em um ambiente real, esta função seria substituída pela sua lógica de autenticação do Google
        dadosAtendente = { nome: "Atendente", email: "atendente@velotax.com.br" };
        appWrapper.classList.remove('hidden');
        addMessage(`Olá, ${dadosAtendente.nome}! Como posso ajudar?`, 'bot');
    }


    // ================== FUNÇÕES DO CHAT ==================

    /**
     * Adiciona uma mensagem à caixa de chat.
     * @param {string} text - O texto da mensagem.
     * @param {string} sender - 'user' ou 'bot'.
     * @param {object} [options={}] - Dados extras, como a linha da planilha (sourceRow).
     */
    function addMessage(text, sender, options = {}) {
        const { sourceRow = null } = options;
        const messageContainer = document.createElement('div');
        messageContainer.classList.add('message-container', sender);

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.innerHTML = text.replace(/\n/g, '<br>');
        
        messageContainer.appendChild(messageDiv);

        if (sender === 'bot' && sourceRow) {
            const feedbackContainer = document.createElement('div');
            feedbackContainer.className = 'feedback-controls';
            
            const positiveBtn = document.createElement('button');
            positiveBtn.className = 'feedback-btn';
            positiveBtn.innerHTML = '👍';
            positiveBtn.title = 'Resposta útil';
            positiveBtn.onclick = () => {
                enviarFeedback('logFeedbackPositivo', { question: ultimaPergunta, sourceRow: sourceRow });
                feedbackContainer.innerHTML = `<span class="feedback-thanks">Obrigado!</span>`;
            };

            const negativeBtn = document.createElement('button');
            negativeBtn.className = 'feedback-btn';
            negativeBtn.innerHTML = '👎';
            negativeBtn.title = 'Resposta incorreta';
            negativeBtn.onclick = () => {
                // Guarda os dados necessários para quando o formulário for submetido
                dadosParaFeedback = {
                    question: ultimaPergunta,
                    sourceRow: sourceRow
                };
                // Mostra o modal de curadoria que já existe no HTML
                curadoriaOverlay.classList.remove('hidden');
            };

            feedbackContainer.appendChild(positiveBtn);
            feedbackContainer.appendChild(negativeBtn);
            messageDiv.appendChild(feedbackContainer);
        }
        
        chatBox.appendChild(messageContainer);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    /**
     * Envia a pergunta para o backend e processa a resposta.
     */
    async function buscarResposta(textoDaPergunta) {
        ultimaPergunta = textoDaPergunta;
        if (!textoDaPergunta.trim()) return;

        addMessage("Digitando...", "bot", { sourceRow: null }); // Feedback visual

        try {
            const url = new URL(BACKEND_URL);
            const params = new URLSearchParams();
            params.append('pergunta', textoDaPergunta);
            if (dadosAtendente) {
                params.append('email', dadosAtendente.email);
            }
            // Para requisições GET, os parâmetros são adicionados à URL
            // O proxy precisa ser configurado para lidar com GET e passar os parâmetros
            const requestUrl = `${BACKEND_URL}?${params.toString()}`;

            const response = await fetch(requestUrl); // Método GET é o padrão
            
            if (!response.ok) {
                 throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Remove a mensagem "Digitando..."
            const typingIndicator = chatBox.querySelector('.message-container:last-child');
            if (typingIndicator && typingIndicator.textContent.includes("Digitando...")) {
                typingIndicator.remove();
            }

            if (data.status === 'sucesso') {
                addMessage(data.resposta, 'bot', { sourceRow: data.sourceRow });
            } else {
                addMessage(data.mensagem || "Ocorreu um erro.", 'bot');
            }
        } catch (error) {
            console.error("Erro ao buscar resposta:", error);
            const typingIndicator = chatBox.querySelector('.message-container:last-child');
            if (typingIndicator && typingIndicator.textContent.includes("Digitando...")) {
                typingIndicator.remove();
            }
            addMessage("Não foi possível conectar ao servidor. Verifique o console (F12).", 'bot');
        }
    }

    /**
     * Envia o feedback (positivo ou negativo com sugestão) para o backend.
     * @param {string} action - 'logFeedbackPositivo' ou 'logFeedbackNegativo'.
     * @param {object} data - Contém a pergunta e a linha da fonte.
     * @param {string} [sugestao=''] - O texto da sugestão (opcional).
     */
    async function enviarFeedback(action, data, sugestao = '') {
        if (!data) return;

        const payload = {
            action: action,
            question: data.question,
            sourceRow: data.sourceRow,
            email: dadosAtendente ? dadosAtendente.email : 'nao_identificado',
            sugestao: sugestao
        };

        console.log("Enviando Feedback:", payload);

        try {
            await fetch(BACKEND_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error("Erro ao enviar feedback:", error);
            // Não incomodar o utilizador com erros de feedback
        }
    }
    
    // ================== EVENT LISTENERS ==================

    // Enviar mensagem
    function handleSendMessage() {
        const question = userInput.value.trim();
        if (!question) return;
        addMessage(question, 'user');
        buscarResposta(question);
        userInput.value = '';
    }
    
    sendButton.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Listeners do Modal de Curadoria
    curadoriaForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const sugestao = curadoriaComentario.value.trim();
        if (sugestao && dadosParaFeedback) {
            enviarFeedback('logFeedbackNegativo', dadosParaFeedback, sugestao);
            curadoriaOverlay.classList.add('hidden');
            curadoriaComentario.value = '';
            alert('Obrigado pela sua sugestão!');
        }
    });

    curadoriaCancelBtn.addEventListener('click', () => {
        curadoriaOverlay.classList.add('hidden');
        curadoriaComentario.value = '';
    });
    
    // Listener para as perguntas rápidas na sidebar
    document.querySelectorAll('#quick-questions-list li, #more-questions-list-financeiro li, #more-questions-list-tecnico li').forEach(item => {
      item.addEventListener('click', (e) => {
        const question = e.currentTarget.getAttribute('data-question');
        addMessage(question, 'user');
        buscarResposta(question);
      });
    });

    // ================== INICIALIZAÇÃO ==================
    simularLogin(); // Inicia a aplicação com o login simulado

});
