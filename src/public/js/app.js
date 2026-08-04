let surveysData = null;
let currentSurveyId = null;
let currentStep = 0;
let sortableInstance = null;

let formData = {
  revenue_range: '',
  rankings: {}, // { factorId: rankPosition }
  ratings: {},  // { factorId: score }
  open_feedback: ''
};

// Fattori in ordine corrente per il Drag & Drop
let currentFactorOrder = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadQuestions();
  handleRouting();

  window.addEventListener('popstate', handleRouting);
});

async function loadQuestions() {
  try {
    const res = await fetch('/api/survey/questions');
    const json = await res.json();
    if (json.success) {
      surveysData = json.data;
    } else {
      showGlobalError('Impossibile caricare i dati della survey.');
    }
  } catch (err) {
    console.error('Errore durante il caricamento delle domande:', err);
    showGlobalError('Errore di connessione al server.');
  }
}

function handleRouting() {
  const path = window.location.pathname;
  if (path.includes('/vendor')) {
    startSurvey('vendor_distributori');
  } else if (path.includes('/system-integrator')) {
    startSurvey('system_integrator');
  } else if (path.includes('/admin') || path.includes('/dashboard')) {
    showAdminDashboard();
  } else {
    showLanding();
  }
}

function navigateTo(path) {
  window.history.pushState({}, '', path);
  handleRouting();
}

function showLanding() {
  currentSurveyId = null;
  document.getElementById('landing-view').classList.remove('hidden');
  document.getElementById('survey-view').classList.add('hidden');
  document.getElementById('success-view').classList.add('hidden');
  document.getElementById('admin-view').classList.add('hidden');
  const pc = document.getElementById('progress-container');
  if (pc) pc.classList.add('hidden');
}

async function showAdminDashboard() {
  document.getElementById('landing-view').classList.add('hidden');
  document.getElementById('survey-view').classList.add('hidden');
  document.getElementById('success-view').classList.add('hidden');
  document.getElementById('admin-view').classList.remove('hidden');
  const pc = document.getElementById('progress-container');
  if (pc) pc.classList.add('hidden');

  if (!surveysData) {
    await loadQuestions();
  }

  loadAdminDashboard();
}

