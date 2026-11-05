-- CreateTable
CREATE TABLE "Calificacion" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "complejoId" TEXT NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "comentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Calificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Calificacion_complejoId_idx" ON "Calificacion"("complejoId");

-- CreateIndex
CREATE INDEX "Calificacion_jugadorId_idx" ON "Calificacion"("jugadorId");

-- CreateIndex
CREATE UNIQUE INDEX "Calificacion_reservaId_jugadorId_key" ON "Calificacion"("reservaId", "jugadorId");

-- AddForeignKey
ALTER TABLE "Calificacion" ADD CONSTRAINT "Calificacion_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calificacion" ADD CONSTRAINT "Calificacion_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calificacion" ADD CONSTRAINT "Calificacion_complejoId_fkey" FOREIGN KEY ("complejoId") REFERENCES "Complejo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
