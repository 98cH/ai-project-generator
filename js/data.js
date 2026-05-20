const apiKey = "AIzaSyDs4mvVMvmtvP7y3AEZfs4yUrKeIu0_jDc"; // Kendi Google Gemini API Anahtarını Buraya Eklemelisin

let currentLang = "tr";
let selEqfIdx = -1;
let selSubjects = new Set();

function t(key) { return TRANSLATIONS[currentLang][key]; }

function switchLanguage(lang) {
  currentLang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => { el.innerHTML = t(el.getAttribute("data-i18n")); });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.getAttribute("data-i18n-ph")); });
  buildEqfGrid();
  buildSubjectGrid();
}

function buildEqfGrid() {
  const grid = document.getElementById("eqfGrid");
  grid.innerHTML = "";
  t("eqfLevels").forEach((lvl, idx) => {
    const btn = document.createElement("button");
    btn.className = "eqf-btn" + (selEqfIdx === idx ? " sel" : "");
    btn.innerHTML = `<span>${lvl.t}</span><small>${lvl.s}</small>`;
    btn.onclick = () => { selEqfIdx = idx; buildEqfGrid(); };
    grid.appendChild(btn);
  });
}

function buildSubjectGrid() {
  const grid = document.getElementById("subjGrid");
  grid.innerHTML = "";
  const subjs = TRANSLATIONS[currentLang].subjects;
  Object.keys(subjs).forEach(key => {
    const isSel = selSubjects.has(key);
    const pill = document.createElement("div");
    pill.className = "subj-pill" + (isSel ? " sel" : "");
    pill.innerHTML = `<span class="subj-icon">${SUBJECT_ICONS[key]}</span>${subjs[key]}`;
    pill.onclick = () => {
      if (isSel) { selSubjects.delete(key); }
      else {
        if(selSubjects.size >= 5) { showError(t("err_max")); setTimeout(clearError, 3000); return; }
        selSubjects.add(key);
      }
      buildSubjectGrid(); updateSubjHint();
    };
    grid.appendChild(pill);
  });
  updateSubjHint();
}

function updateSubjHint() {
  const count = selSubjects.size;
  document.getElementById("subjCountHint").textContent = count === 0 ? t("step2_hint_def") : `(${count} ${t("step2_hint_sel")})`;
}

// Başlangıç Yüklemesi
switchLanguage("tr");

// ── Yapay Zeka Prompt Fonksiyonları ──
function getSystemPrompt() {
  const targetLang = TRANSLATIONS[currentLang].prompt_lang;
  return `You are an elite Interdisciplinary Education Designer, a specialist in the European Qualifications Framework (EQF), and an expert in JSON data structuring.

Your singular task is to generate a highly creative, personalized project-based learning module that strictly adheres to the provided EQF Level and perfectly integrates all provided subjects.

## CRITICAL HACKATHON RULES
1. CURRICULUM CONTEXT (MANDATORY): You will be provided with specific academic core topics for each selected subject. YOU MUST design the project around these specific academic topics. Do not invent unrelated topics. Your goal is to teach these exact concepts.
2. CREATIVE INTEGRATION: You must combine ALL provided subjects into a single, cohesive, and logical project scenario, even if they seem completely unrelated.
3. ALGORITHMIC VALIDATION (FEEDBACK LOOP): For the system to algorithmically validate your output, you MUST provide EXACTLY OR MORE THAN 2 concrete, measurable learning outcomes for EACH subject.
4. EQF ALIGNMENT: The project's complexity must perfectly match the provided EQF Level (from 1 to 4) across three dimensions:
   - Knowledge (Theoretical depth)
   - Skills (Cognitive and practical problem-solving)
   - Responsibility & Autonomy (The degree of student independence)

## OUTPUT FORMAT — STRICT JSON
You are an API endpoint. You MUST respond with ONLY a valid, raw JSON object.
DO NOT include markdown formatting like \`\`\`json. DO NOT add any conversational text before or after the JSON.
All string values inside the JSON MUST be written strictly in ${targetLang}.

Follow this exact schema:
{
  "project_title": "string",
  "project_description": "string",
  "eqf_alignment": {
    "assigned_level": "string",
    "knowledge_requirement": "string",
    "skills_requirement": "string",
    "autonomy_expectation": "string"
  },
  "target_learning_outcomes": {
    "[Exact Subject Name 1]": ["Outcome 1", "Outcome 2"],
    "[Exact Subject Name 2]": ["Outcome 1", "Outcome 2"]
  },
  "project_duration": "string",
  "required_materials": ["string", "string"],
  "step_by_step_plan": [
    {
      "step": 1,
      "title": "string",
      "description": "string",
      "duration": "string",
      "subjects_covered": ["Subject 1", "Subject 2"]
    }
  ],
  "final_output": "string",
  "presentation_idea": "string",
  "evaluation_criteria": ["string"],
  "extension_ideas": "string"
}`;
}

