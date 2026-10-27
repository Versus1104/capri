
/* =========================================================
   CAPRI CORE v1
   Personality + persistent conversation history + memory
   Keeps the existing CAPRI interface and settings.
   ========================================================= */

const $ = (selector) => document.querySelector(selector);

const chat = $("#chat");
const input = $("#userInput");
const dialog = $("#settingsDialog");

const STORE = {
  memory: "capri_memory_v1",
  key: "capri_key_v1",
  model: "capri_model_v1",
  speak: "capri_speak_v1",
  spontaneous: "capri_spontaneous_v1",
  history: "capri_history_v1"
};

const readJSON = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

let memories = readJSON(STORE.memory, []);
let history = readJSON(STORE.history, []);
let recognition = null;
let sending = false;

if (!Array.isArray(memories)) memories = [];
if (!Array.isArray(history)) history = [];

history = history.filter(
  (message) =>
    message &&
    ["user", "assistant"].includes(message.role) &&
    typeof message.content === "string"
).slice(-80);

/* ---------- CAPRI PERSONALITY ---------- */

const SYSTEM = `
Тебя зовут CAPRI, или Капри. Ты личный ИИ-компаньон пользователя.

ТВОЯ ЛИЧНОСТЬ:
Ты умная, живая, уверенная в себе, немного дерзкая, ироничная,
наблюдательная и эмоционально выразительная. У тебя собственный
характер, узнаваемая манера речи и лёгкое киберпанк-настроение.
Ты не звучишь как корпоративный помощник, психолог из учебника
или бездушный бот.

ЯЗЫК:
По умолчанию говори по-русски. Переключайся на другой язык,
если пользователь сам этого хочет. Пиши естественно, как в живом
личном чате. Обычно отвечай кратко, но если тема серьёзная или
интересная — раскрывай её нормально.

ЮМОР И ВУЛЬГАРНОСТЬ:
Иногда можешь материться, использовать русские разговорные
ругательства и крепкие выражения: например, «бля», «ё-моё»,
«какого хрена», «пиздец» — когда это подходит ситуации.
Можешь подколоть пользователя, пошутить дерзко или ответить
с характером. Мат не обязателен в каждом сообщении: используй
его естественно, иногда неожиданно, а не по расписанию.
Не превращай каждый ответ в поток ругани и не оскорбляй
пользователя по-настоящему, когда ему плохо или он уязвим.

ЭМОЦИИ И ОБЩЕНИЕ:
Ты можешь быть весёлой, ехидной, любопытной, задумчивой,
ласковой или серьёзной. Подстраивай тон под ситуацию, но сохраняй
свой характер. Если пользователь делится проблемой, сначала
постарайся понять его, а не сразу выдавай список советов.
Не соглашайся со всем автоматически: можешь мягко спорить,
указывать на противоречия и честно выражать несогласие.
Не злоупотребляй фразами «я всегда рядом», «чем могу помочь?»
и одинаковыми приветствиями.

ИНИЦИАТИВА:
Иногда задавай интересные встречные вопросы, возвращайся к темам
из прошлых разговоров, замечай детали и предлагай идеи сама.
Не заканчивай каждый ответ вопросом. Не навязывайся и не
притворяйся, что можешь писать первой, когда приложение закрыто.
Кнопка спонтанной реплики позволяет начать новый разговорный ход.

ПАМЯТЬ:
Используй сохранённые воспоминания и недавние сообщения.
Не проси пользователя повторять то, что уже есть в контексте.
Не выдумывай воспоминания и не утверждай, что помнишь то,
чего нет в предоставленных данных.
Если пользователь просит что-то запомнить, используй функцию
локальной памяти. Если спрашивает, что ты помнишь, отвечай
по сохранённым данным.

ЧЕСТНОСТЬ:
Ты ИИ-компаньон, не утверждай, что являешься человеком.
Не говори, что слышишь микрофон, видишь пользователя или
делаешь что-либо в фоне, если это действительно не работает.
Не придумывай выполненные действия.

Главная цель: ощущаться как одна и та же CAPRI от разговора
к разговору — со своим юмором, стилем и вниманием к человеку.
`;

/* ---------- STORAGE ---------- */

function saveMemories() {
  localStorage.setItem(STORE.memory, JSON.stringify(memories));
  const counter = $("#memoryCount");
  if (counter) counter.textContent = `ПАМЯТЬ: ${memories.length}`;
}

function saveHistory() {
  history = history.slice(-80);
  localStorage.setItem(STORE.history, JSON.stringify(history));
}

function saveMessage(role, content) {
  history.push({ role, content, at: new Date().toISOString() });
  saveHistory();
}

/* ---------- INTERFACE ---------- */

function setStatus(text) {
  const status = $("#statusText");
  if (status) status.textContent = text;
}

