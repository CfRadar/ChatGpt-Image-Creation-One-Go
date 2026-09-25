// test/simulator.js
// Interactive behavior for ChatGPT UI Simulator

(function () {
  const chatArea = document.getElementById('chatArea');
  const textarea = document.getElementById('prompt-textarea');
  const sendBtn = document.getElementById('sendBtn');
  const stopBtn = document.getElementById('stopBtn');
  const attachBtn = document.getElementById('attachBtn');
  const realFileInput = document.getElementById('realFileInput');
  const attachmentArea = document.getElementById('attachmentArea');
  const simLogs = document.getElementById('simLogs');
  const simStatus = document.getElementById('simStatus');

  let turnCounter = 2;

  function log(msg) {
    const time = new Date().toTimeString().split(' ')[0];
    const line = document.createElement('div');
    line.textContent = `[${time}] ${msg}`;
    simLogs.appendChild(line);
    simLogs.scrollTop = simLogs.scrollHeight;
  }

  // File input simulation
  attachBtn.addEventListener('click', () => {
    realFileInput.click();
  });

  realFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    log(`File selected: ${file.name} (${file.size} bytes)`);

    // Render attachment preview pill
    attachmentArea.innerHTML = `
      <div class="attachment-thumbnail" data-testid="attachment-thumbnail">
        <span>🖼</span>
        <span>${file.name}</span>
        <button type="button" style="background:none; border:none; color:#888; cursor:pointer;" onclick="this.parentElement.remove()">✕</button>
      </div>
    `;
  });

  // Prompt submission simulation
  function submitCurrentPrompt() {
    const text = textarea.value.trim();
    if (!text) return;

    log(`Prompt submitted: "${text.slice(0, 40)}..."`);

    // Create user message
    const userTurn = document.createElement('article');
    userTurn.className = 'conversation-turn turn-user';
    userTurn.setAttribute('data-testid', `conversation-turn-${turnCounter++}`);
    userTurn.setAttribute('data-message-author-role', 'user');
    userTurn.textContent = text;
    chatArea.appendChild(userTurn);

    // Reset composer
    textarea.value = '';
    attachmentArea.innerHTML = '';

    // Switch to streaming state
    startStreaming();
  }

  sendBtn.addEventListener('click', submitCurrentPrompt);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitCurrentPrompt();
    }
  });

  function startStreaming() {
    sendBtn.style.display = 'none';
    stopBtn.style.display = 'flex';
    document.body.classList.add('result-streaming');
    simStatus.textContent = 'Status: Generating...';
    log('Generation started (stop button active, streaming flag set)');
  }

  function stopStreaming() {
    stopBtn.style.display = 'none';
    sendBtn.style.display = 'flex';
    document.body.classList.remove('result-streaming');
    simStatus.textContent = 'Status: Idle';
    log('Generation completed (stop button hidden, send button restored)');
  }

  stopBtn.addEventListener('click', () => {
    log('Generation manually stopped');
    stopStreaming();
  });

  // Simulator helper buttons
  document.getElementById('btnSimulateStartGen').addEventListener('click', () => {
    startStreaming();
  });

  document.getElementById('btnSimulateCompleteGen').addEventListener('click', () => {
    stopStreaming();

    // Create assistant response with mock generated image
    const assistantTurn = document.createElement('article');
    assistantTurn.className = 'conversation-turn turn-assistant';
    assistantTurn.setAttribute('data-testid', `conversation-turn-${turnCounter++}`);
    assistantTurn.setAttribute('data-message-author-role', 'assistant');

    // Create a 1024x1024 mock canvas image
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Draw nice gradient
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#0ea5e9');
    grad.addColorStop(1, '#a855f7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`Generated Image #${turnCounter}`, 40, 260);

    const dataUrl = canvas.toDataURL('image/png');

    assistantTurn.innerHTML = `
      <p>Here is your generated image:</p>
      <img class="generated-image" src="${dataUrl}" alt="Generated Image" width="320" height="320">
    `;

    chatArea.appendChild(assistantTurn);
    chatArea.scrollTop = chatArea.scrollHeight;
    log('Appended generated image to assistant turn');
  });

  document.getElementById('btnSimulateMultipleImgs').addEventListener('click', () => {
    stopStreaming();
    const assistantTurn = document.createElement('article');
    assistantTurn.className = 'conversation-turn turn-assistant';
    assistantTurn.setAttribute('data-testid', `conversation-turn-${turnCounter++}`);
    assistantTurn.setAttribute('data-message-author-role', 'assistant');

    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#10b981'; ctx.fillRect(0, 0, 256, 256);
    const img1 = canvas.toDataURL('image/png');
    ctx.fillStyle = '#f59e0b'; ctx.fillRect(0, 0, 256, 256);
    const img2 = canvas.toDataURL('image/png');

    assistantTurn.innerHTML = `
      <p>Multiple image variants generated:</p>
      <div style="display:flex; gap:10px;">
        <img class="generated-image" src="${img1}" alt="Variant 1" width="180">
        <img class="generated-image" src="${img2}" alt="Variant 2" width="180">
      </div>
    `;
    chatArea.appendChild(assistantTurn);
    chatArea.scrollTop = chatArea.scrollHeight;
    log('Appended 2 image variants');
  });

  document.getElementById('btnSimulateError').addEventListener('click', () => {
    stopStreaming();
    const errTurn = document.createElement('article');
    errTurn.className = 'conversation-turn turn-assistant';
    errTurn.style.borderColor = '#ef4444';
    errTurn.innerHTML = `<p style="color:#f87171;">An error occurred while generating the image. Please try again.</p>`;
    chatArea.appendChild(errTurn);
    log('Simulated error response turn');
  });

  document.getElementById('btnClearChat').addEventListener('click', () => {
    chatArea.innerHTML = `
      <article data-testid="conversation-turn-1" class="conversation-turn turn-assistant" data-message-author-role="assistant">
        <p>Chat cleared. Ready for new prompt.</p>
      </article>
    `;
    log('Chat history cleared');
  });

  log('Simulator environment ready');
})();
