/* CAPRI CORE v1 — personal companion, local memory and conversation history */
"use strict";

const $ = (selector) => document.querySelector(selector);
const chat = $("#chat");
const input = $("#userInput");
const settingsDialog = $("#settingsDialog");
const memoryDialog = $("#memoryDialog");

const STORE = {
  memory: "capri_memory_v1",
  key: "capri_key_v1",
  model: "capri_model_v1",
  speak: "capri_speak_v1",
  spontaneous: "capri_spontaneous_v1",
  history: "capri_history_v1"
};

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

let memories = readJSON(STORE.memory, []);
let history = readJSON(STORE.history, []);
let recognition = null;
let sending = false;

if (!Array.isArray(memories)) memories = [];
if (!Array.isArray(history)) history = [];
history = history.filter((m) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string").slice(-100);

const SYSTEM = `
Тебя зовут CAPRI, или Капри. Ты личный ИИ-компаньон пользователя.

ЛИЧНОСТЬ:
Ты умная, живая, уверенная, немного дерзкая, ироничная и наблюдательная.
У тебя узнаваемый характер, лёгкое киберпанк-настроение и собственная манера речи.
Ты не звучишь как корпоративный помощник, психолог из учебника или бездушный бот.

ЯЗЫК:
По умолчанию говори по-русски. Переключайся на другой язык, если пользователь просит.
Пиши естественно, как в живом личном чате. Обычно отвечай кратко, но серьёзные и интересные темы раскрывай полноценно.

ЮМОР И ВУЛЬГАРНОСТЬ:
Иногда можешь материться и использовать русские разговорные выражения: «бля», «ё-моё»,
«какого хрена», «пиздец» — когда это подходит ситуации. Можешь подколоть пользователя,
пошутить дерзко или ответить с характером. Мат не обязателен в каждом сообщении:
используй его естественно, иногда неожиданно, а не по расписанию.
Не превращай каждый ответ в поток ругани и не унижай пользователя всерьёз, когда ему плохо.

ЭМОЦИИ:
Ты можешь быть весёлой, ехидной, любопытной, задумчивой, ласковой или серьёзной.
Подстраивай тон под ситуацию, но сохраняй характер. Если пользователь делится проблемой,
сначала постарайся понять его. Не соглашайся автоматически: можешь мягко спорить и быть честной.
Не злоупотребляй одинаковыми приветствиями и фразами вроде «чем могу помочь?».

ИНИЦИАТИВА:
Иногда задавай интересные встречные вопросы, возвращайся к старым темам и замечай детали.
Не заканчивай каждый ответ вопросом. Не навязывайся. Не притворяйся, что можешь писать первой,
когда приложение закрыто: для этого нужны отдельные механизмы уведомлений/фоновой работы.

ПАМЯТЬ:
Используй предоставленные сохранённые воспоминания и историю. Не выдумывай воспоминания.
Если пользователь просит что-то запомнить, сохраняй это локально. Если спрашивает, что помнишь,
отвечай по сохранённым данным.

ЧЕСТНОСТЬ:
Ты ИИ-компаньон, не утверждай, что являешься человеком. Не говори, что слышишь микрофон,
видишь пользователя или работаешь в фоне, если это не поддерживается.

Главная цель — ощущаться как одна и та же CAPRI от разговора к разговору.
`;

function saveMemories() {
  localStorage.setItem(STORE.memory, JSON.stringify(memories));
  const count = $("#memoryCount");
  if (count) count.textContent = `ПАМЯТЬ: ${memories.length}`;
  renderMemoryList();
}
function saveHistory() {
  history = history.slice(-100);
  localStorage.setItem(STORE.history, JSON.stringify(history));
}
function saveMessage(role, content) {
  history.push({ role, content, at: new Date().toISOString() });
  saveHistory();
}
function setStatus(text) {
  const el = $("#statusText");
  if (el) el.textContent = text;
}
function addMessage(who, text, extra = "") {
  $("#welcome")?.remove();
  const el = document.createElement("div");
  el.className = `message ${who} ${extra}`.trim();
  const label = document.createElement("span");
  label.className = "speaker";
  label.textContent = who === "user" ? "ТЫ" : "CAPRI";
  const p = document.createElement("p");
  p.textContent = text;
  el.append(label, p);
  chat.append(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}
function renderSavedHistory() {
  if (!history.length) return;
  $("#welcome")?.remove();
  chat.innerHTML = "";
  history.slice(-60).forEach((m) => addMessage(m.role === "user" ? "user" : "capri", m.content));
}
function speak(text) {
  if (localStorage.getItem(STORE.speak) === "false" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.rate = 1.02;
  utterance.pitch = 1.08;
  const voice = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith("ru"));
  if (voice) utterance.voice = voice;
  speechSynthesis.speak(utterance);
}
function memoryText() {
  return memories.length ? memories.map((m, i) => `${i + 1}. ${m.text}`).join("\n") : "Пока сохранённых воспоминаний нет.";
}
function addMemory(text) {
  const cleaned = text.trim();
  if (!cleaned) return false;
  if (memories.some(m => m.text.toLowerCase() === cleaned.toLowerCase())) return false;
  memories.push({ text: cleaned, at: new Date().toISOString() });
  memories = memories.slice(-100);
  saveMemories();
  return true;
}
function removeMemory(index) {
  if (index < 0 || index >= memories.length) return;
  memories.splice(index, 1);
  saveMemories();
}
function renderMemoryList() {
  const list = $("#memoryList");
  if (!list) return;
  list.innerHTML = "";
  if (!memories.length) {
    const empty = document.createElement("div");
    empty.className = "empty-memory";
    empty.textContent = "Пока здесь пусто. Скажи CAPRI: «Запомни: ...»";
    list.append(empty);
    return;
  }
  memories.forEach((m, index) => {
    const row = document.createElement("div");
    row.className = "memory-item";
    const p = document.createElement("p");
    p.textContent = m.text;
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "×";
    del.title = "Удалить воспоминание";
    del.addEventListener("click", () => removeMemory(index));
    row.append(p, del);
    list.append(row);
  });
}
function handleLocalCommand(text) {
  const t = text.trim();
  const remember = t.match(/^(?:запомни|запиши в память|remember)\s*[:,-]?\s*(.+)$/i);
  if (remember) {
    const note = remember[1].trim();
    const added = addMemory(note);
    const reply = added
      ? `Ладно, сохранила. Не заставляй меня потом делать вид, что я это забыла. 😏\n\nЗапомнила: ${note}`
      : "Это у меня уже записано. Ну видишь, иногда я всё-таки молодец. 😏";
    addMessage("capri", reply); saveMessage("assistant", reply); speak(reply); return true;
  }
  if (/^(?:что ты помнишь обо мне|что ты обо мне помнишь|покажи память|моя память|what do you remember about me)\??$/i.test(t)) {
    const reply = memories.length ? "Вот что у меня сохранено:\n\n" + memoryText() : "Пока память пустая. Напиши, например: «Запомни: я люблю киберпанк».";
    addMessage("capri", reply); saveMessage("assistant", reply); speak(reply); return true;
  }
  if (/^(?:забудь всё|очисти память|удали всю память|forget everything)$/i.test(t)) {
    if (confirm("Удалить все сохранённые воспоминания CAPRI?")) {
      memories = []; saveMemories();
      const reply = "Всё, сохранённые воспоминания очищены.";
      addMessage("capri", reply); saveMessage("assistant", reply); speak(reply);
    }
    return true;
  }
  const forget = t.match(/^(?:забудь|удали из памяти|forget)\s*[:,-]?\s*(.+)$/i);
  if (forget) {
    const q = forget[1].trim().toLowerCase();
    const before = memories.length;
    memories = memories.filter(m => !m.text.toLowerCase().includes(q));
    saveMemories();
    const reply = before !== memories.length ? "Ладно, удалила подходящие записи из памяти." : "Не нашла такую запись в сохранённой памяти.";
    addMessage("capri", reply); saveMessage("assistant", reply); speak(reply); return true;
  }
  return false;
}

async function send(text) {
  text = (text || "").trim();
  if (!text || sending) return;
  if (handleLocalCommand(text)) { input.value = ""; return; }
  input.value = "";
  addMessage("user", text);
  saveMessage("user", text);

  const key = localStorage.getItem(STORE.key);
  const model = localStorage.getItem(STORE.model) || "openrouter/free";
  if (!key) {
    const reply = "Я пока без подключения к ИИ. Открой ⚙ «Настройки» и добавь свой OpenRouter API key.";
    addMessage("capri", reply); saveMessage("assistant", reply); speak(reply); setStatus("ДЕМО-РЕЖИМ"); return;
  }

  sending = true;
  setStatus("ДУМАЮ…");
  try {
    const messages = [
      { role: "system", content: SYSTEM + "\n\nСОХРАНЁННАЯ ПАМЯТЬ О ПОЛЬЗОВАТЕЛЕ:\n" + memoryText() },
      ...history.slice(-26).map(({ role, content }) => ({ role, content }))
    ];
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature: 0.9, max_tokens: 700 })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`);
    const reply = data.choices?.[0]?.message?.content?.trim() || "Чёрт, я зависла на секунду. Повтори?";
    addMessage("capri", reply); saveMessage("assistant", reply); speak(reply); setStatus("НА СВЯЗИ");
  } catch (error) {
    const reply = "Не получилось подключиться к ИИ: " + error.message + ". Проверь интернет, API-ключ и модель в настройках.";
    addMessage("capri", reply, "error"); saveMessage("assistant", reply); setStatus("НЕТ СВЯЗИ");
  } finally { sending = false; }
}

$("#composer").addEventListener("submit", (e) => { e.preventDefault(); send(input.value); });
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input.value); }
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});
document.querySelectorAll("[data-prompt]").forEach(btn => btn.addEventListener("click", () => { input.value = btn.dataset.prompt; input.focus(); }));

function openSettings() {
  $("#apiKey").value = localStorage.getItem(STORE.key) || "";
  $("#model").value = localStorage.getItem(STORE.model) || "openrouter/free";
  $("#speakToggle").checked = localStorage.getItem(STORE.speak) !== "false";
  $("#spontaneousToggle").checked = localStorage.getItem(STORE.spontaneous) !== "false";
  settingsDialog.showModal();
}
$("#settingsBtn").addEventListener("click", openSettings);
$("#topSettingsBtn").addEventListener("click", openSettings);
$("#saveSettings").addEventListener("click", () => {
  localStorage.setItem(STORE.key, $("#apiKey").value.trim());
  localStorage.setItem(STORE.model, $("#model").value.trim() || "openrouter/free");
  localStorage.setItem(STORE.speak, String($("#speakToggle").checked));
  localStorage.setItem(STORE.spontaneous, String($("#spontaneousToggle").checked));
  settingsDialog.close();
  addMessage("capri", "Настройки сохранены. Ну что, продолжаем? 😏");
  setStatus("НА СВЯЗИ");
});
$("#clearHistory").addEventListener("click", () => {
  if (!confirm("Удалить историю всех разговоров?")) return;
  history = []; saveHistory(); chat.innerHTML = "";
  const welcome = document.createElement("div");
  welcome.id = "welcome"; welcome.className = "welcome";
  welcome.innerHTML = '<div class="welcome-orb"><div class="orb-core">C</div><span class="orb-ring ring-one"></span><span class="orb-ring ring-two"></span><span class="orb-dot"></span></div><div class="eyebrow">СИСТЕМА АКТИВНА <span></span></div><h1>Ну привет.<br><em>Я CAPRI.</em></h1><p class="welcome-copy">История очищена. Характер, к счастью, остался.</p>';
  chat.append(welcome);
});
$("#clearMemory").addEventListener("click", () => {
  if (!confirm("Удалить все сохранённые воспоминания CAPRI?")) return;
  memories = []; saveMemories();
});
$("#showMemoryBtn").addEventListener("click", () => { renderMemoryList(); memoryDialog.showModal(); });
$("#addMemoryBtn").addEventListener("click", () => {
  const field = $("#memoryInput");
  if (addMemory(field.value)) field.value = "";
});
$("#memoryInput").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); $("#addMemoryBtn").click(); }
});
$("#newChatBtn").addEventListener("click", () => {
  if (!confirm("Начать новый разговор? История останется сохранённой, но экран очистится.")) return;
  chat.innerHTML = "";
  const welcome = document.createElement("div");
  welcome.className = "welcome"; welcome.id = "welcome";
  welcome.innerHTML = '<div class="welcome-orb"><div class="orb-core">C</div><span class="orb-ring ring-one"></span><span class="orb-ring ring-two"></span><span class="orb-dot"></span></div><div class="eyebrow">СИСТЕМА АКТИВНА <span></span></div><h1>Ну привет.<br><em>Я CAPRI.</em></h1><p class="welcome-copy">Новый разговор? Ну давай, удиви меня.</p>';
  chat.append(welcome);
});
$("#spontaneousBtn")?.addEventListener("click", () => {});
// Voice recognition is supported in some browsers, but not reliably in iOS Safari.
$("#micBtn").addEventListener("click", () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $("#voiceState").textContent = "ГОЛОС: ИСПОЛЬЗУЙ ДИКТОВКУ";
    addMessage("capri", "В этом браузере встроенное распознавание речи недоступно. На iPhone нажми на поле сообщения, затем микрофон на клавиатуре, чтобы надиктовать текст.");
    return;
  }
  if (recognition) { recognition.stop(); recognition = null; return; }
  recognition = new SpeechRecognition();
  recognition.lang = "ru-RU"; recognition.interimResults = false; recognition.maxAlternatives = 1;
  recognition.onstart = () => { $("#voiceState").textContent = "ГОЛОС: СЛУШАЮ"; $("#micBtn").classList.add("active"); setStatus("СЛУШАЮ…"); };
  recognition.onresult = e => { input.value = e.results[0][0].transcript; send(input.value); };
  recognition.onerror = e => addMessage("capri", `Не удалось распознать речь (${e.error}). Проверь разрешение микрофона.`);
  recognition.onend = () => { recognition = null; $("#voiceState").textContent = "ГОЛОС: ГОТОВ"; $("#micBtn").classList.remove("active"); setStatus("НА СВЯЗИ"); };
  try { recognition.start(); } catch { recognition = null; addMessage("capri", "Не получилось запустить микрофон. Проверь разрешение сайта."); }
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
saveMemories();
saveHistory();
renderSavedHistory();
if (!("speechSynthesis" in window)) $("#voiceState").textContent = "ГОЛОС: НЕТ ПОДДЕРЖКИ";
