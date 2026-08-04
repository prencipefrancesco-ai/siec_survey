### BRANDING & DESIGN SYSTEM DIRECTIVES (SIEC - sieconline.it)

Tutti i componenti UI della survey devono riflettere fedelmente il design system ufficiale di SIEC:

1. COLOR PALETTE (TAILWIND / CSS VARIABLES):
   - Primary (Brand Dark Blue): #002C5F (usato per Header, Titoli, Card di selezione attive)
   - Accent (Brand Cyan/Blue): #00A3E0 (usato per Call-to-Action, indicatori di stato, hover e drag handle)
   - Background Page: #F8FAFC (grigio freddo e pulito)
   - Background Card: #FFFFFF con bordo sottile #E2E8F0 e ombra soft (shadow-sm)
   - Text Primary: #0F172A (Antracite)
   - Text Secondary: #475569 (Grigio medio)

2. HEADER & LOGO INTEGRATION:
   - Nell'header della Web App, inserire il logo SIEC (o la dicitura stilizzata SIEC — System Integrators Educational Community) con il claim ufficiale dell'associazione.
   - Aggiungere una pillola/badge visibile nell'header: 
     [ 🛡️ Survey Anonima SIEC ] con sfondo #E0F2FE e testo #0369A1.

3. COMPONENTI UI SPECIFICI:
   - Drag & Drop Cards (Sezione 1):
     * Stato normale: Sfondo bianco, bordo #E2E8F0, icona drag (⋮⋮) in grigio #94A3B8.
     * Stato active/dragging: Bordo #00A3E0, sfondo #F0F9FF, ombra marcata (shadow-md).
     * Numero di posizione (1-8): Badge circolare in #002C5F con testo bianco.
   - Likert Rating Badges (Sezione 2):
     * Bottoni 1-5 stilizzati come segmenti interattivi. Quando selezionato, il bottone si colora di #002C5F con testo bianco.
   - Progress Bar:
     * Una barra sottile in alto che avanza con il colore accento #00A3E0 a ogni step della survey.
   - Bottoni di Navigazione / Invia:
     * Primario: Sfondo #002C5F con effetto hover #00A3E0, angoli rounded-lg (8px), testo bold bianco.

4. FOOTER:
   - Inserire il footer ufficiale con il riferimento a SIEC: "© SIEC — Systems Integrators Educational Community | sieconline.it"