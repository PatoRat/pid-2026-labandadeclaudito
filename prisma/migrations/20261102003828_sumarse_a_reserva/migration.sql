-- CreateTable
CREATE TABLE "ParticipanteReserva" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,

    CONSTRAINT "ParticipanteReserva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParticipanteReserva_reservaId_idx" ON "ParticipanteReserva"("reservaId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipanteReserva_reservaId_jugadorId_key" ON "ParticipanteReserva"("reservaId", "jugadorId");

-- AddForeignKey
ALTER TABLE "ParticipanteReserva" ADD CONSTRAINT "ParticipanteReserva_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipanteReserva" ADD CONSTRAINT "ParticipanteReserva_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
