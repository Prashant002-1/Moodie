import { describe, expect, it, jest } from '@jest/globals';
import { runSeedCommand } from '../src/scripts/seedData';

describe('Seed command', () => {
  it('returns a failure code after database cleanup resets the process status', async () => {
    const seedError = new Error('seed transaction failed');
    const run = jest.fn<() => Promise<void>>().mockRejectedValue(seedError);
    const close = jest.fn(async () => {
      process.exitCode = 0;
    });

    const exitCode = await runSeedCommand(run, close);
    process.exitCode = exitCode;

    expect(run).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('Seeding failed:', seedError);
    expect(process.exitCode).toBe(1);

    process.exitCode = undefined;
  });

  it('returns success only when seeding and cleanup both succeed', async () => {
    const run = jest.fn<() => Promise<void>>().mockResolvedValue();
    const close = jest.fn<() => Promise<void>>().mockResolvedValue();

    await expect(runSeedCommand(run, close)).resolves.toBe(0);
  });
});