async function loadAdminDashboard() {
  try {
    const res = await fetch('/api/survey/stats');
    const json = await res.json();

    if (!json.success) {
      console.error('Errore caricamento dashboard:', json.error);
      return;
    }

    document.getElementById('stat-total').textContent = json.totalCount;
    document.getElementById('stat-vendor').textContent = json.vendorCount;
    document.getElementById('stat-si').textContent = json.siCount;

    // Badges fatturato
    const revenueContainer = document.getElementById('revenue-breakdown-badges');
    revenueContainer.innerHTML = '';
    if (Object.keys(json.revenueBreakdown).length === 0) {
      revenueContainer.innerHTML = '<span class="text-xs text-slate-500">Nessuna risposta System Integrator ancora registrata.</span>';
    } else {
      Object.entries(json.revenueBreakdown).forEach(([rev, count]) => {
        revenueContainer.innerHTML += `
          <div class="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-2">
            <span>Fascia ${rev}:</span>
            <span class="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold">${count}</span>
          </div>
        `;
      });
    }

    // Render Visuale Totale System Integrator
    renderAggregateView('si-aggregate-container', json.siFactors, 'si');

    // Render Visuale Totale Vendor & Distributori
    renderAggregateView('vendor-aggregate-container', json.vendorFactors, 'vendor');

    // Tabella risposte
    const tbody = document.getElementById('admin-table-body');
    tbody.innerHTML = '';

    if (json.responses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500">Nessuna risposta registrata nel database.</td></tr>';
      return;
    }

    window.adminResponsesData = json.responses;

    json.responses.forEach((r, index) => {
      const typeLabel = r.survey_type === 'vendor_distributori' ? '🔷 Vendor & Distributori' : '🔶 System Integrator';
      const dateStr = new Date(r.created_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'medium' });

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50/60 transition-colors';
      tr.innerHTML = `
        <td class="p-3 font-mono text-slate-500 text-[11px]">${dateStr}</td>
        <td class="p-3 font-semibold ${r.survey_type === 'vendor_distributori' ? 'text-sky-600' : 'text-amber-600'}">${typeLabel}</td>
        <td class="p-3 text-slate-700 font-medium">${r.revenue_range || 'N/D'}</td>
        <td class="p-3 text-slate-500 italic max-w-xs truncate">${escapeHtml(r.open_feedback || '-') || '-'}</td>
        <td class="p-3 text-right">
          <button onclick="showResponseDetails(${index})" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-siec-primary font-semibold rounded-lg border border-slate-200 text-[11px]">
            Vedi Dettaglio
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Errore caricamento admin dashboard:', err);
  }
}

function renderAggregateView(containerId, factors, categoryType) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!factors || factors.length === 0) {
    container.innerHTML = '<div class="p-4 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-slate-100">Nessuna risposta registrata per questa categoria.</div>';
    return;
  }

  // Ordina i fattori per rank medio crescente (#1 prima) se disponibile
  const sortedFactors = [...factors].sort((a, b) => {
    if (a.avgRank !== null && b.avgRank !== null) return a.avgRank - b.avgRank;
    if (a.avgRank !== null) return -1;
    if (b.avgRank !== null) return 1;
    return 0;
  });

  const isSi = categoryType === 'si';
  const badgeBg = isSi ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' : 'bg-sky-500/10 text-sky-700 border-sky-500/20';
  const progressBg = isSi ? 'bg-amber-500' : 'bg-sky-500';

  let html = `
    <div class="overflow-x-auto rounded-xl border border-slate-200">
      <table class="w-full text-left text-xs text-slate-700">
        <thead class="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
          <tr>
            <th class="p-3 w-12 text-center">Pos.</th>
            <th class="p-3">Fattore & Descrizione</th>
            <th class="p-3 w-36 text-center">Rank Medio (1=max, 8=min)</th>
            <th class="p-3 w-52">Valutazione Media (1-5)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white">
  `;

  sortedFactors.forEach((f, idx) => {
    const rankDisplay = f.avgRank !== null ? `#${f.avgRank.toFixed(1)}` : 'N/D';
    const rateDisplay = f.avgRate !== null ? `${f.avgRate.toFixed(1)} / 5.0` : 'N/D';
    const ratePct = f.avgRate !== null ? Math.round((f.avgRate / 5) * 100) : 0;

    let rateBadgeColor = 'bg-slate-100 text-slate-600';
    if (f.avgRate >= 4.0) rateBadgeColor = 'bg-emerald-100 text-emerald-800 font-bold';
    else if (f.avgRate >= 3.0) rateBadgeColor = 'bg-blue-100 text-blue-800 font-bold';
    else if (f.avgRate >= 2.0) rateBadgeColor = 'bg-amber-100 text-amber-800 font-bold';
    else if (f.avgRate !== null) rateBadgeColor = 'bg-red-100 text-red-800 font-bold';

    html += `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="p-3 text-center font-bold text-slate-400 text-sm">${idx + 1}</td>
        <td class="p-3 space-y-0.5">
          <div class="font-extrabold text-siec-primary text-xs sm:text-sm">${escapeHtml(f.title)}</div>
          <div class="text-slate-500 text-[11px] leading-snug max-w-xl">${escapeHtml(f.extended || '')}</div>
        </td>
        <td class="p-3 text-center">
          <span class="inline-block px-2.5 py-1 rounded-lg border font-mono font-extrabold text-xs ${badgeBg}">
            ${rankDisplay}
          </span>
        </td>
        <td class="p-3 space-y-1">
          <div class="flex items-center justify-between">
            <span class="px-2 py-0.5 rounded text-[11px] ${rateBadgeColor}">${rateDisplay}</span>
            <span class="text-[10px] text-slate-400 font-bold">${ratePct}%</span>
          </div>
          <div class="w-full bg-slate-150 h-2 rounded-full overflow-hidden bg-slate-100">
            <div class="${progressBg} h-full transition-all duration-500 rounded-full" style="width: ${ratePct}%"></div>
          </div>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
}

function showResponseDetails(index) {
  const r = window.adminResponsesData && window.adminResponsesData[index];
  if (!r) return;

  const modal = document.getElementById('detail-modal');
  const content = document.getElementById('modal-content');

  const typeLabel = r.survey_type === 'vendor_distributori' ? '🔷 Vendor & Distributori' : '🔶 System Integrator';
  const surveyDef = surveysData ? surveysData[r.survey_type] : null;

  const rankings = typeof r.rankings === 'string' ? JSON.parse(r.rankings) : r.rankings;
  const ratings = typeof r.ratings === 'string' ? JSON.parse(r.ratings) : r.ratings;

  let factorsHTML = '';
  if (surveyDef && surveyDef.factors) {
    factorsHTML = surveyDef.factors.map(f => {
      const pos = rankings[f.id] || 'N/D';
      const score = ratings[f.id] || 'N/D';
      return `
        <div class="p-3 bg-slate-900/80 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <div class="font-bold text-slate-200">${f.title}</div>
            <div class="text-[10px] text-slate-400">${f.extended}</div>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span class="px-2 py-1 bg-sky-950 text-sky-300 rounded font-mono font-bold">Posizione #${pos}</span>
            <span class="px-2 py-1 bg-blue-950 text-blue-300 rounded font-mono font-bold">Voto ${score}/5</span>
          </div>
        </div>
      `;
    }).join('');
  } else {
    factorsHTML = `
      <pre class="bg-slate-900 p-3 rounded text-xs font-mono text-slate-300 overflow-x-auto">Rankings: ${JSON.stringify(rankings, null, 2)}</pre>
      <pre class="bg-slate-900 p-3 rounded text-xs font-mono text-slate-300 overflow-x-auto">Ratings: ${JSON.stringify(ratings, null, 2)}</pre>
    `;
  }

  content.innerHTML = `
    <div class="grid grid-cols-2 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
      <div>
        <span class="text-xs text-slate-400 block">ID Risposta:</span>
        <span class="font-mono text-xs font-bold text-slate-200">${r.id}</span>
      </div>
      <div>
        <span class="text-xs text-slate-400 block">Data / Ora UTC:</span>
        <span class="font-mono text-xs font-bold text-slate-200">${new Date(r.created_at).toLocaleString('it-IT')}</span>
      </div>
      <div>
        <span class="text-xs text-slate-400 block">Profilo Survey:</span>
        <span class="font-bold text-xs text-sky-400">${typeLabel}</span>
      </div>
      <div>
        <span class="text-xs text-slate-400 block">Fascia Fatturato:</span>
        <span class="font-bold text-xs text-slate-200">${r.revenue_range || 'N/A (Vendor)'}</span>
      </div>
    </div>

    <div class="space-y-2">
      <h4 class="font-bold text-sm text-slate-200">Dettaglio Valutazioni (Ranking & Rating)</h4>
      <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
        ${factorsHTML}
      </div>
    </div>

    ${r.open_feedback ? `
      <div class="space-y-1">
        <h4 class="font-bold text-sm text-slate-200">Feedback Aperto</h4>
        <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 italic text-slate-300 text-xs">${escapeHtml(r.open_feedback)}</div>
      </div>
    ` : ''}
  `;

  if (modal) modal.classList.remove('hidden');
}

function closeDetailModal() {
  const modal = document.getElementById('detail-modal');
  if (modal) modal.classList.add('hidden');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function startSurvey(surveyId) {
  if (!surveysData || !surveysData[surveyId]) {
    setTimeout(() => startSurvey(surveyId), 200);
    return;
  }

  currentSurveyId = surveyId;
  const survey = surveysData[surveyId];

  // Inizializza formData
  formData = {
    revenue_range: '',
    rankings: {},
    ratings: {},
    open_feedback: ''
  };

  // Inizializza l'ordine di default dei fattori (1..8)
  currentFactorOrder = [...survey.factors];

  // Inizializza ratings vuoti
  survey.factors.forEach(f => {
    formData.ratings[f.id] = null;
  });

  // Step iniziale
  currentStep = survey.hasSegmentation ? 0 : 1;

  document.getElementById('landing-view').classList.add('hidden');
  document.getElementById('success-view').classList.add('hidden');
  document.getElementById('admin-view').classList.add('hidden');
  document.getElementById('survey-view').classList.remove('hidden');

  const progressContainer = document.getElementById('progress-container');
  if (progressContainer) progressContainer.classList.remove('hidden');

  document.getElementById('survey-title').textContent = survey.title;
  document.getElementById('survey-intro').textContent = survey.intro;

  renderStep();
}

function renderStep() {
  const survey = surveysData[currentSurveyId];
  const maxStep = 3; // 0: Segmentazione, 1: Ranking, 2: Rating, 3: Feedback
  const minStep = survey.hasSegmentation ? 0 : 1;

  // Calcolo progresso
  const totalSteps = survey.hasSegmentation ? 4 : 3;
  const currentStepNum = survey.hasSegmentation ? currentStep + 1 : currentStep;
  const progressPercentage = Math.round((currentStepNum / totalSteps) * 100);

  const progressBar = document.getElementById('progress-bar');
  if (progressBar) progressBar.style.width = `${progressPercentage}%`;
  document.getElementById('step-indicator').textContent = `Passo ${currentStepNum} di ${totalSteps}`;

  // Nascondi tutti i contenitori di step
  document.querySelectorAll('.step-container').forEach(el => el.classList.add('hidden'));

  // Gestione bottoni di navigazione
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnSubmit = document.getElementById('btn-submit');

  if (currentStep === minStep) {
    btnPrev.classList.add('hidden');
  } else {
    btnPrev.classList.remove('hidden');
  }

  if (currentStep === maxStep) {
    btnNext.classList.add('hidden');
    btnSubmit.classList.remove('hidden');
  } else {
    btnNext.classList.remove('hidden');
    btnSubmit.classList.add('hidden');
  }

  // Render dello step specifico
  if (currentStep === 0) {
    renderStep0(survey);
  } else if (currentStep === 1) {
    renderStep1(survey);
  } else if (currentStep === 2) {
    renderStep2(survey);
  } else if (currentStep === 3) {
    renderStep3(survey);
  }
}

// STEP 0: Segmentazione (solo SI)
function renderStep0(survey) {
  const container = document.getElementById('step-0-container');
  container.classList.remove('hidden');

  document.getElementById('revenue-prompt').textContent = survey.revenuePrompt;
  const optionsGrid = document.getElementById('revenue-options');
  optionsGrid.innerHTML = '';

  survey.revenueOptions.forEach(opt => {
    const isSelected = formData.revenue_range === opt;
    const card = document.createElement('div');
    card.className = `p-5 rounded-xl border cursor-pointer text-center font-bold text-base sm:text-lg transition-all ${
      isSelected
        ? 'bg-sky-50 border-siec-primary text-siec-primary shadow-md ring-2 ring-siec-primary'
        : 'bg-white border-slate-200 hover:border-siec-accent text-siec-textPrimary hover:bg-slate-50 shadow-sm'
    }`;
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span>${opt}</span>
        <div class="w-6 h-6 rounded-full border-2 ${isSelected ? 'border-siec-primary bg-siec-primary text-white' : 'border-slate-300'} flex items-center justify-center font-bold text-xs">
          ${isSelected ? '✓' : ''}
        </div>
      </div>
    `;
    card.onclick = () => {
      formData.revenue_range = opt;
      renderStep0(survey);
      document.getElementById('step-error').classList.add('hidden');
    };
    optionsGrid.appendChild(card);
  });
}

