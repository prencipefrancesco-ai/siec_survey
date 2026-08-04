-- Schema SQL per la tabella survey_responses in PostgreSQL (Railway)

CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    survey_type VARCHAR(50) NOT NULL,
    revenue_range VARCHAR(50),
    rankings JSONB NOT NULL,
    ratings JSONB NOT NULL,
    open_feedback TEXT
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_type ON survey_responses(survey_type);
CREATE INDEX IF NOT EXISTS idx_survey_responses_created_at ON survey_responses(created_at);
