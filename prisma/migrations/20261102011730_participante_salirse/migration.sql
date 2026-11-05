/*
  Warnings:

  - Added the required column `jugadores` to the `ParticipanteReserva` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ParticipanteReserva" ADD COLUMN     "jugadores" INTEGER NOT NULL;