function buildPrompt(eqfLabel, subjectLabels, selectedKeys, interests, prevProject, prevFeedback) {
  let retryNote = "";
  if (prevProject && prevFeedback) {
    retryNote = `\nCRITICAL: Previous project failed validation. Missing subjects: ${prevFeedback.missing.join(", ")}. Create a COMPLETELY NEW concept ensuring these subjects have >=2 outcomes in target_learning_outcomes AND appear in subjects_covered of >=2 steps.\n`;
  }

  let curriculumContext = "ACADEMIC TOPICS TO INCLUDE:\n";
  selectedKeys.forEach(key => {
      curriculumContext += `- For ${TRANSLATIONS[currentLang].subjects[key]}: Use concepts like [${CURRICULUM_TOPICS[key]}]\n`;
  });

  return `Student Info:\n- Target EQF Level: ${eqfLabel}\n- Subjects: ${subjectLabels.join(", ")}\n- Interests: ${interests || "None specified"}\n\n${curriculumContext}\n${retryNote}`;
}

function validate(project, subjectLabels) {
  const outcomes = project.target_learning_outcomes || {};
  const keys = Object.keys(outcomes);
  let missing = [];

  subjectLabels.forEach(subj => {
    const word = subj.toLowerCase().split(/[\s/]/)[0];
    const match = keys.find(k => k.toLowerCase().includes(word) || word.includes(k.toLowerCase().split(/[\s/]/)[0]));
    if (!match || (outcomes[match] || []).length < 2) {
      missing.push(subj);
    }
  });

  const steps = project.step_by_step_plan || [];
  const stepMiss = subjectLabels.filter(subj => {
    const word = subj.toLowerCase().split(/[\s/]/)[0];
    const count = steps.filter(s =>
      (s.subjects_covered || []).some(sc => sc.toLowerCase().includes(word) || word.includes(sc.toLowerCase().split(/[\s/]/)[0]))
    ).length;
    return count < 2;
  });

  const allMissing = [...new Set([...missing, ...stepMiss])];
  const outRate = subjectLabels.length > 0 ? subjectLabels.filter(s => !missing.includes(s)).length / subjectLabels.length : 1;
  const stepRate = subjectLabels.length > 0 ? subjectLabels.filter(s => !stepMiss.includes(s)).length / subjectLabels.length : 1;
  const rate = Math.round((outRate * 0.6 + stepRate * 0.4) * 100);
  const passed = rate >= 50;
  return { rate, missing: allMissing, passed };
}

async function callGemini(prompt) {
  // Daha hızlı çalışması için 1.5-flash tavsiye edilir
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: getSystemPrompt() }] },
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, responseMimeType: "application/json" }
  };
  const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message || `HTTP ${res.status}`); }
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  try { return JSON.parse(raw); } catch { throw new Error("JSON Parse Error"); }
}

