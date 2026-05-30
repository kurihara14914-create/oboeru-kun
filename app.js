const STORAGE_KEY = "studyMemoryGameV2";
const TODAY = dateKey(new Date());

const SUBJECTS = [
  "未設定",
  "英語",
  "英単語",
  "英文法",
  "数学",
  "数学I",
  "数学A",
  "数学II",
  "数学B",
  "数学III",
  "数学C",
  "現代文",
  "古文",
  "漢文",
  "日本史",
  "世界史",
  "地理",
  "政治経済",
  "倫理",
  "公共",
  "現代社会",
  "物理",
  "化学",
  "生物",
  "地学",
  "情報",
  "小論文",
  "その他",
];

const AI_PROMPT = `あなたは大学受験向けの単語カード作成アシスタントです。
添付した画像、または入力した文章から、大学受験で覚えるべき重要事項を抽出し、暗記用の穴埋め単語カードを作ってください。

出力は必ず次のMarkdown形式にしてください。

# 科目名
- 穴埋め文: 答え
- 穴埋め文: 答え
- 穴埋め文: 答え

ルール:
- 科目名は必ず次のリストから1つだけ選ぶ: 未設定、英語、英単語、英文法、数学、数学I、数学A、数学II、数学B、数学III、数学C、現代文、古文、漢文、日本史、世界史、地理、政治経済、倫理、公共、現代社会、物理、化学、生物、地学、情報、小論文、その他
- 「英語（時事問題・地理）」のように、リスト外の科目名や複合した科目名を作らない
- 複数の科目にまたがる内容でも、最も近い科目をリストから1つだけ選ぶ
- どれにも判断できない場合は「未設定」を使う
- 大学受験で問われやすい重要語句を優先する
- 1行につき1枚の単語カードにする
- 左側は、答えにしたい部分を「？？？」に置き換えた穴埋め文にする
- 右側は、「？？？」に入る答えだけを書く
- ユーザーは右側の答えをタイピングするので、答えは短く入力しやすい形にする
- 同義語や別訳がある場合、右側は「捨てる / 放棄する」のようにスラッシュ区切りにする
- 曖昧な語句や重複する単語カードは避ける
- 説明文そのものを答えにしない
- 英単語の場合も「abandon = ？？？: 捨てる / 放棄する」のようにする
- 用語暗記の場合は「推古朝を中心とする日本最初の仏教文化で、南北朝文化をベースに仏教を導入した文化を？？？という: 飛鳥文化」のようにする
- Markdown以外の説明文は出力しない`;

const state = {
  data: loadData(),
  selectedSubject: "未設定",
  session: {
    ids: [],
    answered: 0,
    mode: "今日の復習",
    score: 0,
    combo: 0,
    awaitingNext: false,
  },
};

const els = {
  views: document.querySelectorAll(".view"),
  navItems: document.querySelectorAll(".nav-item"),
  dueCount: document.querySelector("#dueCount"),
  level: document.querySelector("#level"),
  xp: document.querySelector("#xp"),
  xpBar: document.querySelector("#xpBar"),
  bestCombo: document.querySelector("#bestCombo"),
  todaySubjects: document.querySelector("#todaySubjects"),
  startDue: document.querySelector("#startDue"),
  startWeak: document.querySelector("#startWeak"),
  startAll: document.querySelector("#startAll"),
  trainSubject: document.querySelector("#trainSubject"),
  sessionProgress: document.querySelector("#sessionProgress"),
  trainModeLabel: document.querySelector("#trainModeLabel"),
  question: document.querySelector("#question"),
  answerForm: document.querySelector("#answerForm"),
  answer: document.querySelector("#answer"),
  feedback: document.querySelector("#feedback"),
  combo: document.querySelector("#combo"),
  score: document.querySelector("#score"),
  hint: document.querySelector("#hint"),
  skip: document.querySelector("#skip"),
  subjectPicker: document.querySelector("#subjectPicker"),
  manualFront: document.querySelector("#manualFront"),
  manualBack: document.querySelector("#manualBack"),
  addManual: document.querySelector("#addManual"),
  bulkText: document.querySelector("#bulkText"),
  importBulk: document.querySelector("#importBulk"),
  sampleBulk: document.querySelector("#sampleBulk"),
  copyAiPrompt: document.querySelector("#copyAiPrompt"),
  deleteAllCards: document.querySelector("#deleteAllCards"),
  cardManager: document.querySelector("#cardManager"),
  weakStartTop: document.querySelector("#weakStartTop"),
  weakList: document.querySelector("#weakList"),
  totalCards: document.querySelector("#totalCards"),
  todayCorrect: document.querySelector("#todayCorrect"),
  todayMistakes: document.querySelector("#todayMistakes"),
  totalReviews: document.querySelector("#totalReviews"),
  subjectStats: document.querySelector("#subjectStats"),
  resetData: document.querySelector("#resetData"),
  toast: document.querySelector("#toast"),
};

