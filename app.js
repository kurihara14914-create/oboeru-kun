const STORAGE_KEY = "studyMemoryGameV2";
const TODAY = dateKey(new Date());

const SUBJECTS = [
  "未設定",
  "英語",
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
添付した画像、または入力した文章から、大学受験で覚えるべき重要事項を抽出し、暗記用の単語カードを作ってください。

出力は必ず次のMarkdown形式にしてください。

# 科目名
- 表: 裏
- 表: 裏
- 表: 裏

ルール:
- 科目名は必ず次のリストから1つだけ選ぶ: 未設定、英語、数学、数学I、数学A、数学II、数学B、数学III、数学C、現代文、古文、漢文、日本史、世界史、地理、政治経済、倫理、公共、現代社会、物理、化学、生物、地学、情報、小論文、その他
- 科目見出しは必ず「# 英語」のように、行頭に「# 」を付けて出力する
- 科目名だけの行、または「科目: 英語」のような形式は使わない
- 「英語（時事問題・地理）」のように、リスト外の科目名や複合した科目名を作らない
- 複数の科目にまたがる内容でも、最も近い科目をリストから1つだけ選ぶ
- どれにも判断できない場合は「未設定」を使う
- 大学受験で問われやすい重要語句を優先する
- 1行につき1枚の単語カードにする
- 長文・説明文から作る場合は、左側を「？？？」を含む穴埋め文、右側を「？？？」に入る答えにする
- 英単語や一問一答で十分な場合は、左側を問う語句、右側を答えにする
- ユーザーは右側の答えをタイピングするので、右側は短く入力しやすい形にする
- 同義語や別訳がある場合、右側は「捨てる / 放棄する」のようにスラッシュ区切りにする
- 曖昧な語句や重複する単語カードは避ける
- 説明文そのものを答えにしない
- 英単語の場合は「abandon: 捨てる / 放棄する」のようにする
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
  createSectionButtons: document.querySelectorAll("[data-create-section]"),
  createPanels: document.querySelectorAll(".create-panel"),
  createModeButtons: document.querySelectorAll("[data-create-mode]"),
  createModes: document.querySelectorAll(".create-mode"),
  dueCount: document.querySelector("#dueCount"),
  progressDone: document.querySelector("#progressDone"),
  progressTotal: document.querySelector("#progressTotal"),
  level: document.querySelector("#level"),
  levelInfo: document.querySelector("#levelInfo"),
  xp: document.querySelector("#xp"),
  xpInfo: document.querySelector("#xpInfo"),
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
  trainingCard: document.querySelector(".training-card"),
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
  copyAiPrompt: document.querySelector("#copyAiPrompt"),
  deleteAllCards: document.querySelector("#deleteAllCards"),
  cardManager: document.querySelector("#cardManager"),
  managerSearch: document.querySelector("#managerSearch"),
  managerSubject: document.querySelector("#managerSubject"),
  managerSort: document.querySelector("#managerSort"),
  weakStartTop: document.querySelector("#weakStartTop"),
  weakList: document.querySelector("#weakList"),
  totalCards: document.querySelector("#totalCards"),
  masteredCards: document.querySelector("#masteredCards"),
  todayCorrect: document.querySelector("#todayCorrect"),
  todayMistakes: document.querySelector("#todayMistakes"),
  totalReviews: document.querySelector("#totalReviews"),
  totalStudyTime: document.querySelector("#totalStudyTime"),
  subjectStats: document.querySelector("#subjectStats"),
  resetData: document.querySelector("#resetData"),
  toggleBgm: document.querySelector("#toggleBgm"),
  toast: document.querySelector("#toast"),
  infoPop: document.querySelector("#infoPop"),
  resultEffect: document.querySelector("#resultEffect"),
  milestoneEffect: document.querySelector("#milestoneEffect"),
  editPanel: document.querySelector("#editPanel"),
  editSubject: document.querySelector("#editSubject"),
  editFront: document.querySelector("#editFront"),
  editBack: document.querySelector("#editBack"),
  saveEdit: document.querySelector("#saveEdit"),
  cancelEdit: document.querySelector("#cancelEdit"),
};

let audioContext;
let bgmTimer;
let bgmStep = 0;
let bgmEnabled = false;
let editingCardId = "";
let studyTickStartedAt = document.visibilityState === "visible" ? Date.now() : 0;