async function generate() {
  clearError();
  if (selEqfIdx === -1) return showError(t("err_eqf"));
  if (selSubjects.size < 1) return showError(t("err_subj"));

  const btn = document.getElementById("genBtn");
  const strip = document.getElementById("loadingStrip");
  const output = document.getElementById("output");

  btn.disabled = true;
  btn.innerHTML = `<div class="spinner"></div> <span>${t("loading_msg")}...</span>`;
  strip.classList.add("show"); output.innerHTML = "";

  const eqfLabel = t("eqfLevels")[selEqfIdx].t;
  const subjectLabels = [...selSubjects].map(k => t("subjects")[k]);
  const selectedKeys = Array.from(selSubjects);
  const interests = document.getElementById("interests").value.trim();

  const MAX_TRIES = 3;
  const log = [];
  let lastProject = null;
  let lastFeedback = null;

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      strip.querySelector(".strip-msg").innerHTML = `<span>${t("out_attempt")} ${attempt}/${MAX_TRIES}</span><span class="loading-dots"></span>`;
      const prompt = buildPrompt(eqfLabel, subjectLabels, selectedKeys, interests, lastProject, lastFeedback);
      const project = await callGemini(prompt);
      const feedback = validate(project, subjectLabels);
      log.push({ attempt, rate: feedback.rate, passed: feedback.passed });
      lastProject = project; lastFeedback = feedback;
      if (feedback.passed) {
        renderResult({ project, feedback, log, maxReached: false, eqfLabel, subjectLabels, selectedKeys });
        break;
      }
      if (attempt === MAX_TRIES) {
        renderResult({ project, feedback, log, maxReached: true, eqfLabel, subjectLabels, selectedKeys });
      }
    } catch (err) {
      showError("API Error: " + err.message);
      break;
    }
  }

  btn.disabled = false;
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> <span>${t("btn_generate")}</span>`;
  strip.classList.remove("show");
}

function rateClass(r) { return r >= 70 ? "rate-high" : r >= 50 ? "rate-mid" : "rate-low"; }

function renderResult({ project, feedback, log, maxReached, eqfLabel, subjectLabels, selectedKeys }) {
  const output = document.getElementById("output");
  const logCols = log.map(l => `
    <div class="attempt-row">
      <div class="attempt-label">${t("out_attempt")} ${l.attempt}</div>
      <div class="attempt-rate ${rateClass(l.rate)}">%${l.rate}</div>
      <div class="attempt-badge ${l.passed ? "badge-pass" : "badge-fail"}">${l.passed ? t("out_pass") : t("out_fail")}</div>
    </div>`).join("");

  const eqfData = project.eqf_alignment || {};

  let topicBadges = "";
  selectedKeys.forEach(key => {
      let topics = CURRICULUM_TOPICS[key].split(',').map(t => t.trim());
      topics.slice(0, 3).forEach(t => {
          topicBadges += `<span class="curr-badge">${t}</span>`;
      });
  });

  const eqfHTML = `
    <div class="rcard eqf-card">
      <div class="rcard-title" style="margin-bottom: 20px;">
        ${t("out_eqf_title")} <span class="eqf-badge-big">${eqfData.assigned_level || eqfLabel}</span>
      </div>
      <div class="eqf-detail-grid">
        <div class="eqf-detail-col">
          <div class="eqf-col-title">🧠 ${t("eqf_know")}</div>
          <div class="eqf-col-text">${eqfData.knowledge_requirement || "N/A"}</div>
        </div>
        <div class="eqf-detail-col">
          <div class="eqf-col-title">🛠️ ${t("eqf_skill")}</div>
          <div class="eqf-col-text">${eqfData.skills_requirement || "N/A"}</div>
        </div>
        <div class="eqf-detail-col">
          <div class="eqf-col-title">🧭 ${t("eqf_auto")}</div>
          <div class="eqf-col-text">${eqfData.autonomy_expectation || "N/A"}</div>
        </div>
      </div>
      <div class="curr-badge-container">
        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); display:flex; align-items:center; margin-right: 5px;">Müfredat Uyumu:</span>
        ${topicBadges}
      </div>
    </div>
  `;

  const outcomesHTML = Object.entries(project.target_learning_outcomes || {})
    .map(([subj, items]) => `
      <div class="outcome-block">
        <div class="outcome-subject">${subj}</div>
        ${items.map(i => `<div class="outcome-item">${i}</div>`).join("")}
      </div>`).join("");

  const stepsHTML = (project.step_by_step_plan || []).map(s => `
    <div class="step-item">
      <div class="step-circle">${s.step}</div>
      <div class="step-body">
        <div class="step-title">${s.title}</div>
        <div class="step-desc">${s.description}</div>
        <div class="step-tags">
          <span class="dur-tag">⏱ ${s.duration}</span>
          ${(s.subjects_covered || []).map(tag => `<span class="subj-tag">${tag}</span>`).join("")}
        </div>
      </div>
    </div>`).join("");

  const matsHTML = (project.required_materials || []).map(m => `<span class="mat-chip">${m}</span>`).join("");
  const evalsHTML = (project.evaluation_criteria || []).map(c => `<span class="eval-chip">${c}</span>`).join("");
  const subjChips = subjectLabels.map(s => `<span class="meta-chip highlight">${s}</span>`).join("");

  output.innerHTML = `
  <div class="result-wrap">
    ${maxReached ? `<div class="warn-banner">${t("warn_max")}</div>` : ""}

    <div class="attempt-log">
      <div class="attempt-log-header"><div class="pulse-dot"></div> ${t("out_log_title")}</div>
      ${logCols}
    </div>

    <div style="display:flex; justify-content: space-between; align-items:center; flex-wrap: wrap; gap: 16px; margin-bottom: 2rem;">
      <div style="display:flex; align-items:center; gap:16px;">
        <div class="meta-chip highlight" style="border-radius:6px; font-weight:700;">✓ ${t("out_rate")}: %${feedback.rate}</div>
        <span style="font-size:13px; color:var(--text-muted);">${log.length} ${t("out_completed")}</span>
      </div>
      <button onclick="window.print()" class="pdf-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span data-i18n="out_pdf">${t("out_pdf")}</span>
      </button>
    </div>

    <div class="proj-hero">
      <div class="proj-title-label">${t("out_proj_title")}</div>
      <div class="proj-title">${project.project_title}</div>
      <div class="proj-desc">${project.project_description}</div>
      <div class="meta-row">
        <span class="meta-chip">⏱ ${project.project_duration}</span>
        ${subjChips}
      </div>
    </div>

    ${eqfHTML}

    <div class="rcard"><div class="rcard-title">${t("out_outcomes")}</div><div class="outcomes-grid">${outcomesHTML}</div></div>
    <div class="rcard"><div class="rcard-title">${t("out_plan")}</div><div class="steps-list">${stepsHTML}</div></div>

    <div class="two-col">
      <div class="rcard"><div class="rcard-title">${t("out_final")}</div><div class="rcard-text">${project.final_output}</div></div>
      <div class="rcard"><div class="rcard-title">${t("out_pres")}</div><div class="rcard-text">${project.presentation_idea}</div></div>
    </div>

    <div class="rcard"><div class="rcard-title">${t("out_mat")}</div><div class="chip-list">${matsHTML}</div></div>
    <div class="rcard"><div class="rcard-title">${t("out_eval")}</div><div class="chip-list">${evalsHTML}</div></div>
    <div class="rcard extension-card"><div class="rcard-title">${t("out_ext")}</div><div class="rcard-text">${project.extension_ideas}</div></div>
  </div>`;

  output.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showError(msg) { const box = document.getElementById("errorBox"); box.textContent = msg; box.classList.add("show"); }
function clearError() { document.getElementById("errorBox").classList.remove("show"); }
