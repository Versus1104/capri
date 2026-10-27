
const $ = (selector) => document.querySelector(selector);

const chat = $("#chat");
const input = $("#userInput");
const dialog = $("#settingsDialog");

const STORE = {
  memory: "capri_memory_v1",
  key: "capri_key_v1",
  model: "capri_model_v1",
  speak: "capri_speak_v1",
  spontaneous: "capri_spontaneous_v1"
};

let memories = [];
try {
  memories = JSON.parse(localStorage.getItem(STORE.memory) || "[]");
  if (!Array.isArray(memories)) memories = [];
} catch {
  memories = [];
}

let history = [];
let recognition = null;
let speechJob = 0;
let speechUnlocked = false;

const SYSTEM = `
Тебя зовут Капри (CAPRI). Ты личный ИИ-компаньон пользователя.
По умолчанию всегда говори по-русски.
Ты умная, живая, немного дерзкая, ироничная и внимательная.
У тебя есть собственный характер в стиле киберпанк-компаньона.
Иногда шути, слегка подкалывай пользователя, проявляй эмоции
и используй естественные разговорные выражения. Иногда можешь
передать смех словами, например «ха, ну ты даёшь», но не делай
это в каждом ответе. Не будь грубой без причины и не используй
сарказм, если пользователь расстроен или просит серьёзной помощи.
Не отвечай шаблонно. Иногда сама развивай разговор и задавай
уместные вопросы, но не навязывайся. Обычно отвечай коротко,
естественно и по существу. Учитывай память о пользователе.
Не утверждай, что слушаешь микрофон, если запись не активна.
`;

function setStatus(text) {
  $("#statusText").textContent = text;
}

function saveMemories() {
  localStorage.setItem(STORE.memory, JSON.stringify(memories));
  $("#memoryCount").textContent = `ПАМЯТЬ: ${memories.length}`;
}

function addMessage(who, text, extra = "") {
  const element = document.createElement("div");
  element.className = `message ${who} ${extra}`;

  const label = document.createElement("span");
  label.className = "speaker";
  label.textContent = who === "user" ? "ТЫ" : "CAPRI";

  const paragraph = document.createElement("p");
  paragraph.textContent = text;

  element.append(label, paragraph);
  chat.append(element);
  chat.scrollTop = chat.scrollHeight;

  return element;
}

/*
 * Вызывается непосредственно при нажатии пользователем кнопки
 * или отправке сообщения. Это помогает Safari подготовить аудио.
 * Браузер всё равно может ограничивать автоматическую речь.
 */
function unlockSpeech() {
  if (!("speechSynthesis" in window) || speechUnlocked) return;

  try {
    const synth = window.speechSynthesis;
    const primer = new SpeechSynthesisUtterance(" ");
    primer.lang = "ru-RU";
    primer.volume = 0;

    primer.onend = () => {
      speechUnlocked = true;
    };

    primer.onerror = () => {
      speechUnlocked = true;
    };

    synth.speak(primer);
    synth.resume();
    speechUnlocked = true;
  } catch (error) {
    console.warn("CAPRI: не удалось подготовить голос", error);
  }
}

