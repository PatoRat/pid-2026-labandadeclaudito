-- CreateEnum
CREATE TYPE "EstadoTicket" AS ENUM ('PENDIENTE', 'ANULADO', 'CONFIRMADO');

-- CreateTable
CREATE TABLE "EtiquetaReserva" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "etiquetadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EtiquetaReserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "reservasInvalidas" INTEGER NOT NULL,
    "puntosAnteriores" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoTicket" NOT NULL DEFAULT 'PENDIENTE',
    "venceEn" TIMESTAMP(3) NOT NULL,
    "comentarioJugador" TEXT,
    "respondidoEn" TIMESTAMP(3),
    "comentarioAdmin" TEXT,
    "resueltoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenciaTicket" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" "TipoEvidencia" NOT NULL DEFAULT 'IMAGEN',
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EvidenciaTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EtiquetaReserva_reservaId_idx" ON "EtiquetaReserva"("reservaId");

-- CreateIndex
CREATE INDEX "EtiquetaReserva_jugadorId_idx" ON "EtiquetaReserva"("jugadorId");

-- CreateIndex
CREATE UNIQUE INDEX "EtiquetaReserva_reservaId_jugadorId_key" ON "EtiquetaReserva"("reservaId", "jugadorId");

-- CreateIndex
CREATE INDEX "Ticket_jugadorId_idx" ON "Ticket"("jugadorId");

-- CreateIndex
CREATE INDEX "Ticket_estado_idx" ON "Ticket"("estado");

-- CreateIndex
CREATE INDEX "EvidenciaTicket_ticketId_idx" ON "EvidenciaTicket"("ticketId");

-- AddForeignKey
ALTER TABLE "EtiquetaReserva" ADD CONSTRAINT "EtiquetaReserva_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtiquetaReserva" ADD CONSTRAINT "EtiquetaReserva_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenciaTicket" ADD CONSTRAINT "EvidenciaTicket_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