// STEP 1: Ranking Drag & Drop
function renderStep1(survey) {
  const container = document.getElementById('step-1-container');
  container.classList.remove('hidden');

  const listEl = document.getElementById('ranking-list');
  listEl.innerHTML = '';

  currentFactorOrder.forEach((factor, index) => {
    const rankNumber = index + 1;
    const item = document.createElement('div');
    item.className = 'sortable-item flex items-start gap-4 p-4 rounded-xl bg-white border border-slate-200 cursor-grab hover:border-siec-accent shadow-sm';
    item.dataset.id = factor.id;

    item.innerHTML = `
      <div class="position-badge">
        ${rankNumber}
      </div>
      <div class="flex-1">
        <h4 class="font-extrabold text-siec-primary text-base leading-snug">${factor.title}</h4>
        <p class="text-xs text-siec-textSecondary mt-1 leading-relaxed">${factor.extended}</p>
      </div>
      <div class="drag-handle text-slate-400 hover:text-siec-accent p-1 shrink-0 flex items-center justify-center h-full my-auto">
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 5a1 1 0 100-2 1 1 0 000 2zm0 8a1 1 0 100-2 1 1 0 000 2zm0 8a1 1 0 100-2 1 1 0 000 2zm6-16a1 1 0 100-2 1 1 0 000 2zm0 8a1 1 0 100-2 1 1 0 000 2zm0 8a1 1 0 100-2 1 1 0 000 2z"></path>
        </svg>
      </div>
    `;
    listEl.appendChild(item);
  });

  // Distruggi istanza precedente di Sortable se esiste
  if (sortableInstance) {
    sortableInstance.destroy();
  }

  // Inizializza SortableJS
  if (window.Sortable) {
    sortableInstance = new Sortable(listEl, {
      animation: 200,
      handle: '.sortable-item',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onEnd: () => {
        updateRankingsFromDOM();
      }
    });
  }

  updateRankingsFromDOM();
}

