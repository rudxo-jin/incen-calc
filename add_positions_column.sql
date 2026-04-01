ALTER TABLE settings ADD COLUMN IF NOT EXISTS positions JSONB DEFAULT '{"현장직": ["수습", "사원", "선임기사", "팀장", "공장장"], "사무직": ["사원", "실장", "주임", "대리", "과장", "차장", "부장", "이사", "대표이사"]}'::jsonb;
