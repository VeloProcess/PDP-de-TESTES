document.addEventListener('DOMContentLoaded', () => {
  // ================== CONFIGURAÇÕES ==================
  // ⚠️ ATENÇÃO: Verifique se esta URL é a URL da sua ÚLTIMA implantação do Google Apps Script.
  const BACKEND_URL = "https://script.google.com/macros/s/AKfycbzDVywti5XAmNHHcBicZ9rs3K0ZOv9Bqx9qM-YVI57hsvotj4nKJYn-YzMCDNXayIPotA/exec";
  
  const DOMINIO_PERMITIDO = "@velotax.com.br";
  const CLIENT_ID = '827325386401-ahi2f9ume9i7lc28lau7j4qlviv5d22k.apps.googleusercontent.com';

  // ================== ELEMENTOS DO DOM ==================
  const identificacaoOverlay = document.getElementById('identificacao-overlay');
  const appWrapper = document.querySelector('.app-wrapper');
  const errorMsg = document.getElementById('identificacao-error');

  // ================== VARIÁVEIS DE ESTADO ==================
  let ultimaPergunta = '';
  let ultimaLinhaDaFonte = null;
  let isTyping = false;
  let dadosAtendente = null;
  let tokenClient = null;

  // ================== FUNÇÕES DE CONTROLE DE UI ==================
  function showOverlay() {
      identificacaoOverlay.classList.remove('hidden');
      appWrapper.classList.add('hidden');
  }
  function hideOverlay() {
      identificacaoOverlay.classList.add('hidden');
      appWrapper.classList.remove('hidden');
  }

  // ================== LÓGICA DE AUTENTICAÇÃO ==================
  function waitForGoogleScript() {
      return new Promise((resolve, reject) => {
          const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
          if (!script) {
              reject(new Error('Script Google Identity Services não encontrado no HTML.'));
              return;
          }
          if (window.google && window.google.accounts) {
              resolve(window.google.accounts);
              return;
          }
          script.addEventListener('load', () => {
              if (window.google && window.google.accounts) {
                  resolve(window.google.accounts);
              } else {
                  reject(new Error('Falha ao carregar Google Identity Services.'));
              }
          });
          script.addEventListener('error', () => {
              reject(new Error('Erro ao carregar o script Google Identity Services.'));
          });
      });
  }

  function initGoogleSignIn() {
      waitForGoogleScript().then(accounts => {
          tokenClient = accounts.oauth2.initTokenClient({
              client_id: CLIENT_ID,
              scope: 'profile email',
              callback: handleGoogleSignIn
          });
          document.getElementById('google-signin-button').addEventListener('click', function() {
              tokenClient.requestAccessToken();
          });
          verificarIdentificacao();
      }).catch(error => {
          errorMsg.textContent = 'Erro ao carregar autenticação do Google. Verifique sua conexão ou tente novamente mais tarde.';
          errorMsg.classList.remove('hidden'); // CORRIGIDO (CSP)
      });
  }

  function handleGoogleSignIn(response) {
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
              Authorization: `Bearer ${response.access_token}`
          }
      })
      .then(res => res.json())
      .then(user => {
          const email = user.email;
          if (email && email.endsWith(DOMINIO_PERMITIDO)) {
              dadosAtendente = { nome: user.name, email: user.email, timestamp: Date.now() };
              localStorage.setItem('dadosAtendenteChatbot', JSON.stringify(dadosAtendente));
              hideOverlay();
              iniciarBot(dadosAtendente);
          } else {
              errorMsg.textContent = 'Acesso permitido apenas para e-mails @velotax.com.br!';
              errorMsg.classList.remove('hidden'); // CORRIGIDO (CSP)
          }
      })
      .catch(error => {
          errorMsg.textContent = 'Erro ao verificar login. Tente novamente.';
          errorMsg.classList.remove('hidden'); // CORRIGIDO (CSP)
      });
  }

  function verificarIdentificacao() {
      const umDiaEmMs = 24 * 60 * 60 * 1000;
      let dadosSalvos = null;
      try {
          const dadosSalvosString = localStorage.getItem('dadosAtendenteChatbot');
          if (dadosSalvosString) {
              dadosSalvos = JSON.parse(dadosSalvosString);
          }
      } catch (e) {
          localStorage.removeItem('dadosAtendenteChatbot');
      }
      if (dadosSalvos && dadosSalvos.email && dadosSalvos.email.endsWith(DOMINIO_PERMITIDO) && (Date.now() - dadosSalvos.timestamp < umDiaEmMs)) {
          hideOverlay();
          iniciarBot(dadosSalvos);
      } else {
          localStorage.removeItem('dadosAtendenteChatbot');
          showOverlay();
      }
  }

  // ================== FUNÇÃO PRINCIPAL DO BOT ==================
  function iniciarBot(dadosAtendente) {
      // Elementos do DOM do bot
      const chatBox = document.getElementById('chat-box');
      const userInput = document.getElementById('user-input');
      const sendButton = document.getElementById('send-button');
      const themeSwitcher = document.getElementById('theme-switcher');
      const body = document.body;
      const questionSearch = document.getElementById('question-search');
      
      document.getElementById('gemini-button').addEventListener('click', function() {
          window.open('https://gemini.google.com/app?hl=pt-BR', '_blank');
      });

      // Filtro de busca de perguntas
      questionSearch.addEventListener('input', (e) => {
          const searchTerm = e.target.value.toLowerCase();
          const questions = document.querySelectorAll('#quick-questions-list li, #more-questions-list-financeiro li, #more-questions-list-tecnico li');
          questions.forEach(question => {
              const text = question.textContent.toLowerCase();
              // CORRIGIDO (CSP): Usa 'toggle' com a classe 'hidden'
              question.classList.toggle('hidden', !text.includes(searchTerm));
          });
      });

      // Indicador de digitação
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
          if (typingIndicator) typingIndicator.remove();
      }

      // Função para copiar texto para a área de transferência
      async function copiarTextoParaClipboard(texto) {
          try {
              await navigator.clipboard.writeText(texto);
              return true;
          } catch (err) {
              // Fallback para navegadores mais antigos
              const textArea = document.createElement("textarea");
              textArea.value = texto;
              // CORRIGIDO (CSP): Usa classe em vez de estilo inline
              textArea.className = 'clipboard-helper'; 
              document.body.appendChild(textArea);
              textArea.focus();
              textArea.select();
              try {
                  document.execCommand('copy');
                  document.body.removeChild(textArea);
                  return true;
              } catch (fallbackErr) {
                  document.body.removeChild(textArea);
                  return false;
              }
          }
      }

      // Adicionar mensagem ao chat
      function addMessage(message, sender, options = {}) {
          const { sourceRow = null } = options;
          const messageContainer = document.createElement('div');
          messageContainer.classList.add('message-container', sender);
          const avatarDiv = `<div class="avatar">${sender === 'user' ? '👤' : '🤖'}</div>`;
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
                      } else {
                          alert('Não foi possível copiar o texto.');
                      }
                  });
              };

              if (sender === 'bot') {
  messageContainer.classList.add('bot-msg');
}
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
              // Substituir o onclick do botão negativo para abrir textarea de sugestão
              negativeBtn.onclick = () => {
                  // Cria overlay para sugestão
                  const overlay = document.createElement('div');
                  overlay.className = 'curadoria-overlay';
                  overlay.style.position = 'fixed';
                  overlay.style.top = 0;
                  overlay.style.left = 0;
                  overlay.style.width = '100vw';
                  overlay.style.height = '100vh';
                  overlay.style.background = 'rgba(0,0,0,0.4)';
                  overlay.style.display = 'flex';
                  overlay.style.alignItems = 'center';
                  overlay.style.justifyContent = 'center';
                  overlay.style.zIndex = 9999;

                  const box = document.createElement('div');
                  box.className = 'curadoria-box';
                  box.style.background = '#fff';
                  box.style.padding = '32px';
                  box.style.borderRadius = '12px';
                  box.style.maxWidth = '400px';
                  box.style.boxShadow = '0 2px 16px rgba(0,0,0,0.15)';
                  box.innerHTML = `<h2>Sugerir Correção</h2><p>A resposta do bot não foi útil. Por favor, descreva qual seria o procedimento ou a informação correta.</p>`;

                  const textarea = document.createElement('textarea');
                  textarea.placeholder = 'Digite sua sugestão aqui...';
                  textarea.style.width = '100%';
                  textarea.style.height = '80px';
                  textarea.style.marginBottom = '16px';
                  box.appendChild(textarea);

                  const btns = document.createElement('div');
                  btns.style.display = 'flex';
                  btns.style.justifyContent = 'flex-end';
                  btns.style.gap = '8px';

                  const cancelar = document.createElement('button');
                  cancelar.textContent = 'Cancelar';
                  cancelar.onclick = () => document.body.removeChild(overlay);
                  btns.appendChild(cancelar);

                  const enviar = document.createElement('button');
                  enviar.textContent = 'Enviar Sugestão';
                  enviar.style.background = '#4CAF50';
                  enviar.style.color = '#fff';
                  enviar.style.border = 'none';
                  enviar.style.padding = '8px 16px';
                  enviar.style.borderRadius = '6px';
                  enviar.onclick = async () => {
                      const sugestao = textarea.value.trim();
                      if (!sugestao) {
                          textarea.style.border = '2px solid #f44336';
                          textarea.focus();
                          return;
                      }
                      await enviarFeedback('logFeedbackNegativo', feedbackContainer, sugestao);
                      document.body.removeChild(overlay);
                  };
                  btns.appendChild(enviar);
                  box.appendChild(btns);
                  overlay.appendChild(box);
                  document.body.appendChild(overlay);
              };
              feedbackContainer.appendChild(negativeBtn);
              messageContainer.querySelector('.message-content').appendChild(feedbackContainer);
          }
          chatBox.scrollTop = chatBox.scrollHeight;
      }

      // Enviar feedback
      async function enviarFeedback(action, container, sugestao = '') {
          if (!ultimaPergunta || !ultimaLinhaDaFonte) return;
          container.textContent = 'Obrigado!';
          container.className = 'feedback-thanks';
          try {
              await fetch(BACKEND_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      action: action,
                      question: ultimaPergunta,
                      sourceRow: ultimaLinhaDaFonte,
                      email: dadosAtendente.email,
                      sugestao: action === 'logFeedbackNegativo' ? sugestao : ''
                  })
              });
          } catch (error) {
              // Silenciar erro de feedback
          }
      }

      // Buscar resposta do backend
      async function buscarResposta(textoDaPergunta) {
          ultimaPergunta = textoDaPergunta;
          ultimaLinhaDaFonte = null;
          if (!textoDaPergunta.trim()) return;
          showTypingIndicator();
          try {
              const url = `${BACKEND_URL}?pergunta=${encodeURIComponent(textoDaPergunta)}&email=${encodeURIComponent(dadosAtendente.email)}`;
              const response = await fetch(url); // Removido o method/headers desnecessários para um GET simples
              hideTypingIndicator();

              if (!response.ok) {
                  throw new Error(`Erro de rede ou CORS: ${response.status}`);
              }
              const data = await response.json();
              
              if (data.status === 'sucesso') {
                  ultimaLinhaDaFonte = data.sourceRow;
                  addMessage(data.resposta, 'bot', { sourceRow: data.sourceRow });
              } else {
                  addMessage(data.mensagem || "Ocorreu um erro ao processar sua pergunta.", 'bot');
              }
          } catch (error) {
              hideTypingIndicator();
              addMessage("Erro de conexão. Verifique se a URL do Backend está correta e se o script foi reimplantado. Detalhes no console (F12).", 'bot');
              console.error("Detalhes do erro de fetch:", error);
          }
      }

      // Enviar mensagem
      function handleSendMessage(text) {
          const trimmedText = text.trim();
          if (!trimmedText) return;
          addMessage(trimmedText, 'user');
          buscarResposta(trimmedText);
          userInput.value = '';
      }

      // Listeners de eventos
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
          const moreQuestions = document.getElementById('more-questions');
          // CORRIGIDO (CSP): Usa 'toggle' com a classe 'hidden'
          moreQuestions.classList.toggle('hidden', !e.currentTarget.classList.contains('expanded'));
      });
      
      themeSwitcher.addEventListener('click', () => {
          body.classList.toggle('dark-theme');
          const isDark = body.classList.contains('dark-theme');
          localStorage.setItem('theme', isDark ? 'dark' : 'light');
          themeSwitcher.innerHTML = isDark ? '🌙' : '☀️';
      });

      // Configurar tema inicial
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

      // Mensagem de boas-vindas
      const primeiroNome = dadosAtendente.nome.split(' ')[0];
      addMessage(`Olá, ${primeiroNome}! Como posso te ajudar hoje?`, 'bot');
      setInitialTheme();
  }

  // Inicia a aplicação
  initGoogleSignIn();
});