function loadData() {
  const initial = {
    cards: [],
    stats: {
      xp: 0,
      bestCombo: 0,
      totalReviews: 0,
      today: TODAY,
      todayCorrect: 0,
      todayMistakes: 0,
    },
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.cards)) return initial;
    return {
      ...initial,
      ...parsed,
      stats: rolloverToday({ ...initial.stats, ...parsed.stats }),
    };
  } catch {
    return initial;
  }
}

function rolloverToday(stats) {
  if (stats.today === TODAY) return stats;
  return {
    ...stats,
    today: TODAY,
    todayCorrect: 0,
    todayMistakes: 0,
  };
}

function saveData() {
  state.data.stats = rolloverToday(state.data.stats);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[　\s]+/g, "")
    .replace(/[。、，,.・:：;；'"“”‘’()[\]{}「」『』【】\-ー]/g, "");
}

function similarity(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;
  if (left.includes(right) || right.includes(left)) return 1;
  const set = new Set(left);
  let hits = 0;
  for (const char of right) {
    if (set.has(char)) hits += 1;
  }
  return hits / Math.max(left.length, right.length);
}

function answerCandidates(answer) {
  const full = String(answer).trim();
  const split = full
    .split(/\s*(?:\/|／|、|，|,|;|；)\s*/g)
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([full, ...split])];
}

function answerScore(input, answer) {
  return Math.max(...answerCandidates(answer).map((candidate) => similarity(input, candidate)));
}

