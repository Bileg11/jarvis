# 🎯 CHALLENGE DASHBOARD (Glow-Up HUD / Tactical Mission Control) — BUILD SPEC

> Энэ файлыг **шинэ Claude session**-д бүтнээр paste хийнэ. Cold start-аас build хийхэд хангалттай бүх мэдээлэл энд бий.
> Repo root: `~/my-jarvis` · GitHub: `github.com/Bileg11/jarvis` (branch `main`)

---

## 0. ЗОРИЛГО

Билэг ба Маралаагийн **June Challenge**-д зориулсан "Tactical Mission Control" dashboard — Iron Man / J.A.R.V.I.S. маягийн. Хоёулаа **бие биенийхээ явцыг LIVE харна** (Telegram bot-оос ирсэн өгөгдөл шууд урсана).

---

## 1. СИСТЕМИЙН БҮТЭЦ (одоо байгаа)

- **Web app**: `jarvis.amarsaikhanbileg.workers.dev` — Cloudflare Worker static assets. Vanilla **HTML/CSS/JS** (framework БИШ). Бүх код `index.html`-д (441KB, инлайн `<script>`). Туслах: `gemini.js`, `firebase-config.js`, `app.js`, `themes.js`, `style.css`.
- **Desktop**: Electron ("JARVIS OS" launcher = git pull + npm start, local файл уншина).
- **Telegram bot**: `@Bileg_Jarvis_Bot`, Railway дээр (`webhook/server.js`, `webhook/api/telegram.js`). Энэ bot нь challenge өгөгдлийг Firestore-д бичдэг.
- **Firebase/Firestore**: web нь `window._db` (Firestore), `window._auth.currentUser.uid` (нэвтэрсэн хэрэглэгч) ашиглана. Live: `.onSnapshot()`.

### Deploy дүрэм (ЗААВАЛ дага)
1. Код засаад `git push origin main` → Cloudflare автоматаар rebuild.
2. `build-pages.sh` нь JS-д `?b=<build>` cache-bust автоматаар нэмдэг. HTML нь `no-cache`. **Шинэ кодыг харахад `Cmd+Shift+R` (hard refresh)**.
3. **АНХААР**: `index.html` асар том. Edit хийсний дараа inline JS-ийн синтаксыг шалга:
   `node -e 'const fs=require("fs"),vm=require("vm");const h=fs.readFileSync("index.html","utf8");const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;let m,b=0;while((m=re.exec(h))){try{new vm.Script(m[1])}catch(e){b++;console.log(e.message)}}console.log(b===0?"OK":"FAIL")'`

---

## 2. CHALLENGE ӨГӨГДЛИЙН БҮТЭЦ (Firestore) — Telegram bot бичдэг

Бот аль хэдийн дараах өгөгдлийг бичдэг. Dashboard зөвхөн **унших** (+live listen).

```
challenge/current
  → { id, number, name, start, end }      // идэвхтэй challenge заагч. Default: {id:'june2026', number:1, name:'Challenge #1', end:'2026-06-30'}

challenge/{id}/daily/{YYYY-MM-DD}          // id = дээрх challenge/current.id
  → {
      bileg:  { pct:0-100, done, total, proofs },   // pct=өдрийн оноо, proofs=verified Proof-Cam тоо
      marlaa: { pct:0-100, done, total, proofs },
    }

challenge/{id}/streaks/{uid}
  → { current, best, total_days, last_date }

challenge/{id}/proofs/{YYYY-MM-DD}         // Proof-Cam зурагнууд
  → { [proofId]: { fromUid, fromName, caption, fileId, verified:bool, rejected:bool, ts, verifiedAt } }

challenge/{id}/config
  → { group_chat_id }

users/{uid}/config/profile  → { role:'bileg'|'marlaa', name }
users/{uid}/plans/{date}    → { confirmed:[{ id, label, icon, done:bool, start, mins }] }   // Маралаагийн /today /done
users/{uid}/routines/{date} → { exercise, hanzi, read, journal }                            // Билэгийн routine
users/{uid}/glowup/{date}   → { done:[catId...], pct }                                       // /glow done
```