function loadData() {
  const initial = {
    cards: [],
    stats: {
      xp: 0,
      bestCombo: 0,
      totalReviews: 0,
      totalStudySeconds: 0,
      today: TODAY,
      todayCorrect: 0,
      todayMistakes: 0,
    },
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.cards)) return initial;
    const cards = parsed.cards.map(normalizeCardRecord);
    return {
      ...initial,
      ...parsed,
      cards,
      stats: rolloverToday({ ...initial.stats, ...parsed.stats }),
    };
  } catch {
    return initial;
  }
}

function normalizeSubject(subject) {
  if (subject === "英単語" || subject === "英文法") return "英語";
  return SUBJECTS.includes(subject) ? subject : "未設定";
}

function normalizeCardRecord(card) {
  const createdAt = card.createdAt || new Date().toISOString();
  return {
    ...card,
    subject: normalizeSubject(card.subject || "未設定"),
    mistakes: Number.isFinite(card.mistakes) ? card.mistakes : 0,
    correctStreak: Number.isFinite(card.correctStreak) ? card.correctStreak : 0,
    interval: Number.isFinite(card.interval) ? card.interval : 0,
    createdAt,
    updatedAt: card.updatedAt || createdAt,
  };
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

function detectSubjectLine(line) {
  const heading = line.match(/^#{1,6}\s+(.+)/);
  if (heading) return normalizeSubject(cleanMarkdown(heading[1]));

  const label = line.match(/^(?:科目|教科|subject)\s*[:：]\s*(.+)$/i);
  if (label) return normalizeSubject(cleanMarkdown(label[1]));

  const bracket = line.match(/^[【\[](.+)[】\]]$/);
  if (bracket) return normalizeSubject(cleanMarkdown(bracket[1]));

  return normalizeSubject(cleanMarkdown(line));
}

function makeCard(front, back, subject = state.selectedSubject, source = "手入力") {
  const prompt = cleanMarkdown(front);
  const answer = cleanMarkdown(back);
  const now = new Date().toISOString();
  return {
    id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    subject: normalizeSubject(subject || "未設定"),
    prompt,
    answer,
    detail: answer,
    source,
    mistakes: 0,
    correctStreak: 0,
    interval: 0,
    dueAt: TODAY,
    createdAt: now,
    updatedAt: now,
    lastReviewedAt: "",
  };
}

function parseMarkdown(rawText, fallbackSubject) {
  const lines = rawText.split(/\r?\n/);
  const cards = [];
  let section = fallbackSubject || "未設定";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const lineSubject = detectSubjectLine(line);
    if (lineSubject !== "未設定") {
      section = lineSubject;
      continue;
    }

    const body = cleanMarkdown(line.replace(/^[-*+]\s+/, "").replace(/^\d+[.)]\s+/, ""));
    if (body.length < 3) continue;

    const pair = body.match(/^(.{1,80}?)(?:\s*[:：]\s*|\s+-\s+)(.{1,})$/);
    if (pair) {
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

function warnIfMostlyUnset(cards) {
  if (!cards.length) return;
  const unsetCount = cards.filter((card) => card.subject === "未設定").length;
  if (unsetCount >= Math.max(3, Math.ceil(cards.length * 0.5))) {
    window.setTimeout(() => {
      showInfo(`科目が読み取れない単語カードが${unsetCount}枚あります。AI出力の科目見出しが「# 英語」の形になっているか確認してください。`);
    }, 120);
  }
}

function dueCards() {
  return state.data.cards.filter((card) => card.dueAt <= TODAY);
}

function weakCards() {
  return [...state.data.cards].filter((card) => card.mistakes > 0).sort((a, b) => b.mistakes - a.mistakes);
}

function cardsBySubject(subject) {
  return state.data.cards.filter((card) => card.subject === subject);
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

function editCard(cardId) {
  const card = state.data.cards.find((item) => item.id === cardId);
  if (!card) return;
  editingCardId = cardId;
  els.editSubject.innerHTML = SUBJECTS.map(
    (subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`,
  ).join("");
  els.editSubject.value = normalizeSubject(card.subject);
  els.editFront.value = card.prompt;
  els.editBack.value = card.answer;
  els.editPanel.classList.remove("hidden");
  window.setTimeout(() => els.editFront.focus(), 80);
}

function closeEditPanel() {
  editingCardId = "";
  els.editPanel.classList.add("hidden");
}

function saveEditedCard() {
  const card = state.data.cards.find((item) => item.id === editingCardId);
  if (!card) return closeEditPanel();

  const nextPrompt = cleanMarkdown(els.editFront.value);
  const nextAnswer = cleanMarkdown(els.editBack.value);
  if (!nextPrompt || !nextAnswer) return showToast("表と裏を入力してください");

  card.prompt = nextPrompt;
  card.answer = nextAnswer;
  card.detail = nextAnswer;
  card.subject = normalizeSubject(els.editSubject.value);
  card.updatedAt = new Date().toISOString();
  saveData();
  closeEditPanel();
  renderAll();
  showToast("単語カードを編集しました");
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
  renderManagerControls();
  renderTraining();
  renderCardManager();
  renderWeakList();
  renderRecords();
}

function renderToday() {
  const due = dueCards();
  const done = state.data.stats.todayCorrect;
  const total = done + due.length;
  const progress = total ? Math.min(100, Math.round((done / total) * 100)) : 100;
  const level = Math.floor(state.data.stats.xp / 100) + 1;
  els.dueCount.textContent = String(due.length);
  els.progressDone.textContent = String(done);
  els.progressTotal.textContent = String(total);
  els.level.textContent = String(level);
  els.xp.textContent = String(state.data.stats.xp);
  els.bestCombo.textContent = String(state.data.stats.bestCombo);
  els.xpBar.style.width = `${progress}%`;

  const grouped = groupBySubject(state.data.cards);
  if (!state.data.cards.length) {
    els.todaySubjects.innerHTML = '<div class="empty">まずは「単語カード作成/管理」から単語カードを追加します。</div>';
    return;
  }

  els.todaySubjects.innerHTML = Object.entries(grouped)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([subject, cards]) => {
      const dueCount = cards.filter((card) => card.dueAt <= TODAY).length;
      return `
        <button class="subject-tile subject-start" type="button" data-start-subject="${escapeHtml(subject)}">
          <strong>${escapeHtml(subject)}</strong>
          <span>単語カード${cards.length}枚 / 今日${dueCount}枚</span>
        </button>
      `;
    })
    .join("");
}

function renderSubjectPicker() {
  els.subjectPicker.innerHTML = SUBJECTS.map(
    (subject) =>
      `<button class="subject-choice ${subject === state.selectedSubject ? "active" : ""}" type="button" data-subject="${escapeHtml(subject)}">${escapeHtml(subject)}</button>`,
  ).join("");
}

function renderManagerControls() {
  const selected = els.managerSubject.value || "全科目";
  els.managerSubject.innerHTML = ["全科目", ...SUBJECTS]
    .map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`)
    .join("");
  els.managerSubject.value = [...SUBJECTS, "全科目"].includes(selected) ? selected : "全科目";
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
  const query = normalize(els.managerSearch.value);
  const selectedSubject = els.managerSubject.value || "全科目";
  const sortMode = els.managerSort.value || "created-desc";
  const cards = state.data.cards
    .filter((card) => selectedSubject === "全科目" || card.subject === selectedSubject)
    .filter((card) => {
      if (!query) return true;
      return normalize(`${card.subject} ${card.prompt} ${card.answer}`).includes(query);
    })
    .sort((a, b) => {
      const leftCreated = new Date(a.createdAt || 0).getTime();
      const rightCreated = new Date(b.createdAt || 0).getTime();
      const leftUpdated = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const rightUpdated = new Date(b.updatedAt || b.createdAt || 0).getTime();
      if (sortMode === "created-asc") return leftCreated - rightCreated;
      if (sortMode === "updated-desc") return rightUpdated - leftUpdated;
      if (sortMode === "updated-asc") return leftUpdated - rightUpdated;
      return rightCreated - leftCreated;
    });

  if (!state.data.cards.length) {
    els.cardManager.innerHTML = '<div class="empty">まだ単語カードはありません。</div>';
    return;
  }

  if (!cards.length) {
    els.cardManager.innerHTML = '<div class="empty">条件に合う単語カードがありません。</div>';
    return;
  }

  els.cardManager.innerHTML = cards
    .map(
      (card) => `
        <article class="list-item manage-item">
          <button class="manage-body" type="button" data-edit-card="${escapeHtml(card.id)}">
            <span class="subject-badge">${escapeHtml(card.subject)}</span>
            <strong>${escapeHtml(card.prompt)}</strong>
            <p>${escapeHtml(card.answer)}</p>
            <small>追加日 ${formatDate(card.createdAt)} / 最終編集日 ${formatDate(card.updatedAt || card.createdAt)}</small>
          </button>
          <button class="small-danger" type="button" data-delete-card="${escapeHtml(card.id)}">削除</button>
        </article>
      `,
    )
    .join("");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
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
  els.masteredCards.textContent = String(masteredCards().length);
  els.todayCorrect.textContent = String(state.data.stats.todayCorrect);
  els.todayMistakes.textContent = String(state.data.stats.todayMistakes);
  els.totalReviews.textContent = String(state.data.stats.totalReviews);
  els.totalStudyTime.textContent = formatStudyTime(currentStudySeconds());

  const grouped = groupBySubject(state.data.cards);
  if (!state.data.cards.length) {
    els.subjectStats.innerHTML = '<div class="empty">記録は単語カード追加後に表示されます。</div>';
    return;
  }

  els.subjectStats.innerHTML = Object.entries(grouped)
    .map(([subject, cards]) => {
      const mastered = cards.filter(isMasteredCard).length;
      const notMastered = cards.length - mastered;
      const due = cards.filter((card) => card.dueAt <= TODAY).length;
      return `
        <article class="list-item record-subject-item">
          <div>
            <strong>${escapeHtml(subject)}</strong>
            <p>単語カード${cards.length}枚 / 今日${due}枚</p>
          </div>
          <div class="record-status" aria-label="${escapeHtml(subject)}の習得状況">
            <div class="record-status-row mastered"><span>覚えた</span><strong>${mastered}枚</strong></div>
            <div class="record-status-row pending"><span>まだ</span><strong>${notMastered}枚</strong></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function isMasteredCard(card) {
  return card.mistakes > 0 && card.correctStreak >= 2;
}

function masteredCards() {
  return state.data.cards.filter(isMasteredCard);
}

function currentStudySeconds() {
  const saved = Number(state.data.stats.totalStudySeconds) || 0;
  if (!studyTickStartedAt || document.visibilityState !== "visible") return saved;
  return saved + Math.floor(Math.max(0, Date.now() - studyTickStartedAt) / 1000);
}

function accrueStudyTime() {
  if (!studyTickStartedAt) return;
  const now = Date.now();
  const seconds = Math.floor(Math.max(0, now - studyTickStartedAt) / 1000);
  if (seconds > 0) {
    state.data.stats.totalStudySeconds = (Number(state.data.stats.totalStudySeconds) || 0) + seconds;
    studyTickStartedAt = now;
  }
}

function formatStudyTime(seconds) {
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours}時間${restMinutes}分` : `${hours}時間`;
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

function showInfo(message) {
  els.infoPop.textContent = message;
  els.infoPop.classList.remove("hidden");
  window.clearTimeout(showInfo.timer);
  showInfo.timer = window.setTimeout(() => els.infoPop.classList.add("hidden"), 4200);
}

function getAudioContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  audioContext = audioContext || new AudioCtor();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playTone(frequency, start, duration, type = "sine", gainValue = 0.08) {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime + start);
  gain.gain.setValueAtTime(0.0001, context.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(gainValue, context.currentTime + start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(context.currentTime + start);
  oscillator.stop(context.currentTime + start + duration + 0.02);
}

function playNoise(start, duration, gainValue = 0.04) {
  const context = getAudioContext();
  if (!context) return;
  const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(gainValue, context.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + duration);
  source.connect(gain);
  gain.connect(context.destination);
  source.start(context.currentTime + start);
}

function playResultSound(type) {
  if (type === "correct") {
    playTone(523.25, 0, 0.12, "triangle", 0.07);
    playTone(659.25, 0.08, 0.13, "triangle", 0.08);
    playTone(783.99, 0.17, 0.18, "triangle", 0.09);
    return;
  }
  playTone(220, 0, 0.18, "sawtooth", 0.055);
  playTone(164.81, 0.14, 0.24, "sawtooth", 0.045);
}

function playMilestoneSound(type) {
  if (type === "combo") {
    playTone(659.25, 0, 0.1, "square", 0.06);
    playTone(880, 0.09, 0.12, "square", 0.06);
    playNoise(0.02, 0.12, 0.015);
    return;
  }
  playTone(392, 0, 0.1, "triangle", 0.06);
  playTone(523.25, 0.08, 0.11, "triangle", 0.07);
  playTone(783.99, 0.18, 0.18, "triangle", 0.08);
}

function noteFromDegree(root, degree, octave = 1) {
  const major = [0, 2, 4, 5, 7, 9, 11, 12];
  return root * 2 ** ((major[degree % major.length] + 12 * octave) / 12);
}

function triggerMilestone(type, text) {
  playMilestoneSound(type);
  els.milestoneEffect.className = `milestone-effect show ${type}`;
  els.milestoneEffect.innerHTML = `<strong>${escapeHtml(text)}</strong>`;
  window.clearTimeout(triggerMilestone.timer);
  triggerMilestone.timer = window.setTimeout(() => {
    els.milestoneEffect.className = "milestone-effect";
    els.milestoneEffect.innerHTML = "";
  }, 900);
}

function maybeTriggerMilestones(previousScore, combo, score) {
  if (combo >= 3 && (combo === 3 || combo % 5 === 0)) {
    triggerMilestone("combo", `${combo} COMBO`);
  }

  const previousBucket = Math.floor(previousScore / 100);
  const currentBucket = Math.floor(score / 100);
  if (currentBucket > previousBucket) {
    window.setTimeout(() => triggerMilestone("score", `${currentBucket * 100} SCORE`), 260);
  }
}

function playBgmStep() {
  if (!bgmEnabled) return;
  const roots = [261.63, 293.66, 329.63, 392, 440];
  const progressions = [
    [0, 4, 3, 4, 0, 2, 3, 4],
    [0, 3, 4, 2, 0, 4, 1, 3],
    [3, 4, 0, 2, 3, 1, 4, 0],
    [0, 2, 4, 1, 3, 4, 2, 0],
  ];
  const melodies = [
    [0, 2, 4, 5, 4, 2, 7, 5],
    [4, 5, 7, 9, 7, 5, 4, 2],
    [7, 5, 4, 2, 0, 2, 4, 5],
    [2, 4, 5, 7, 9, 7, 5, 4],
  ];
  const beat = bgmStep % 8;
  const bar = Math.floor(bgmStep / 8);
  const section = Math.floor(bar / 16);
  const progression = progressions[section % progressions.length];
  const melody = melodies[(section + Math.floor(bar / 4)) % melodies.length];
  const root = roots[(progression[bar % progression.length] + section) % roots.length];
  const swing = section % 2 === 0 ? 0 : 0.035;
  const leadGain = 0.012 + (section % 4) * 0.002;

  if (beat === 0 || beat === 4) playTone(root / 2, 0, 0.36, "sine", 0.012);
  if (beat % 2 === 0) playTone(noteFromDegree(root, melody[beat], 1), swing, 0.18, "triangle", leadGain);
  if ((bar + section) % 3 === 0 && beat === 6) playTone(noteFromDegree(root, melody[(beat + 2) % 8], 2), 0, 0.12, "sine", 0.008);
  if (beat === 2 || beat === 6) playNoise(0, 0.045, 0.006);
  if (section % 3 === 2 && beat % 4 === 1) playTone(noteFromDegree(root, 7, 1), 0, 0.08, "square", 0.006);
  bgmStep += 1;
}

function startBgm() {
  bgmEnabled = true;
  els.toggleBgm.classList.add("active");
  playBgmStep();
  window.clearInterval(bgmTimer);
  bgmTimer = window.setInterval(playBgmStep, 360);
}

function stopBgm() {
  bgmEnabled = false;
  els.toggleBgm.classList.remove("active");
  window.clearInterval(bgmTimer);
}

function toggleBgm() {
  if (bgmEnabled) {
    stopBgm();
    return;
  }
  startBgm();
}

function triggerResultEffect(type, detail) {
  playResultSound(type);

  els.trainingCard.classList.remove("result-correct", "result-wrong");
  void els.trainingCard.offsetWidth;
  els.trainingCard.classList.add(type === "correct" ? "result-correct" : "result-wrong");

  const bits =
    type === "correct"
      ? Array.from({ length: 18 }, (_, index) => `<i class="burst-bit bit-${index % 6}"></i>`).join("")
      : '<i class="sad-ring"></i><i class="sad-ring delay"></i>';
  els.resultEffect.className = `result-effect show ${type}`;
  els.resultEffect.innerHTML = `
    <div class="result-badge">
      ${bits}
      <strong>${type === "correct" ? "やった！" : "残念"}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `;
  window.clearTimeout(triggerResultEffect.timer);
  triggerResultEffect.timer = window.setTimeout(() => {
    els.resultEffect.className = "result-effect";
    els.resultEffect.innerHTML = "";
  }, 2300);
}

function clearResultEffect() {
  window.clearTimeout(triggerResultEffect.timer);
  els.resultEffect.className = "result-effect";
  els.resultEffect.innerHTML = "";
}

els.navItems.forEach((item) => {
  item.addEventListener("click", () => showView(item.dataset.view));
});

els.createSectionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const panelId = button.dataset.createSection;
    els.createSectionButtons.forEach((item) => item.classList.toggle("active", item === button));
    els.createPanels.forEach((panel) => panel.classList.toggle("active", panel.id === panelId));
  });
});

els.createModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const modeId = button.dataset.createMode;
    els.createModeButtons.forEach((item) => item.classList.toggle("active", item === button));
    els.createModes.forEach((mode) => mode.classList.toggle("active", mode.id === modeId));
  });
});

els.todaySubjects.addEventListener("click", (event) => {
  const button = event.target.closest("[data-start-subject]");
  if (!button) return;
  const subject = button.dataset.startSubject;
  const subjectCards = cardsBySubject(subject);
  const dueSubjectCards = subjectCards.filter((card) => card.dueAt <= TODAY);
  const cards = dueSubjectCards.length ? dueSubjectCards : subjectCards;
  if (!cards.length) return showToast("この科目の単語カードがありません");
  startSession(cards, `${subject}を覚える`);
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
    const previousScore = state.session.score;
    applyCorrect(card);
    state.session.awaitingNext = true;
    els.feedback.className = "feedback good";
    els.feedback.textContent = `正解。${card.answer}`;
    els.combo.textContent = String(state.session.combo);
    els.score.textContent = `Score ${state.session.score}`;
    els.answer.disabled = true;
    els.hint.disabled = true;
    els.skip.textContent = "次へ進む";
    renderToday();
    renderWeakList();
    renderRecords();
    triggerResultEffect("correct", `${state.session.combo} Combo`);
    maybeTriggerMilestones(previousScore, state.session.combo, state.session.score);
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
  triggerResultEffect("wrong", "もう一度出ます");
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
    clearResultEffect();
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
  triggerResultEffect("wrong", "確認して次へ");
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
  if (!front || !back) return showToast("表と裏を入力してください");
  addCards(dedupeNewCards([makeCard(front, back)]));
  els.manualFront.value = "";
  els.manualBack.value = "";
  els.manualFront.focus();
});

els.importBulk.addEventListener("click", () => {
  const cards = parseMarkdown(els.bulkText.value, state.selectedSubject);
  warnIfMostlyUnset(cards);
  addCards(cards);
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
  const deleteButton = event.target.closest("[data-delete-card]");
  if (deleteButton) {
    deleteCard(deleteButton.dataset.deleteCard);
    return;
  }
  const editButton = event.target.closest("[data-edit-card]");
  if (!editButton) return;
  editCard(editButton.dataset.editCard);
});

els.deleteAllCards.addEventListener("click", deleteAllCards);
els.managerSearch.addEventListener("input", renderCardManager);
els.managerSubject.addEventListener("change", renderCardManager);
els.managerSort.addEventListener("change", renderCardManager);
els.toggleBgm.addEventListener("click", toggleBgm);
els.levelInfo.addEventListener("click", () => {
  showInfo("Levelは累計XPから決まります。100XPたまるごとにLevelが1つ上がります。");
});
els.xpInfo.addEventListener("click", () => {
  showInfo("XPは正解すると増える経験値です。続けるほどLevelが上がります。");
});
els.saveEdit.addEventListener("click", saveEditedCard);
els.cancelEdit.addEventListener("click", closeEditPanel);
els.editPanel.addEventListener("click", (event) => {
  if (event.target === els.editPanel) closeEditPanel();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    accrueStudyTime();
    saveData();
    return;
  }
  studyTickStartedAt = Date.now();
  renderRecords();
});

window.addEventListener("beforeunload", () => {
  accrueStudyTime();
  saveData();
});

window.setInterval(() => {
  if (document.visibilityState !== "visible") return;
  accrueStudyTime();
  saveData();
  renderRecords();
}, 30000);

els.resetData.addEventListener("click", () => {
  const ok = window.confirm("単語カードと記録をすべて削除しますか？");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  state.data = loadData();
  state.session = { ids: [], answered: 0, mode: "今日の復習", score: 0, combo: 0, awaitingNext: false };
  studyTickStartedAt = Date.now();
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