function cleanMarkdown(text) {
  return String(text)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[[^\]]+]\([^)]+\)/g, (match) => match.match(/\[([^\]]+)]/)?.[1] || " ")
    .replace(/[*_`>#]/g, "")
    .trim();
}

function makeCard(front, back, subject = state.selectedSubject, source = "手入力") {
  const prompt = cleanMarkdown(front);
  const answer = cleanMarkdown(back);
  const now = new Date().toISOString();
  return {
    id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    subject: subject || "未設定",
    prompt,
    answer,
    detail: answer,
    source,
    mistakes: 0,
    correctStreak: 0,
    interval: 0,
    dueAt: TODAY,
    createdAt: now,
    lastReviewedAt: "",
  };
}

function hasBlankPrompt(prompt) {
  return /[？?]/.test(prompt);
}

function parseMarkdown(rawText, fallbackSubject) {
  const lines = rawText.split(/\r?\n/);
  const cards = [];
  let section = fallbackSubject || "未設定";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(/^#{1,6}\s+(.+)/);
    if (heading) {
      const headingText = cleanMarkdown(heading[1]);
      section = SUBJECTS.includes(headingText) ? headingText : fallbackSubject || headingText || "未設定";
      continue;
    }

    const body = cleanMarkdown(line.replace(/^[-*+]\s+/, "").replace(/^\d+[.)]\s+/, ""));
    if (body.length < 3) continue;

    const pair = body.match(/^(.{1,50}?)(?:\s*[:：]\s*|\s+-\s+)(.{1,})$/);
    if (pair && hasBlankPrompt(pair[1])) {
      cards.push(makeCard(pair[1], pair[2], section, section));
    }
  }

  return dedupeNewCards(cards);
}

function dedupeNewCards(cards) {
  const existing = new Set(state.data.cards.map((card) => normalize(`${card.subject}:${card.prompt}:${card.answer}`)));
  const seen = new Set();
  return cards.filter((card) => {
    const key = normalize(`${card.subject}:${card.prompt}:${card.answer}`);
    if (existing.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function addCards(cards) {
  if (!cards.length) {
    showToast("追加できる単語カードがありません");
    return;
  }
  state.data.cards.push(...cards);
  saveData();
  renderAll();
  showToast(`${cards.length}枚追加しました`);
}

function dueCards() {
  return state.data.cards.filter((card) => card.dueAt <= TODAY);
}

function weakCards() {
  return [...state.data.cards].filter((card) => card.mistakes > 0).sort((a, b) => b.mistakes - a.mistakes);
}

function getCurrentCard() {
  const id = state.session.ids[0];
  return state.data.cards.find((card) => card.id === id);
}

function startSession(cards, modeLabel) {
  const ids = shuffle(cards.map((card) => card.id));
  state.session = {
    ids,
    answered: 0,
    mode: modeLabel,
    score: 0,
    combo: 0,
    awaitingNext: false,
  };
  showView("trainView");
  renderTraining();
}

function deleteCard(cardId) {
  const card = state.data.cards.find((item) => item.id === cardId);
  if (!card) return;
  const ok = window.confirm(`この単語カードを削除しますか？\n\n${card.prompt}`);
  if (!ok) return;
  state.data.cards = state.data.cards.filter((item) => item.id !== cardId);
  state.session.ids = state.session.ids.filter((id) => id !== cardId);
  state.session.awaitingNext = false;
  saveData();
  renderAll();
  showToast("単語カードを削除しました");
}

function deleteAllCards() {
  if (!state.data.cards.length) return showToast("削除する単語カードがありません");
  const ok = window.confirm("すべての単語カードを削除しますか？\n記録は残ります。");
  if (!ok) return;
  state.data.cards = [];
  state.session = { ids: [], answered: 0, mode: "今日の復習", score: 0, combo: 0, awaitingNext: false };
  saveData();
  renderAll();
  showToast("すべての単語カードを削除しました");
}

function completeCurrentCard() {
  state.session.ids.shift();
  state.session.answered += 1;
}

function requeueCurrentCard() {
  const [id] = state.session.ids.splice(0, 1);
  const index = Math.min(2, state.session.ids.length);
  state.session.ids.splice(index, 0, id);
  state.session.answered += 1;
}

function applyCorrect(card) {
  state.session.combo += 1;
  state.session.score += 10 + Math.min(state.session.combo * 2, 30);
  state.data.stats.xp += 10;
  state.data.stats.totalReviews += 1;
  state.data.stats.todayCorrect += 1;
  state.data.stats.bestCombo = Math.max(state.data.stats.bestCombo, state.session.combo);

  card.correctStreak += 1;
  card.interval = nextInterval(card.correctStreak);
  card.dueAt = addDays(card.interval);
  card.lastReviewedAt = TODAY;

  completeCurrentCard();
  saveData();
}

function applyMiss(card) {
  state.session.combo = 0;
  state.data.stats.totalReviews += 1;
  state.data.stats.todayMistakes += 1;

  card.mistakes += 1;
  card.correctStreak = 0;
  card.interval = 0;
  card.dueAt = TODAY;
  card.lastReviewedAt = TODAY;

  requeueCurrentCard();
  saveData();
}

function nextInterval(streak) {
  if (streak <= 1) return 1;
  if (streak === 2) return 3;
  if (streak === 3) return 7;
  return 14;
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function showView(viewId) {
  els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  if (viewId === "trainView") window.setTimeout(() => els.answer.focus(), 120);
}

function renderAll() {
  renderToday();
  renderSubjectPicker();
  renderTraining();
  renderCardManager();
  renderWeakList();
  renderRecords();
}

function renderToday() {
  const due = dueCards();
  const level = Math.floor(state.data.stats.xp / 100) + 1;
  els.dueCount.textContent = String(due.length);
  els.level.textContent = String(level);
  els.xp.textContent = String(state.data.stats.xp);
  els.bestCombo.textContent = String(state.data.stats.bestCombo);
  els.xpBar.style.width = `${state.data.stats.xp % 100}%`;

  const grouped = groupBySubject(state.data.cards);
  if (!state.data.cards.length) {
    els.todaySubjects.innerHTML = '<div class="empty">まずは「単語カード作成/管理」から単語カードを追加します。</div>';
    return;
  }

  els.todaySubjects.innerHTML = Object.entries(grouped)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([subject, cards]) => {
      const dueCount = cards.filter((card) => card.dueAt <= TODAY).length;
      return `<div class="subject-tile"><strong>${escapeHtml(subject)}</strong><span>単語カード${cards.length}枚 / 今日${dueCount}枚</span></div>`;
    })
    .join("");
}

function renderSubjectPicker() {
  els.subjectPicker.innerHTML = SUBJECTS.map(
    (subject) =>
      `<button class="subject-choice ${subject === state.selectedSubject ? "active" : ""}" type="button" data-subject="${escapeHtml(subject)}">${escapeHtml(subject)}</button>`,
  ).join("");
}

function renderTraining() {
  const card = getCurrentCard();
  els.combo.textContent = String(state.session.combo);
  els.score.textContent = `Score ${state.session.score}`;
  els.trainModeLabel.textContent = state.session.mode;
  els.answer.disabled = false;
  els.hint.disabled = false;
  els.skip.textContent = "次へ";

  if (!card) {
    els.trainSubject.textContent = "完了";
    els.sessionProgress.textContent = `${state.session.answered} / ${state.session.answered}`;
    els.question.textContent = state.data.cards.length ? "このセッションは完了です。" : "単語カードを作ると開始できます。";
    els.feedback.className = "feedback";
    els.feedback.textContent = state.data.cards.length
      ? "今日の数字を確認するか、別モードで続けられます。"
      : "「単語カード作成/管理」から単語カードを追加してください。";
    els.answer.value = "";
    return;
  }

  els.trainSubject.textContent = card.subject;
  els.sessionProgress.textContent = `${state.session.answered + 1} / ${state.session.answered + state.session.ids.length}`;
  els.question.textContent = card.prompt;
  els.feedback.className = "feedback";
  els.feedback.textContent = "答えを見る前に、まず入力します。";
  els.answer.value = "";
}

function renderCardManager() {
  if (!state.data.cards.length) {
    els.cardManager.innerHTML = '<div class="empty">まだ単語カードはありません。</div>';
    return;
  }

  els.cardManager.innerHTML = [...state.data.cards]
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .map(
      (card) => `
        <article class="list-item manage-item">
          <div>
            <span class="subject-badge">${escapeHtml(card.subject)}</span>
            <strong>${escapeHtml(card.prompt)}</strong>
            <p>${escapeHtml(card.answer)}</p>
          </div>
          <button class="small-danger" type="button" data-delete-card="${escapeHtml(card.id)}">削除</button>
        </article>
      `,
    )
    .join("");
}

function renderWeakList() {
  const cards = weakCards();
  if (!cards.length) {
    els.weakList.innerHTML = '<div class="empty">まだ弱点の単語カードはありません。</div>';
    return;
  }
  els.weakList.innerHTML = cards
    .map(
      (card) => `
        <article class="list-item">
          <div>
            <span class="subject-badge">${escapeHtml(card.subject)}</span>
            <strong>${escapeHtml(card.prompt)}</strong>
            <p>${escapeHtml(card.answer)}</p>
          </div>
          <small>${card.mistakes}ミス</small>
        </article>
      `,
    )
    .join("");
}

function renderRecords() {
  els.totalCards.textContent = String(state.data.cards.length);
  els.todayCorrect.textContent = String(state.data.stats.todayCorrect);
  els.todayMistakes.textContent = String(state.data.stats.todayMistakes);
  els.totalReviews.textContent = String(state.data.stats.totalReviews);

  const grouped = groupBySubject(state.data.cards);
  if (!state.data.cards.length) {
    els.subjectStats.innerHTML = '<div class="empty">記録は単語カード追加後に表示されます。</div>';
    return;
  }

  els.subjectStats.innerHTML = Object.entries(grouped)
    .map(([subject, cards]) => {
      const mistakes = cards.reduce((sum, card) => sum + card.mistakes, 0);
      const due = cards.filter((card) => card.dueAt <= TODAY).length;
      return `<article class="list-item"><div><strong>${escapeHtml(subject)}</strong><p>単語カード${cards.length}枚 / 今日${due}枚</p></div><small>${mistakes}ミス</small></article>`;
    })
    .join("");
}

function groupBySubject(cards) {
  return cards.reduce((acc, card) => {
    acc[card.subject] = acc[card.subject] || [];
    acc[card.subject].push(card);
    return acc;
  }, {});
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 1800);
}

els.navItems.forEach((item) => {
  item.addEventListener("click", () => showView(item.dataset.view));
});

els.startDue.addEventListener("click", () => {
  const cards = dueCards();
  if (!cards.length) return showToast("今日の復習単語カードはありません");
  startSession(cards, "今日の復習");
});

els.startWeak.addEventListener("click", () => {
  const cards = weakCards();
  if (!cards.length) return showToast("弱点の単語カードはまだありません");
  startSession(cards, "弱点特訓");
});

els.startAll.addEventListener("click", () => {
  if (!state.data.cards.length) return showToast("単語カードを追加してください");
  startSession(state.data.cards, "全単語カード");
});

els.weakStartTop.addEventListener("click", () => {
  const cards = weakCards();
  if (!cards.length) return showToast("弱点の単語カードはまだありません");
  startSession(cards, "弱点特訓");
});

els.answerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const card = getCurrentCard();
  if (!card) return;
  if (state.session.awaitingNext) return;
  const score = answerScore(els.answer.value, card.answer);
  if (score >= 0.72) {
    applyCorrect(card);
    els.feedback.className = "feedback good";
    els.feedback.textContent = `正解。${card.answer}`;
    els.combo.textContent = String(state.session.combo);
    els.score.textContent = `Score ${state.session.score}`;
    renderToday();
    renderWeakList();
    renderRecords();
    window.setTimeout(renderTraining, 700);
    return;
  }

  applyMiss(card);
  state.session.awaitingNext = true;
  els.feedback.className = "feedback bad";
  els.feedback.textContent = `不正解。正解: ${card.answer}`;
  els.combo.textContent = String(state.session.combo);
  els.score.textContent = `Score ${state.session.score}`;
  els.answer.disabled = true;
  els.hint.disabled = true;
  els.skip.textContent = "次へ進む";
  renderToday();
  renderWeakList();
  renderRecords();
});

els.hint.addEventListener("click", () => {
  if (state.session.awaitingNext) return;
  const card = getCurrentCard();
  if (!card) return;
  const answer = card.answer;
  const hint = answer.length <= 2 ? answer[0] : `${answer[0]}${"・".repeat(Math.max(answer.length - 2, 1))}${answer.at(-1)}`;
  els.feedback.className = "feedback";
  els.feedback.textContent = `ヒント: ${hint}`;
});

els.skip.addEventListener("click", () => {
  if (state.session.awaitingNext) {
    state.session.awaitingNext = false;
    renderTraining();
    return;
  }
  const card = getCurrentCard();
  if (!card) return;
  applyMiss(card);
  state.session.awaitingNext = true;
  els.feedback.className = "feedback bad";
  els.feedback.textContent = `正解: ${card.answer}`;
  els.combo.textContent = String(state.session.combo);
  els.score.textContent = `Score ${state.session.score}`;
  els.answer.disabled = true;
  els.hint.disabled = true;
  els.skip.textContent = "次へ進む";
  renderToday();
  renderWeakList();
  renderRecords();
});

els.subjectPicker.addEventListener("click", (event) => {
  const button = event.target.closest("[data-subject]");
  if (!button) return;
  state.selectedSubject = button.dataset.subject;
  renderSubjectPicker();
});

els.addManual.addEventListener("click", () => {
  const front = els.manualFront.value.trim();
  const back = els.manualBack.value.trim();
  if (!front || !back) return showToast("穴埋め文と答えを入力してください");
  if (!hasBlankPrompt(front)) return showToast("表に「？？？」を入れてください");
  addCards(dedupeNewCards([makeCard(front, back)]));
  els.manualFront.value = "";
  els.manualBack.value = "";
  els.manualFront.focus();
});

els.importBulk.addEventListener("click", () => {
  const cards = parseMarkdown(els.bulkText.value, state.selectedSubject);
  addCards(cards);
});

els.sampleBulk.addEventListener("click", () => {
  els.bulkText.value = `# 英単語
- abandon = ？？？: 捨てる / 放棄する
- estimate = ？？？: 見積もる / 推定する

# 地理
- 季節によって向きが変わる風を？？？という: 季節風
- 熱帯・亜熱帯で単一の商品作物を大規模に栽培する農園を？？？という: プランテーション

# 化学
- 6.02×10^23個の粒子の集まりを？？？という: モル
- 窒素と水素からアンモニアを合成する方法を？？？という: ハーバー・ボッシュ法`;
});

els.copyAiPrompt.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(AI_PROMPT);
    showToast("AI用プロンプトをコピーしました");
  } catch {
    els.bulkText.value = AI_PROMPT;
    showToast("コピーできないため入力欄に入れました");
  }
});

els.cardManager.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-card]");
  if (!button) return;
  deleteCard(button.dataset.deleteCard);
});

els.deleteAllCards.addEventListener("click", deleteAllCards);

els.resetData.addEventListener("click", () => {
  const ok = window.confirm("単語カードと記録をすべて削除しますか？");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  state.data = loadData();
  state.session = { ids: [], answered: 0, mode: "今日の復習", score: 0, combo: 0, awaitingNext: false };
  renderAll();
  showToast("リセットしました");
});

renderAll();
registerServiceWorker();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!["http:", "https:"].includes(window.location.protocol)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