**UID-ууд:**
- **Билэг**: `window._auth.currentUser.uid` (нэвтэрсэн хэрэглэгчийн uid). Bot-д = `process.env.USER_UID`.
- **Маралаа**: тогтмол `'marlaa'` (Telegram `/addpartner`-аар бүртгэгдсэн).

> ⚠️ Dashboard нь `challenge/current`-аас `id` уншиж, бүх замдаа `challenge/${id}/...` ашиглах ёстой (june2026 hardcode БИШ).

---

## 3. ОДОО БАЙГАА ЭХЛЭЛ ЦЭГ (index.html)

- Баруун баганад **GLOW-UP CHALLENGE widget** (~line 2810, `<span class="ch-title">🔥 GLOW-UP CHALLENGE</span>`). Билэг/Маралаагийн % харуулдаг.
- `#glowup-overlay` overlay аль хэдийн бий (~line 3007).
- `_challengeRender()` функц widget-ийг render хийдэг (~line 3940).
- Firestore live жишээ: `window._db.doc(path).onSnapshot(snap => {...})` (line 4618, 4865-д бий).

**Хийх зүйл:** GLOW-UP CHALLENGE widget дээр дарахад → шинэ **бүрэн дэлгэцийн HUD overlay** (`#challenge-hud`) нээгдэнэ.

---

## 4. ДИЗАЙН (Tactical Mission Control — найзын зурсан)

```
+-- [TACTICAL_OPS // MISSION_CONTROL] ----------------------- [X DAYS LEFT] --+
|  TARGET_BOSS: ЛАЙФСТАЙЛ ЗАЛХУУРАЛ (LVL 04)                                  |
|  HP: [============#---------------------------------] 36% / 100%            |
+----------------------------------------------------------------------------+
|  << BILEG >> [ACTIVE]  72%        |  << МАРАЛАА >> [ACTIVE]  85%            |
|  +-- ROUTINE_GRID ----------+     |  +-- ROUTINE_GRID ----------+           |
|  | [X] HSK        [09:15]   |     |  | [X] SKINCARE   [08:45]   |           |
|  | [ ] GYM        [PENDING] |     |  | [X] DRIVING    [10:00]   |           |
|  | ...                      |     |  | ...                      |           |
|  +--------------------------+     |  +--------------------------+           |
|  STREAK: 🔥 12 DAYS  📸 3        |  STREAK: 🔥 08 DAYS  📸 2               |
+----------------------------------------------------------------------------+
|  [STARK_VAULT 50k MNT]  [LIVE_LOGS // COMM_FEED]   [📸 PROOF GALLERY]      |
|   B:20k M:30k           > [09:15] Bileg HSK done   [verified зурагнууд]    |
+----------------------------------------------------------------------------+
```

### Компонентууд
1. **BOSS HP бар** (дээд): `HP = 100 − round((bileg.pct + marlaa.pct)/2)`. HP буурах тусам та хоёр ялж байна. Өнгө: >60%→улаан анивчих, <30%→ногоон (ялалт ойрхон). "X days left" = `challenge/current.end` хүртэл.
2. **2 багана (Билэг / Маралаа)**: тус бүр —
   - % (өдрийн оноо, daily доороос).
   - Routine grid: Билэг = `routines/{today}` (exercise/hanzi/read/journal) + `glowup/{today}.done`. Маралаа = `plans/{today}.confirmed` (done эсэх) + `glowup/{today}.done`. ✅/☐ + цаг.
   - 🔥 streak (`streaks/{uid}.current`) + 📸 proofs (`daily/{today}.{role}.proofs`).
   - Билэгийн багана = одоогийн theme accent өнгө, Маралаагийнх = өөр өнгө (ялгаатай).