function updateRankingsFromDOM() {
  const listEl = document.getElementById('ranking-list');
  const items = listEl.querySelectorAll('.sortable-item');
  const newOrder = [];
  const rankingsObj = {};

  items.forEach((item, index) => {
    const factorId = parseInt(item.dataset.id, 10);
    const rankPos = index + 1;
    
    // Aggiorna numero visibile
    const badge = item.querySelector('.position-badge');
    if (badge) {
      badge.textContent = `${rankPos}`;
    }

    const factorObj = currentFactorOrder.find(f => f.id === factorId);
    if (factorObj) newOrder.push(factorObj);
    rankingsObj[factorId] = rankPos;
  });

  currentFactorOrder = newOrder;
  formData.rankings = rankingsObj;
}

// STEP 2: Rating Grid (Likert 1-5)
function renderStep2(survey) {
  const container = document.getElementById('step-2-container');
  container.classList.remove('hidden');

  const ratingGrid = document.getElementById('rating-factors-grid');
  ratingGrid.innerHTML = '';

  survey.factors.forEach(factor => {
    const factorCard = document.createElement('div');
    factorCard.className = 'p-5 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3';

    const currentScore = formData.ratings[factor.id];

    let buttonsHTML = '<div class="grid grid-cols-5 gap-2 mt-2">';
    survey.ratingOptions.forEach(opt => {
      const isSelected = currentScore === opt.value;
      buttonsHTML += `
        <button type="button" 
          onclick="selectRating(${factor.id}, ${opt.value})"
          class="rating-btn py-3 px-1 rounded-lg border text-center font-extrabold text-sm sm:text-base ${
            isSelected 
              ? 'active' 
              : 'bg-white border-slate-200 text-siec-textPrimary hover:border-siec-accent hover:text-siec-accent'
          }">
          <div>${opt.value}</div>
          <div class="text-[10px] sm:text-xs font-normal opacity-75 mt-0.5 truncate hidden sm:block">${opt.label}</div>
        </button>
      `;
    });
    buttonsHTML += '</div>';

    factorCard.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div>
          <h4 class="font-extrabold text-siec-primary text-base">${factor.title}</h4>
          <p class="text-xs text-siec-textSecondary mt-0.5">${factor.extended}</p>
        </div>
        ${currentScore ? `<span class="px-3 py-1 text-xs font-bold rounded-full bg-sky-50 text-siec-accent border border-sky-200 shrink-0">Voto: ${currentScore}/5</span>` : ''}
      </div>
      ${buttonsHTML}
    `;

    ratingGrid.appendChild(factorCard);
  });
}

function selectRating(factorId, score) {
  formData.ratings[factorId] = score;
  renderStep2(surveysData[currentSurveyId]);
  document.getElementById('step-error').classList.add('hidden');
}

// STEP 3: Open Feedback
function renderStep3(survey) {
  const container = document.getElementById('step-3-container');
  container.classList.remove('hidden');

  document.getElementById('open-feedback-prompt').textContent = survey.openFeedbackPrompt;
  const textarea = document.getElementById('open-feedback-input');
  textarea.value = formData.open_feedback || '';
  textarea.oninput = (e) => {
    formData.open_feedback = e.target.value;
  };
}

// Validation & Navigation
function nextStep() {
  const survey = surveysData[currentSurveyId];
  const errorEl = document.getElementById('step-error');
  errorEl.classList.add('hidden');

  // Validazione Step 0 (Segmentazione)
  if (currentStep === 0 && survey.hasSegmentation) {
    if (!formData.revenue_range) {
      showStepError('Seleziona la tua fascia di fatturato per proseguire.');
      return;
    }
  }

  // Validazione Step 1 (Ranking)
  if (currentStep === 1) {
    updateRankingsFromDOM();
    if (Object.keys(formData.rankings).length !== 8) {
      showStepError('Assicurati di aver ordinato tutti gli 8 fattori.');
      return;
    }
  }

  // Validazione Step 2 (Rating)
  if (currentStep === 2) {
    const unrated = survey.factors.filter(f => !formData.ratings[f.id]);
    if (unrated.length > 0) {
      showStepError(`Valuta tutti i fattori per proseguire (rimangono ${unrated.length} fattori da valutare).`);
      return;
    }
  }

  currentStep++;
  renderStep();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function prevStep() {
  const survey = surveysData[currentSurveyId];
  const minStep = survey.hasSegmentation ? 0 : 1;
  if (currentStep > minStep) {
    currentStep--;
    renderStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function showStepError(msg) {
  const errorEl = document.getElementById('step-error');
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}

async function submitSurvey() {
  const errorEl = document.getElementById('step-error');
  errorEl.classList.add('hidden');

  const btnSubmit = document.getElementById('btn-submit');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `
    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg> Invio in corso...
  `;

  try {
    const payload = {
      survey_type: currentSurveyId,
      revenue_range: formData.revenue_range,
      rankings: formData.rankings,
      ratings: formData.ratings,
      open_feedback: formData.open_feedback
    };

    const res = await fetch('/api/survey/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      document.getElementById('survey-view').classList.add('hidden');
      document.getElementById('success-view').classList.remove('hidden');
      const pc = document.getElementById('progress-container');
      if (pc) pc.classList.add('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      showStepError(data.error || 'Errore durante l\'invio della risposta.');
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Invia Risposta';
    }
  } catch (err) {
    console.error('Errore durante l\'invio:', err);
    showStepError('Errore di rete o del server. Riprova più tardi.');
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Invia Risposta';
  }
}

function showGlobalError(msg) {
  const container = document.querySelector('main');
  if (container) {
    container.innerHTML = `
      <div class="glass-card max-w-lg mx-auto p-8 rounded-2xl text-center space-y-4 my-12 border-red-500/30">
        <div class="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">!</div>
        <h2 class="text-xl font-bold text-white">Attenzione</h2>
        <p class="text-slate-300 text-sm">${msg}</p>
        <button onclick="location.reload()" class="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-600 transition-all">
          Ricarica Pagina
        </button>
      </div>
    `;
  }
}
