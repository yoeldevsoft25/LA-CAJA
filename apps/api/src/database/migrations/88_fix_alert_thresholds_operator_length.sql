-- Migración 88: Corregir longitud de columna comparison_operator
-- Permite operadores más largos como 'greater_than' (12 caracteres)

ALTER TABLE alert_thresholds 
ALTER COLUMN comparison_operator TYPE VARCHAR(20);