3. **STARK_VAULT** (доод зүүн): мөнгөн санг харуулна (хэрэв байхгүй бол одоохондоо статик/нуух).
4. **LIVE_LOGS / COMM_FEED** (доод төв): `challenge/{id}/proofs/{today}` болон daily өөрчлөлтийг **onSnapshot**-оор сонсож, шинэ үйлдэл доороосоо дээшээ урсана ("[09:15] Bileg HSK done", "[10:00] Marlaa proof verified"). Жинхэнэ хакерын терминал мэдрэмж.
5. **📸 PROOF GALLERY** (доод баруун): `proofs/{today}`-ийн verified зурагнуудыг харуулна. fileId нь Telegram-ийнх — web дээр шууд харагдахгүй тул эхэндээ caption + ✅ тэмдэг харуулж болно (зураг хожим).

### LIVE
- `challenge/{id}/daily/{today}`, `challenge/{id}/proofs/{today}`, `users/{bilegUid}/...`, `users/marlaa/...` дээр **`.onSnapshot()`** тавьж бодит цагт шинэчил. HUD хаах үед `unsub()`.

---

## 5. ХЭРЭГЖҮҮЛЭЛТ

- **HTML**: `index.html`-д шинэ `<div id="challenge-hud">` overlay (одоо байгаа `#glowup-overlay`-ийг өргөтгөж эсвэл шинээр). Бүрэн дэлгэц хучих, дээр z-index.
- **CSS**: ЗААВАЛ theme хувьсагч ашигла (`var(--accent)`, `var(--accent2)`, `var(--text)`, `var(--text-b)`, `var(--bg)`, `var(--border)`, `var(--red)`, `var(--green)`, `var(--neon)`). Ингэснээр theme сольоход dashboard дагаж өөрчлөгдөнө. Mono/HUD фонт: `var(--mono)`, `var(--hud)`.
- **JS**: `openChallengeHud()` / `closeChallengeHud()` функц. GLOW-UP widget-ийн onclick-ийг үүн рүү залга. Firestore onSnapshot listener-ууд + render функцууд.
- **Layout 4 (сонголт)**: одоо Layout 1/2/3 бий (`LAYOUTS`). Layout 4 = "Tactical Mission Control" болгож нэмж болно (gemini.js-ийн LAYOUT_CHANGE prompt-д 4 нэмэх).

---

## 6. АНХААРАХ (энэ session-ээс сурсан)

- **gemini.js-д хоёр ижил нэртэй `function` бичиж болохгүй** (hoisting → infinite recursion болсон туршлага бий).
- **Cache**: index.html `no-cache`, JS `?b=<build>` cache-bust. Шинэ кодыг харахад hard-refresh.
- **Firestore уншихад `window._db`, `window._auth.currentUser.uid`** ашигла. Нэвтрээгүй бол хамгаалалт тавь.
- **challenge id**-г `challenge/current`-аас динамикаар ав (hardcode june2026 БИШ).
- Telegram bot аль хэдийн өгөгдөл бичдэг тул dashboard зөвхөн **унших/listen**.

---

## 7. (Сонголт) ARC REACTOR — голын радар

CORE дэлгэцийн terminal дээрх эргэлддэг радарыг (`#reactor`, `ArcReactor` class, "STANDBY // AWAITING INPUT") жинхэнэ Старкийн зүрхэвч болгох:
- CSS цагираг (palladium rings) + `@keyframes reactor-spin` + `filter: drop-shadow(0 0 8px var(--accent))` glow.
- **Reactive**: `PROC LOAD` (telemetry) ихсэх үед эргэх хурд нэмэгдэх; AI "боловсруулж байна" үед голын гэрэл pulse хийх.
- Одоо canvas/JS дээр байгаа (`ArcReactor` class). CSS/SVG давхаргаар сайжруулж болно.

---

## ⚡ START PROMPT (шинэ session-д бичих)

> "JARVIS OS-ийн Challenge Dashboard-ыг хийе. `~/my-jarvis/CHALLENGE-DASHBOARD-SPEC.md`-ийг уншаад, Tactical Mission Control HUD-ыг index.html-д нэмж, Firestore-оос Билэг vs Маралаагийн өгөгдлийг live (onSnapshot) уншиж харуулаад, GLOW-UP CHALLENGE widget дээр дарахад нээгддэг болго. Theme хувьсагч ашигла. git push origin main."
