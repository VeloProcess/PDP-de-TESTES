/**
 * Função global para iniciar toda a lógica do chatbot e da interface.
 * É chamada após um login bem-sucedido ou ao encontrar uma sessão válida.
 * @param {object} dadosAtendente - Os dados do usuário logado (nome, email, foto).
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

    function addMessage(message, sender, options = {}) {
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
        container.innerHTML = '<span>Obrigado!</span>';

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

        try {
            const url = `${BACKEND_URL}?pergunta=${encodeURIComponent(textoDaPergunta)}&email=${encodeURIComponent(dadosAtendente.email)}`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error(`Erro de rede: ${response.status}`);
            
            const data = await response.json();

            if (data.status === 'sucesso') {
                addMessage(data.resposta, 'bot', { sourceRow: data.sourceRow });
            } else {
                addMessage(data.mensagem || "Ocorreu um erro.", 'bot');
            }
        } catch (error) {
            console.error("Erro ao buscar resposta:", error);
            addMessage("Erro de conexão.", 'bot');
        }
    }

    function handleSendMessage(text) {
        const trimmedText = text.trim();
        if (!trimmedText) return;
        buscarResposta(trimmedText);
        userInput.value = '';
    }

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSendMessage(userInput.value);
        }
    });

    sendButton.addEventListener('click', () => handleSendMessage(userInput.value));
    
    const primeiroNome = dadosAtendente.nome.split(' ')[0];
    chatBox.innerHTML = '';
    addMessage(`Olá, ${primeiroNome}! Como posso te ajudar?`, 'bot');
}

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

document.addEventListener('DOMContentLoaded', verificarIdentificacao);
