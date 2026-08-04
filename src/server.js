const express = require('express');
const path = require('path');
const { parseSurveyMarkdown } = require('./parser');
const { initDb, saveResponse, getResponses } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Strict Anonymity Header Middleware: Remove any potential tracking headers
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  next();
});

// API: Restituisce le domande parsate dal file Markdown
app.get('/api/survey/questions', (req, res) => {
  try {
    const questions = parseSurveyMarkdown();
    res.json({ success: true, data: questions });
  } catch (err) {
    console.error('Errore parsing survey questions:', err);
    res.status(500).json({ success: false, error: 'Impossibile caricare le domande delle survey.' });
  }
});

// API: Invio risposte survey
app.post('/api/survey/submit', async (req, res) => {
  try {
    const { survey_type, revenue_range, rankings, ratings, open_feedback } = req.body;

    // Validazione base
    if (!survey_type || !['vendor_distributori', 'system_integrator'].includes(survey_type)) {
      return res.status(400).json({ success: false, error: 'Tipologia survey non valida o mancante.' });
    }

    // Validazione segmentazione per System Integrator
    if (survey_type === 'system_integrator' && (!revenue_range || typeof revenue_range !== 'string' || !revenue_range.trim())) {
      return res.status(400).json({ success: false, error: 'La fascia di fatturato è obbligatoria per i System Integrator.' });
    }

    // Validazione rankings (deve contenere 8 fattori con posizioni 1..8)
    if (!rankings || typeof rankings !== 'object' || Object.keys(rankings).length !== 8) {
      return res.status(400).json({ success: false, error: 'Il ranking dei 8 fattori è obbligatorio e deve essere completo.' });
    }

    // Validazione ratings (deve contenere 8 valutazioni con voti 1..5)
    if (!ratings || typeof ratings !== 'object' || Object.keys(ratings).length !== 8) {
      return res.status(400).json({ success: false, error: 'La valutazione di tutti gli 8 fattori è obbligatoria.' });
    }

    for (const [factorId, score] of Object.entries(ratings)) {
      const numScore = Number(score);
      if (isNaN(numScore) || numScore < 1 || numScore > 5) {
        return res.status(400).json({ success: false, error: `Punteggio non valido (${score}) per il fattore ${factorId}. Deve essere tra 1 e 5.` });
      }
    }

    // Salvataggio nel Database (nessun tracciamento di IP o identificativi)
    const result = await saveResponse({
      survey_type,
      revenue_range: survey_type === 'system_integrator' ? revenue_range.trim() : null,
      rankings,
      ratings,
      open_feedback: open_feedback && typeof open_feedback === 'string' ? open_feedback.trim() : null
    });

    console.log(`[SURVEY] Nuova risposta salvata [ID: ${result.id}] per tipo: ${survey_type}`);
    res.json({ success: true, message: 'Risposta salvata con successo!', id: result.id });
  } catch (err) {
    console.error('Errore durante il salvataggio della risposta:', err);
    res.status(500).json({ success: false, error: 'Errore interno del server durante il salvataggio.' });
  }
});

// API locale per verifica risposte salvate
app.get('/api/survey/responses', async (req, res) => {
  try {
    const responses = await getResponses();
    res.json({ success: true, count: responses.length, data: responses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Statistiche ed aggregati per la Dashboard Admin
app.get('/api/survey/stats', async (req, res) => {
  try {
    const responses = await getResponses();
    const questions = parseSurveyMarkdown();

    const vendorResponses = responses.filter(r => r.survey_type === 'vendor_distributori');
    const siResponses = responses.filter(r => r.survey_type === 'system_integrator');

    function computeAggregates(surveyType, respList) {
      const surveyDef = questions[surveyType];
      if (!surveyDef) return [];

      const rankSums = {};
      const rankCounts = {};
      const rateSums = {};
      const rateCounts = {};

      surveyDef.factors.forEach(f => {
        rankSums[f.id] = 0;
        rankCounts[f.id] = 0;
        rateSums[f.id] = 0;
        rateCounts[f.id] = 0;
      });

      respList.forEach(r => {
        const rankings = typeof r.rankings === 'string' ? JSON.parse(r.rankings) : r.rankings;
        const ratings = typeof r.ratings === 'string' ? JSON.parse(r.ratings) : r.ratings;

        if (rankings) {
          Object.entries(rankings).forEach(([fId, pos]) => {
            if (rankSums[fId] !== undefined) {
              rankSums[fId] += Number(pos);
              rankCounts[fId]++;
            }
          });
        }
        if (ratings) {
          Object.entries(ratings).forEach(([fId, score]) => {
            if (rateSums[fId] !== undefined) {
              rateSums[fId] += Number(score);
              rateCounts[fId]++;
            }
          });
        }
      });

      return surveyDef.factors.map(f => {
        const avgRank = rankCounts[f.id] > 0 ? parseFloat((rankSums[f.id] / rankCounts[f.id]).toFixed(2)) : null;
        const avgRate = rateCounts[f.id] > 0 ? parseFloat((rateSums[f.id] / rateCounts[f.id]).toFixed(2)) : null;
        return {
          id: f.id,
          title: f.title,
          extended: f.extended,
          avgRank,
          avgRate
        };
      });
    }

    const revenueBreakdown = {};
    siResponses.forEach(r => {
      const key = r.revenue_range || 'Non specificato';
      revenueBreakdown[key] = (revenueBreakdown[key] || 0) + 1;
    });

    res.json({
      success: true,
      totalCount: responses.length,
      vendorCount: vendorResponses.length,
      siCount: siResponses.length,
      revenueBreakdown,
      vendorFactors: computeAggregates('vendor_distributori', vendorResponses),
      siFactors: computeAggregates('system_integrator', siResponses),
      responses
    });
  } catch (err) {
    console.error('Errore calcolo stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Esportazione CSV
app.get('/api/survey/export-csv', async (req, res) => {
  try {
    const responses = await getResponses();
    let csv = 'ID,Created_At,Survey_Type,Revenue_Range,Rankings_JSON,Ratings_JSON,Open_Feedback\n';

    responses.forEach(r => {
      const rankingsStr = (typeof r.rankings === 'string' ? r.rankings : JSON.stringify(r.rankings)).replace(/"/g, '""');
      const ratingsStr = (typeof r.ratings === 'string' ? r.ratings : JSON.stringify(r.ratings)).replace(/"/g, '""');
      const feedbackStr = (r.open_feedback || '').replace(/"/g, '""');

      csv += `"${r.id}","${r.created_at}","${r.survey_type}","${r.revenue_range || ''}","${rankingsStr}","${ratingsStr}","${feedbackStr}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=siec_survey_responses.csv');
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback SPA Routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inizializzazione DB e avvio Server (solo se eseguito direttamente)
if (require.main === module) {
  initDb().then(() => {
    function startServer(portToTry) {
      const serverInstance = app.listen(portToTry, '0.0.0.0', () => {
        console.log(`==================================================`);
        console.log(`SIEC Survey Web App attiva su http://localhost:${portToTry}`);
        console.log(`==================================================`);
      });
      serverInstance.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`Porta ${portToTry} occupata, tentativo su porta ${portToTry + 1}...`);
          startServer(portToTry + 1);
        } else {
          console.error('Errore durante l\'avvio del server:', err);
          process.exit(1);
        }
      });
    }
    startServer(PORT);
  }).catch(err => {
    console.error('Impossibile avviare l\'applicazione a causa di un errore DB:', err);
    process.exit(1);
  });
}

module.exports = app;
