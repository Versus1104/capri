const $ = (s) => document.querySelector(s);
const chat = $("#chat"), input = $("#userInput"), dialog = $("#settingsDialog");
const STORE = {memory:"capri_memory_v1", key:"capri_key_v1", model:"capri_model_v1", speak:"capri_speak_v1", spontaneous:"capri_spontaneous_v1"};
let memories = JSON.parse(localStorage.getItem(STORE.memory) || "[]");
let history = [];
let recognition = null;
const SYSTEM = `Тебя зовут Капри (CAPRI). Ты личный ИИ-компаньон пользователя. Всегда говори по-русски, если пользователь сам не попросил другой язык. Личность: умная, живая, немного дерзкая, ироничная, внимательная, с мягким киберпанк-настроением; не говори шаблонно и не притворяйся человеком. Иногда задавай встречные вопросы, замечай детали и проявляй инициативу, но не навязывайся. Отвечай естественно и обычно кратко. Учитывай предоставленную память. Не утверждай, что слушаешь микрофон, если запись не активна.`;
function saveMemories(){localStorage.setItem(STORE.memory,JSON.stringify(memories));$("#memoryCount").textContent=`ПАМЯТЬ: ${memories.length}`;}
function addMessage(who,text,extra=""){const el=document.createElement("div");el.className=`message ${who} ${extra}`;const label=document.createElement("span");label.className="speaker";label.textContent=who==="user"?"ТЫ":"CAPRI";const p=document.createElement("p");p.textContent=text;el.append(label,p);chat.append(el);chat.scrollTop=chat.scrollHeight;return el;}
function speak(text){if(!$("#speakToggle").checked||!("speechSynthesis" in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="ru-RU";u.rate=1.02;u.pitch=1.05;const voices=window.speechSynthesis.getVoices();const v=voices.find(x=>x.lang.toLowerCase().startsWith("ru"));if(v)u.voice=v;window.speechSynthesis.speak(u);}
function setStatus(text){$("#statusText").textContent=text;}
async function send(text){
 text=(text||"").trim();if(!text)return;
 input.value="";addMessage("user",text);history.push({role:"user",content:text});setStatus("ДУМАЮ…");
 const key=localStorage.getItem(STORE.key);const model=localStorage.getItem(STORE.model)||"openrouter/free";
 if(/^запомни[: ,]/i.test(text)||/^remember[: ,]/i.test(text)){
   const note=text.replace(/^(запомни|remember)[: ,]*/i,"").trim();
   if(note){memories.push({text:note,at:new Date().toISOString()});saveMemories();const reply="Хорошо, я сохраню это в памяти на этом устройстве. Постараюсь учитывать.";addMessage("capri",reply);speak(reply);history.push({role:"assistant",content:reply});setStatus("НА СВЯЗИ");return;}
 }
 if(!key){const reply="Я пока работаю в демо-режиме. Открой ⚙ и добавь свой бесплатный API-ключ OpenRouter, чтобы подключить настоящий ИИ. А память и озвучка уже работают локально.";addMessage("capri",reply);speak(reply);setStatus("ДЕМО-РЕЖИМ");return;}
 const mem=memories.map((m,i)=>`${i+1}. ${m.text}`).join("\n")||"Пока пусто.";
 const msgs=[{role:"system",content:SYSTEM+"\n\nПАМЯТЬ О ПОЛЬЗОВАТЕЛЕ (локально сохранённые заметки):\n"+mem},...history.slice(-16)];
 try{
   const res=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model, messages:msgs, temperature:0.85, max_tokens:350})});
   const data=await res.json();if(!res.ok)throw new Error(data?.error?.message||`HTTP ${res.status}`);
   const reply=data.choices?.[0]?.message?.content?.trim()||"Что-то пошло не так. Повтори, ладно?";
   history.push({role:"assistant",content:reply});addMessage("capri",reply);speak(reply);setStatus("НА СВЯЗИ");
 }catch(e){addMessage("capri","Не получилось подключиться к ИИ: "+e.message+" Проверь API-ключ, интернет и выбранную модель.","error");setStatus("НЕТ СВЯЗИ");}
}
$("#composer").addEventListener("submit",e=>{e.preventDefault();send(input.value);});
document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>{input.value=b.dataset.prompt;input.focus();}));
$("#settingsBtn").addEventListener("click",()=>{ $("#apiKey").value=localStorage.getItem(STORE.key)||"";$("#model").value=localStorage.getItem(STORE.model)||"openrouter/free";$("#speakToggle").checked=localStorage.getItem(STORE.speak)!=="false";$("#spontaneousToggle").checked=localStorage.getItem(STORE.spontaneous)!=="false";dialog.showModal();});
$("#saveSettings").addEventListener("click",()=>{localStorage.setItem(STORE.key,$("#apiKey").value.trim());localStorage.setItem(STORE.model,$("#model").value.trim()||"openrouter/free");localStorage.setItem(STORE.speak,String($("#speakToggle").checked));localStorage.setItem(STORE.spontaneous,String($("#spontaneousToggle").checked));dialog.close();addMessage("capri","Настройки сохранены на этом устройстве. Ну что, проверим меня?");setStatus("НА СВЯЗИ");});
$("#clearMemory").addEventListener("click",()=>{if(confirm("Удалить всю локальную память CAPRI?")){memories=[];saveMemories();addMessage("capri","Готово, локальные заметки очищены.");}});
$("#spontaneousBtn").addEventListener("click",()=>{if(localStorage.getItem(STORE.spontaneous)==="false"){addMessage("capri","Спонтанные реплики отключены в настройках.");return;}const prompts=["Скажи что-нибудь неожиданное, как Капри.","Начни короткий разговор со мной сама. Не задавай банальный вопрос.","Поделись странным наблюдением в стиле киберпанк-компаньона.","Придумай короткую мысль, которую ты захотела бы сказать мне прямо сейчас."];send(prompts[Math.floor(Math.random()*prompts.length)]);});
$("#micBtn").addEventListener("click",()=>{
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){addMessage("capri","На этом устройстве Safari может не поддерживать распознавание речи для веб-приложений. Попробуй диктовку клавиатуры iPhone или напиши сообщение.");$("#voiceState").textContent="ГОЛОС: НЕТ ПОДДЕРЖКИ";return;}
 if(recognition){recognition.stop();recognition=null;$("#voiceState").textContent="ГОЛОС: ГОТОВ";return;}
 recognition=new SR();recognition.lang="ru-RU";recognition.interimResults=false;recognition.maxAlternatives=1;
 recognition.onstart=()=>{$("#voiceState").textContent="ГОЛОС: СЛУШАЮ";setStatus("СЛУШАЮ…");$("#micBtn").classList.add("active");};
 recognition.onresult=e=>{input.value=e.results[0][0].transcript;send(input.value);};
 recognition.onerror=e=>{addMessage("capri","Не удалось распознать речь ("+e.error+"). Можно воспользоваться диктовкой клавиатуры.");};
 recognition.onend=()=>{recognition=null;$("#voiceState").textContent="ГОЛОС: ГОТОВ";$("#micBtn").classList.remove("active");setStatus("НА СВЯЗИ");};
 try{recognition.start();}catch(e){recognition=null;addMessage("capri","Не получилось запустить микрофон. Проверь разрешение сайта и попробуй снова.");}
});
if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
saveMemories();
if(!("speechSynthesis" in window))$("#voiceState").textContent="ГОЛОС: НЕТ ПОДДЕРЖКИ";