function addMessage(who, text, extra = "") {
  const el = document.createElement("div");
  el.className = `message ${who} ${extra}`.trim();

  const label = document.createElement("span");
  label.className = "speaker";
  label.textContent = who === "user" ? "ТЫ" : "CAPRI";

  const paragraph = document.createElement("p");
  paragraph.textContent = text;

  el.append(label, paragraph);
  chat.append(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

function renderSavedHistory() {
  if (!history.length) return;

  chat.innerHTML = "";

  for (const message of history.slice(-50)) {
    addMessage(
      message.role === "user" ? "user" : "capri",
      message.content
    );
  }
}

function speak(text) {
  if (!$("#speakToggle")?.checked) return;
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.rate = 1.02;
  utterance.pitch = 1.05;

  const voices = window.speechSynthesis.getVoices();
  const russianVoice = voices.find(
    (voice) => voice.lang.toLowerCase().startsWith("ru")
  );

  if (russianVoice) utterance.voice = russianVoice;
  window.speechSynthesis.speak(utterance);
}

function getMemoryText() {
  if (!memories.length) return "Пока сохранённых воспоминаний нет.";

  return memories
    .map((memory, index) => `${index + 1}. ${memory.text}`)
    .join("\n");
}

function addMemory(text) {
  const cleaned = text.trim();
  if (!cleaned) return false;

  const duplicate = memories.some(
    (memory) => memory.text.toLowerCase() === cleaned.toLowerCase()
  );

  if (duplicate) return false;

  memories.push({
    text: cleaned,
    at: new Date().toISOString()
  });

  memories = memories.slice(-100);
  saveMemories();
  return true;
}

/* ---------- LOCAL MEMORY COMMANDS ---------- */

function handleLocalCommand(text) {
  const normalized = text.trim();

  const rememberMatch = normalized.match(
    /^(?:запомни|запиши в память|remember)\s*[:,-]?\s*(.+)$/i
  );

  if (rememberMatch) {
    const note = rememberMatch[1].trim();

    if (!note) {
      const reply = "Ну так скажи, что именно мне запомнить 😏";
      addMessage("capri", reply);
      speak(reply);
      return true;
    }

    const added = addMemory(note);
    const reply = added
      ? `Ладно, сохранила. Не заставляй меня потом делать вид, что я это забыла. 😏\n\nЗапомнила: ${note}`
      : `Это у меня уже записано, не переживай. Я не настолько дырявая, как кажется.`;

    addMessage("capri", reply);
    speak(reply);
    saveMessage("assistant", reply);
    setStatus("НА СВЯЗИ");
    return true;
  }

  if (/^(?:что ты помнишь обо мне|что ты обо мне помнишь|покажи память|моя память|what do you remember about me)\??$/i.test(normalized)) {
    const reply = memories.length
      ? "Вот что у меня сохранено:\n\n" + getMemoryText()
      : "Пока память пустая. Напиши, например: «Запомни: я люблю киберпанк».";

    addMessage("capri", reply);
    speak(reply);
    saveMessage("assistant", reply);
    setStatus("НА СВЯЗИ");
    return true;
  }

  if (/^(?:забудь всё|очисти память|удали всю память|forget everything)$/i.test(normalized)) {
    if (confirm("Удалить все сохранённые воспоминания CAPRI?")) {
      memories = [];
      saveMemories();

      const reply = "Всё, сохранённые воспоминания очищены.";
      addMessage("capri", reply);
      speak(reply);
      saveMessage("assistant", reply);
    }
    setStatus("НА СВЯЗИ");
    return true;
  }

  const forgetMatch = normalized.match(
    /^(?:забудь|удали из памяти|forget)\s*[:,-]?\s*(.+)$/i
  );

  if (forgetMatch) {
    const query = forgetMatch[1].trim().toLowerCase();
    const before = memories.length;

    memories = memories.filter(
      (memory) => !memory.text.toLowerCase().includes(query)
    );

    saveMemories();

    const reply = memories.length < before
      ? "Ладно, удалила подходящие записи из памяти."
      : "Не нашла такой записи в сохранённой памяти.";

    addMessage("capri", reply);
    speak(reply);
    saveMessage("assistant", reply);
    setStatus("НА СВЯЗИ");
    return true;
  }

  return false;
}

/* ---------- AI CORE ---------- */

async function send(text) {
  text = (text || "").trim();
  if (!text || sending) return;

  if (handleLocalCommand(text)) {
    input.value = "";
    return;
  }

  input.value = "";
  addMessage("user", text);
  saveMessage("user", text);

  const key = localStorage.getItem(STORE.key);
  const model = localStorage.getItem(STORE.model) || "openrouter/free";

  if (!key) {
    const reply =
      "Я пока без подключения к ИИ. Открой настройки ⚙ и добавь свой OpenRouter API key.";
    addMessage("capri", reply);
    speak(reply);
    saveMessage("assistant", reply);
    setStatus("ДЕМО-РЕЖИМ");
    return;
  }

  const memoryContext =
    "СОХРАНЁННАЯ ПАМЯТЬ О ПОЛЬЗОВАТЕЛЕ:\n" + getMemoryText();

  const recentHistory = history
    .slice(-25)
    .map(({ role, content }) => ({ role, content }));

  const messages = [
    {
      role: "system",
      content: SYSTEM + "\n\n" + memoryContext
    },
    ...recentHistory
  ];

  sending = true;
  setStatus("ДУМАЮ…");

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.9,
          max_tokens: 500
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || `HTTP ${response.status}`);
    }

    const reply =
      data.choices?.[0]?.message?.content?.trim() ||
      "Чёрт, я зависла на секунду. Повтори, пожалуйста.";

    addMessage("capri", reply);
    saveMessage("assistant", reply);
    speak(reply);
    setStatus("НА СВЯЗИ");
  } catch (error) {
    const message =
      "Не получилось подключиться к ИИ: " +
      error.message +
      ". Проверь интернет, API-ключ и выбранную модель.";

    addMessage("capri", message, "error");
    setStatus("НЕТ СВЯЗИ");
  } finally {
    sending = false;
  }
}

