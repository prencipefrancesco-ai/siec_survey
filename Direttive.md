PROMPT OPERATIVO PER ANTIGRAVITY AGENT

Contesto:
Sviluppare una Web App per la gestione di due survey anonime per il progetto SIEC (sieconline.it).
I dati delle domande devono essere parsati/letti direttamente dal file `survey_questions.md`.

Requisiti Architetturali:
1. Backend: Node.js (Fastify o Express) o Python (FastAPI).
2. Database: PostgreSQL (fornito nativamente tramite plugin su Railway).
3. Frontend: Lightweight Web App (HTML5 + Tailwind CSS + SortableJS per Drag & Drop).
4. Deployment: Repository GitHub integrato con Railway via auto-build trigger.

Istruzioni di Sviluppo Step-by-Step per l'Agente:

STEP 1: DATABASE & SCHEMA MANAGEMENT
- Crea uno script SQL / migration per definire la tabella `survey_responses`:
  - `id` (UUID, Primary Key)
  - `created_at` (Timestamp UTC)
  - `survey_type` (Enum/Text: 'vendor_distributori' | 'system_integrator')
  - `revenue_range` (Text, Nullable per Vendor)
  - `rankings` (JSONB: id del fattore -> posizione da 1 a 8)
  - `ratings` (JSONB: id del fattore -> voto da 1 a 5)
  - `open_feedback` (Text, Nullable)

STEP 2: BACKEND API
- Implementa un endpoint POST `/api/survey/submit`:
  - Valida il payload in ingresso.
  - Verifica che non vengano registrati o salvati Indirizzi IP o identificativi utente.
  - Inserisci la risposta nel DB PostgreSQL.
- Implementa un endpoint GET `/api/survey/questions` per servire in formato JSON i dati definiti in `survey_questions.md`.

STEP 3: FRONTEND UX & UI
- Costruisci una Single Page Application (SPA) con layout responsive per mobile e desktop.
- Rotte/Tab per la scelta del profilo:
  - `/vendor` (carica Survey 1)
  - `/system-integrator` (carica Survey 2)
- Step Wizard UX:
  - Step 1: Drag & Drop dinamico con SortableJS. Mostra l'etichetta sintetica con tooltip/sottotesto dell'etichetta estesa.
  - Step 2: Griglia di Star Rating o Radio button stilizzati a badge (1-5) per la valutazione SIEC.
  - Step 3: Textarea facoltativa + Tasto Invia con feedback visivo di successo.

STEP 4: CONFIGURAZIONE RAILWAY & DEPLOYMENT
- Crea un `Dockerfile` leggero o un file `Procfile` / `railway.json` per garantire che Railway rilevi automaticamente l'ambiente di runtime.
- Configura la variabile d'ambiente `DATABASE_URL` per connettersi al plugin PostgreSQL di Railway.
- Assicurati che l'applicazione risponda sulla porta definita dalla variabile d'ambiente `PORT` fornita da Railway.