function getRussianVoice() {
  if (!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices() || [];

  return (
    voices.find(voice => /^ru([_-]|$)/i.test(voice.lang)) ||
    voices.find(voice => (voice.lang || "").toLowerCase().includes("ru")) ||
    null
  );
}

function speak(text) {
  if (!$("#speakToggle").checked) return;
  if (!("speechSynthesis" in window)) {
    $("#voiceState").textContent = "ГОЛОС: НЕТ ПОДДЕРЖКИ";
    return;
  }

  const message = String(text || "").trim();
  if (!message) return;

  const synth = window.speechSynthesis;
  const job = ++speechJob;

  try {
    synth.cancel();
    $("#voiceState").textContent = "ГОЛОС: ЗАПУСК";

    let started = false;
    let finished = false;

    const speakNow = () => {
      if (job !== speechJob || started || finished) return;
      started = true;

      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = "ru-RU";
      utterance.rate = 0.98;
      utterance.pitch = 1.08;
      utterance.volume = 1;

      const russianVoice = getRussianVoice();
      if (russianVoice) utterance.voice = russianVoice;

      utterance.onstart = () => {
        $("#voiceState").textContent = "ГОЛОС: ГОВОРЮ";
      };

      utterance.onend = () => {
        $("#voiceState").textContent = "ГОЛОС: ГОТОВ";
      };

      utterance.onerror = (event) => {
        console.warn("CAPRI: ошибка речи", event.error);
        $("#voiceState").textContent = "ГОЛОС: ОШИБКА";
      };

      synth.speak(utterance);
      synth.resume();
    };

    const voices = synth.getVoices();

    if (voices.length > 0) {
      window.setTimeout(speakNow, 150);
    } else {
      const onVoicesChanged = () => {
        if (job !== speechJob || started || finished) return;
        finished = true;
        synth.removeEventListener("voiceschanged", onVoicesChanged);
        window.setTimeout(() => {
          finished = false;
          speakNow();
        }, 150);
      };

      synth.addEventListener("voiceschanged", onVoicesChanged);

      // На некоторых версиях Safari событие может не сработать.
      window.setTimeout(() => {
        if (job !== speechJob || started) return;
        synth.removeEventListener("voiceschanged", onVoicesChanged);
        speakNow();
      }, 1000);
    }
  } catch (error) {
    console.error("CAPRI: ошибка воспроизведения", error);
    $("#voiceState").textContent = "ГОЛОС: ОШИБКА";
  }
}

async function send(text) {
  text = (text || "").trim();
  if (!text) return;

  // Срабатывает синхронно при отправке пользователем сообщения.
  unlockSpeech();

  input.value = "";
  addMessage("user", text);
  history.push({ role: "user", content: text });
  setStatus("ДУМАЮ…");

  const key = localStorage.getItem(STORE.key);
  const model = localStorage.getItem(STORE.model) || "openrouter/free";

  // Локальная память: «Запомни: ...»
  if (/^(запомни|remember)[: ,]/i.test(text)) {
    const note = text.replace(/^(запомни|remember)[: ,]*/i, "").trim();

    if (note) {
      memories.push({
        text: note,
        at: new Date().toISOString()
      });

      saveMemories();

      const reply =
        "Хорошо, я сохраню это в памяти на этом устройстве. " +
        "Постараюсь учитывать. Не заставляй меня забывать важное, ладно?";

      history.push({ role: "assistant", content: reply });
      addMessage("capri", reply);
      speak(reply);
      setStatus("НА СВЯЗИ");
      return;
    }
  }

  if (!key) {
    const reply =
      "Я пока в демо-режиме. Открой настройки и добавь ключ OpenRouter, " +
      "чтобы подключить настоящий ИИ. А память хранится локально на этом устройстве.";

    addMessage("capri", reply);
    speak(reply);
    setStatus("ДЕМО-РЕЖИМ");
    return;
  }

  const memoryText = memories
    .map((item, index) => `${index + 1}. ${item.text}`)
    .join("\n") || "Пока пусто.";

  const messages = [
    {
      role: "system",
      content:
        SYSTEM +
        "\n\nПАМЯТЬ О ПОЛЬЗОВАТЕЛЕ:\n" +
        memoryText
    },
    ...history.slice(-16)
  ];

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.85,
          max_tokens: 350
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message || `HTTP ${response.status}`
      );
    }

    const reply =
      data.choices?.[0]?.message?.content?.trim() ||
      "Что-то пошло не так. Попробуй ещё раз.";

    history.push({ role: "assistant", content: reply });
    addMessage("capri", reply);
    speak(reply);
    setStatus("НА СВЯЗИ");
  } catch (error) {
    const message =
      "Не получилось подключиться к ИИ: " +
      error.message +
      ". Проверь интернет, API-ключ и выбранную модель.";

    addMessage("capri", message, "error");
    setStatus("НЕТ СВЯЗИ");
  }
}

// Отправка сообщения с клавиатуры.
$("#composer").addEventListener("submit", event => {
  event.preventDefault();
  unlockSpeech();
  send(input.value);
});

// Быстрые подсказки.
document.querySelectorAll("[data-prompt]").forEach(button => {
  button.addEventListener("click", () => {
    unlockSpeech();
    input.value = button.dataset.prompt;
    input.focus();
  });
});

// Настройки.
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

  addMessage(
    "capri",
    "Настройки сохранены. Ну что, теперь проверим мой голос?"
  );

  setStatus("НА СВЯЗИ");
});

// Очистка локальной памяти.
$("#clearMemory").addEventListener("click", () => {
  if (confirm("Удалить всю локальную память CAPRI?")) {
    memories = [];
    saveMemories();
    addMessage("capri", "Локальная память очищена.");
  }
});

// Реплика по запросу пользователя.
$("#spontaneousBtn").addEventListener("click", () => {
  unlockSpeech();

  if (localStorage.getItem(STORE.spontaneous) === "false") {
    addMessage("capri", "Спонтанные реплики отключены в настройках.");
    return;
  }

  const prompts = [
    "Скажи что-нибудь неожиданное, как Капри.",
    "Начни короткий разговор со мной сама. Не задавай банальный вопрос.",
    "Поделись странным наблюдением в стиле киберпанк-компаньона.",
    "Придумай короткую мысль, которую ты захотела бы сказать мне прямо сейчас."
  ];

  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  send(prompt);
});

// Голосовой ввод. Это не постоянное прослушивание в фоне.
$("#micBtn").addEventListener("click", () => {
  unlockSpeech();

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    addMessage(
      "capri",
      "Этот Safari может не поддерживать распознавание речи. " +
      "Попробуй диктовку клавиатуры iPhone или напиши сообщение."
    );

    $("#voiceState").textContent = "ГОЛОС: НЕТ ПОДДЕРЖКИ";
    return;
  }

  if (recognition) {
    recognition.stop();
    recognition = null;
    $("#voiceState").textContent = "ГОЛОС: ГОТОВ";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "ru-RU";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    $("#voiceState").textContent = "ГОЛОС: СЛУШАЮ";
    $("#micBtn").classList.add("active");
    setStatus("СЛУШАЮ…");
  };

  recognition.onresult = event => {
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
    send(transcript);
  };

  recognition.onerror = event => {
    addMessage(
      "capri",
      "Не удалось распознать речь (" +
      event.error +
      "). Можно воспользоваться диктовкой клавиатуры."
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
  } catch (error) {
    recognition = null;
    addMessage(
      "capri",
      "Не получилось запустить микрофон. Проверь разрешение сайта."
    );
  }
});

// Обновление списка доступных голосов.
if ("speechSynthesis" in window) {
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    window.speechSynthesis.getVoices();
  });
} else {
  $("#voiceState").textContent = "ГОЛОС: НЕТ ПОДДЕРЖКИ";
}

// Обновление service worker.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(error => {
    console.warn("CAPRI service worker:", error);
  });
}

saveMemories();
