const fs = require('fs');
const path = require('path');

function getMarkdownPath() {
  const root = path.join(__dirname, '..');
  const possibleNames = ['survey_questions.md.md', 'survey_questions.md'];
  for (const name of possibleNames) {
    const fullPath = path.join(root, name);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  throw new Error('File survey_questions.md (.md) non trovato nella root del progetto.');
}

function parseSurveyMarkdown() {
  const filePath = getMarkdownPath();
  const content = fs.readFileSync(filePath, 'utf-8');

  // Dividi per sezioni SURVEY (intestazioni ##)
  const surveyBlocks = content.split(/^##\s+/m);

  const surveys = {};

  const ratingOptions = [
    { value: 1, label: 'Per nulla soddisfacente' },
    { value: 2, label: 'Inadeguato' },
    { value: 3, label: 'In linea' },
    { value: 4, label: 'Molto buono' },
    { value: 5, label: 'Eccellente' }
  ];

  surveyBlocks.forEach(block => {
    if (!block.trim() || block.startsWith('# SIEC')) return;

    const surveyIdMatch = block.match(/\*\*ID Survey:\*\*\s*`([^`]+)`/);
    if (!surveyIdMatch) return;
    const surveyId = surveyIdMatch[1].trim();

    const titleLine = block.split('\n')[0].trim();
    const title = titleLine.replace(/^:\s*/, '').trim();

    const targetMatch = block.match(/\*\*Target:\*\*\s*(.+)/);
    const target = targetMatch ? targetMatch[1].trim() : '';

    const introMatch = block.match(/\*\*Intro:\*\*\s*"([^"]+)"/);
    const intro = introMatch ? introMatch[1].trim() : '';

    // Segmentazione
    const hasSegmentation = block.includes('Sezione 0 — Segmentazione');
    let revenuePrompt = '';
    const revenueOptions = [];
    if (hasSegmentation) {
      const segMatch = block.match(/Sezione 0 — Segmentazione[\s\S]*?(?=###|\r?\n---|\r?\n##|$)/);
      const segSection = segMatch ? segMatch[0] : block;

      const promptMatch = segSection.match(/\*\*Domanda:\*\*\s*"([^"]+)"/);
      if (promptMatch) revenuePrompt = promptMatch[1];
      
      const optionsMatches = [...segSection.matchAll(/\*\s+`([^`]+)`/g)];
      optionsMatches.forEach(m => revenueOptions.push(m[1]));
    }

    // Estrazione Fattori di Ranking (Sezione 1)
    const factors = [];
    const factorRegex = /(\d+)\.\s+\*\*([^*]+)\*\*\s*\n\s+\*\s+\*Etichetta estesa:\*\s*(.+)/g;
    let factorMatch;
    while ((factorMatch = factorRegex.exec(block)) !== null) {
      factors.push({
        id: parseInt(factorMatch[1], 10),
        title: factorMatch[2].trim(),
        extended: factorMatch[3].trim()
      });
    }

    // Open Feedback
    const openFeedbackMatch = block.match(/Sezione 3 — Open Feedback[\s\S]*?\*\*Domanda:\*\*\s*"([^"]+)"/);
    const openFeedbackPrompt = openFeedbackMatch ? openFeedbackMatch[1] : "C'è qualcosa che per te è importante e che non abbiamo incluso qui sopra? Scrivilo pure.";

    surveys[surveyId] = {
      id: surveyId,
      title,
      target,
      intro,
      hasSegmentation,
      revenuePrompt,
      revenueOptions,
      factors,
      ratingOptions,
      openFeedbackPrompt
    };
  });

  return surveys;
}

module.exports = {
  parseSurveyMarkdown,
  getMarkdownPath
};
