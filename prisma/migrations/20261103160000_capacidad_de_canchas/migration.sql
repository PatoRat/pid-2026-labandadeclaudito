-- Las canchas dadas de alta antes de que el formulario pidiera la capacidad
-- quedaron en 0: se completa con la sugerida según el deporte (lib/jugadores.ts).
UPDATE "Cancha"
SET "capacidad" = CASE "deporte"
  WHEN 'FUTBOL_5' THEN 10
  WHEN 'FUTBOL_7' THEN 14
  WHEN 'FUTBOL_11' THEN 22
  WHEN 'TENIS' THEN 4
  WHEN 'PADEL' THEN 4
  WHEN 'BASQUET' THEN 10
END
WHERE "capacidad" < 2;
