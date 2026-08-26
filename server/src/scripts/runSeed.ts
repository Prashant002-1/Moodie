import { runSeedCommand } from './seedData';

void runSeedCommand().then((exitCode) => {
  process.exitCode = exitCode;
});
