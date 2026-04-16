-- Pre-competition state: no submissions or voting until OPEN (cron at `openAt` when autoTransition on).
ALTER TYPE "BatchStatus" ADD VALUE 'CLOSED';
