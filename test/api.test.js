const assert = require('assert');
const http = require('http');
const path = require('path');
const { parseSurveyMarkdown } = require('../src/parser');
const { initDb, getResponses, saveResponse } = require('../src/db');
const app = require('../src/server');

const TEST_PORT = 3999;
let server;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: TEST_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('\n==================================================');
  console.log('🧪 AVVIO TEST LOCALI AUTOMATIZZATI PER SIEC SURVEY');
  console.log('==================================================\n');

  try {
    // 1. TEST PARSER MARKDOWN
    console.log('1. Testing Markdown Parser...');
    const questions = parseSurveyMarkdown();
    assert.strictEqual(Boolean(questions.vendor_distributori), true, 'Survey Vendor non trovata');
    assert.strictEqual(Boolean(questions.system_integrator), true, 'Survey SI non trovata');
    assert.strictEqual(questions.vendor_distributori.factors.length, 8, 'Fattori Vendor non sono 8');
    assert.strictEqual(questions.system_integrator.factors.length, 8, 'Fattori SI non sono 8');
    assert.strictEqual(questions.system_integrator.hasSegmentation, true, 'Flag segmentazione SI non presente');
    assert.strictEqual(questions.system_integrator.revenueOptions.length, 4, 'Opzioni fatturato SI non sono 4');
    console.log('   ✅ Markdown Parser: PASS\n');

    // 2. AVVIO SERVER PER TEST API
    server = http.createServer(app).listen(TEST_PORT);
    console.log(`2. Server Express di test avviato su porta ${TEST_PORT}...`);

    // 3. TEST GET /api/survey/questions
    console.log('3. Testing GET /api/survey/questions...');
    const getRes = await request('GET', '/api/survey/questions');
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.data.success, true);
    assert.strictEqual(Object.keys(getRes.data.data).length, 2);
    console.log('   ✅ GET /api/survey/questions: PASS\n');

    // 4. TEST POST /api/survey/submit (Vendor - Valido)
    console.log('4. Testing POST /api/survey/submit (Vendor & Distributori)...');
    const vendorPayload = {
      survey_type: 'vendor_distributori',
      rankings: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8 },
      ratings: { 1: 5, 2: 4, 3: 5, 4: 3, 5: 4, 6: 5, 7: 4, 8: 5 },
      open_feedback: 'Test feedback opzionale vendor'
    };
    const postVendorRes = await request('POST', '/api/survey/submit', vendorPayload);
    assert.strictEqual(postVendorRes.status, 200);
    assert.strictEqual(postVendorRes.data.success, true);
    assert.strictEqual(Boolean(postVendorRes.data.id), true);
    console.log('   ✅ POST /api/survey/submit (Vendor): PASS\n');

    // 5. TEST POST /api/survey/submit (SI - Valido)
    console.log('5. Testing POST /api/survey/submit (System Integrator)...');
    const siPayload = {
      survey_type: 'system_integrator',
      revenue_range: '4-8 mio',
      rankings: { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 },
      ratings: { 1: 4, 2: 4, 3: 5, 4: 5, 5: 3, 6: 4, 7: 5, 8: 4 },
      open_feedback: 'Test feedback SI'
    };
    const postSiRes = await request('POST', '/api/survey/submit', siPayload);
    assert.strictEqual(postSiRes.status, 200);
    assert.strictEqual(postSiRes.data.success, true);
    assert.strictEqual(Boolean(postSiRes.data.id), true);
    console.log('   ✅ POST /api/survey/submit (System Integrator): PASS\n');

    // 6. TEST VALIDAZIONE ERRORE (SI senza fatturato)
    console.log('6. Testing Validazione Errore (System Integrator senza fatturato)...');
    const invalidSiPayload = {
      survey_type: 'system_integrator',
      revenue_range: '', // Mancante
      rankings: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8 },
      ratings: { 1: 5, 2: 4, 3: 5, 4: 3, 5: 4, 6: 5, 7: 4, 8: 5 }
    };
    const invalidRes = await request('POST', '/api/survey/submit', invalidSiPayload);
    assert.strictEqual(invalidRes.status, 400);
    assert.strictEqual(invalidRes.data.success, false);
    console.log('   ✅ Validazione Errore (Fatturato mancante): PASS\n');

    // 7. TEST VERIFICA DATI SALVATI NEL DATABASE E ANONIMATO
    console.log('7. Testing Database Responses & Verification...');
    const responses = await getResponses();
    assert.strictEqual(responses.length >= 2, true);

    const first = responses[0];
    assert.strictEqual(first.hasOwnProperty('ip'), false, 'ATTENZIONE: Campo IP presente! Deve essere rimosso.');
    assert.strictEqual(first.hasOwnProperty('user_agent'), false, 'ATTENZIONE: Campo User Agent presente!');
    console.log('   ✅ Verifica Anonimato DB (Zero IP/identificativi): PASS\n');

    console.log('==================================================');
    console.log('🎉 TUTTI I TEST LOCALI HANNO AVUTO ESITO POSITIVO!');
    console.log('==================================================\n');

  } catch (err) {
    console.error('\n❌ TEST FALLITO:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
  }
}

runTests();