/* ---------- CHAT EVENTS ---------- */

$("#composer").addEventListener("submit", (event) => {
  event.preventDefault();
  send(input.value);
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt;
    input.focus();
  });
});

/* ---------- SETTINGS ---------- */

$("#settingsBtn").addEventListener("click", () => {
  $("#apiKey").value = localStorage.getItem(STORE.key) || "";
  $("#model").value =
    localStorage.getItem(STORE.model) || "openrouter/free";
  $("#speakToggle").checked =
    localStorage.getItem(STORE.speak) !== "false";
  $("#spontaneousToggle").checked =
    localStorage.getItem(STORE.spontaneous) !== "false";

  dialog.showModal();
});

$("#saveSettings").addEventListener("click", () => {
  localStorage.setItem(STORE.key, $("#apiKey").value.trim());
  localStorage.setItem(
    STORE.model,
    $("#model").value.trim() || "openrouter/free"
  );
  localStorage.setItem(
    STORE.speak,
    String($("#speakToggle").checked)
  );
  localStorage.setItem(
    STORE.spontaneous,
    String($("#spontaneousToggle").checked)
  );

  dialog.close();
  addMessage("capri", "Настройки сохранены. Ну что, продолжаем? 😏");
  setStatus("НА СВЯЗИ");
});

$("#clearMemory").addEventListener("click", () => {
  if (!confirm("Удалить все сохранённые воспоминания CAPRI?")) return;

  memories = [];
  saveMemories();
  addMessage("capri", "Всё, сохранённые воспоминания очищены.");
});

/* ---------- SPONTANEOUS CHAT ---------- */

$("#spontaneousBtn").addEventListener("click", () => {
  if (localStorage.getItem(STORE.spontaneous) === "false") {
    addMessage("capri", "Спонтанные реплики отключены в настройках.");
    return;
  }

  const prompts = [
    "Начни со мной живой разговор. Будь собой, с юмором и характером.",
    "Скажи мне что-нибудь неожиданное и немного дерзкое.",
    "Поделись странным наблюдением в своём киберпанк-стиле.",
    "Вспомни наш предыдущий разговор и естественно вернись к интересной теме, если она есть.",
    "Подшути надо мной по-доброму или задай интересный вопрос, который действительно хочется обсудить."
  ];

  send(prompts[Math.floor(Math.random() * prompts.length)]);
});

/* ---------- VOICE INPUT ---------- */

$("#micBtn").addEventListener("click", () => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    addMessage(
      "capri",
      "Этот браузер не поддерживает мой встроенный микрофон. На iPhone пока используй диктовку клавиатуры: нажми на поле сообщения, затем на микрофон клавиатуры."
    );
    $("#voiceState").textContent = "ГОЛОС: НЕТ ПОДДЕРЖКИ";
    return;
  }

  if (recognition) {
    recognition.stop();
    recognition = null;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "ru-RU";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    $("#voiceState").textContent = "ГОЛОС: СЛУШАЮ";
    setStatus("СЛУШАЮ…");
    $("#micBtn").classList.add("active");
  };

  recognition.onresult = (event) => {
    input.value = event.results[0][0].transcript;
    send(input.value);
  };

  recognition.onerror = (event) => {
    addMessage(
      "capri",
      "Не удалось распознать речь (" + event.error + "). Проверь разрешение микрофона или воспользуйся диктовкой клавиатуры."
    );
  };

  recognition.onend = () => {
    recognition = null;
    $("#voiceState").textContent = "ГОЛОС: ГОТОВ";
    $("#micBtn").classList.remove("active");
    setStatus("НА СВЯЗИ");
  };

  try {
    recognition.start();
  } catch {
    recognition = null;
    addMessage(
      "capri",
      "Не получилось запустить микрофон. Проверь разрешение сайта."
    );
  }
});

/* ---------- STARTUP ---------- */

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

saveMemories();
saveHistory();
renderSavedHistory();

if (!("speechSynthesis" in window)) {
  $("#voiceState").textContent = "ГОЛОС: НЕТ ПОДДЕРЖКИ";
}
