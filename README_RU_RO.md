# CAPRI AI v0.1 — prototip pentru Windows + iPhone

## Ce include
- Interfață cyberpunk în limba rusă.
- Chat AI prin OpenRouter API, implicit modelul `openrouter/free`.
- Memorie locală în browser (`localStorage`), cu salvare explicită prin mesajul „Запомни: ...”.
- Răspuns vocal prin funcția de sinteză vocală a browserului.
- Intrare vocală dacă browserul expune `SpeechRecognition` / `webkitSpeechRecognition`.
- PWA shell cache pentru deschidere mai rapidă după prima vizită.

## Pornire rapidă pe Windows
1. Extrage ZIP-ul.
2. Deschide folderul în VS Code sau alt editor.
3. Pentru test local, folosește o extensie de server local (de ex. Live Server în VS Code). Nu deschide direct `index.html` dacă vrei să testezi PWA/service worker.
4. În browser, apasă ⚙ și introdu cheia API OpenRouter. Poți verifica modelele gratuite la https://openrouter.ai/models?max_price=0.
5. Testează chat-ul și memoria.

## Folosire pe iPhone
Pentru a instala ca PWA, site-ul trebuie publicat pe HTTPS. Poți folosi un serviciu de hosting static cu plan gratuit, de exemplu GitHub Pages, după ce verifici condițiile actuale.
1. Publică fișierele statice pe HTTPS.
2. Deschide linkul în Safari pe iPhone.
3. Apasă Share → Add to Home Screen.
4. Deschide CAPRI de pe ecranul principal și setează cheia în ⚙.

## Important despre API key
Acest prototip face apelul API direct din browser. Cheia este păstrată în localStorage pe dispozitiv, dar poate fi extrasă de cineva cu acces la browser. **Nu publica o versiune publică cu cheia ta încorporată în cod.** Nu pune cheia în `app.js` sau în repository. Pentru utilizare serioasă, trebuie un backend/proxy propriu; hostingul gratuit poate avea limite.

OpenRouter are modele gratuite, dar limitele, disponibilitatea și viteza se pot schimba. Verifică pagina oficială: https://openrouter.ai/pricing/ și https://openrouter.ai/models?max_price=0.

## Limitări iPhone/iOS
- Safari/iOS poate să nu ofere Web Speech Recognition în PWA. Dacă microfonul nu funcționează, folosește dictarea tastaturii iPhone sau chatul text.
- Speech synthesis depinde de vocile instalate pe iPhone.
- Această versiune NU ascultă permanent și nu poate menține microfonul activ când aplicația este închisă/blocată.
- Memoria este locală browserului/dispozitivului. Dacă ștergi datele site-ului, notițele pot dispărea.
- PWA offline poate încărca interfața, dar AI-ul necesită internet.

## Memorie
Trimite un mesaj care începe cu `Запомни:`, de exemplu:
`Запомни: мне нравится фиолетовый цвет и киберпанк.`

Pentru a șterge memoria, ⚙ → Очистить локальную память.

## Ce urmează
1. Testăm prototipul pe PC.
2. Îl publicăm pe HTTPS și îl adăugăm pe iPhone.
3. Verificăm API-ul și vocea pe iPhone.
4. Dacă vrei, dezvoltăm ulterior un backend sigur pentru cheia API și o soluție nativă iOS pentru funcții mai avansate.
