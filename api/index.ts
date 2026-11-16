import type { Application, Request, Response } from 'express';

let preparation: Promise<Application> | undefined;

const prepareApp = () => {
  preparation ||= (async () => {
    const [{ default: appModule }, { initializeDatabase }] = await Promise.all([
      import('../server/src/app.js'),
      import('../server/src/config/database.js'),
    ]);
    const app = (
      (appModule as unknown as { default?: Application }).default ||
      (appModule as unknown as Application)
    );
    await initializeDatabase();
    return app;
  })().catch((error) => {
    preparation = undefined;
    throw error;
  });
  return preparation;
};

export default async function handler(request: Request, response: Response) {
  try {
    const app = await prepareApp();
    return app(request, response);
  } catch (error) {
    console.error('Failed to prepare Moodie:', error);
    response.statusCode = 503;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ error: 'Moodie requires its persistent application server.' }));
    return response;
  }
}
