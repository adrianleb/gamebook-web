/**
 * Main entry point for gamebook-web.
 *
 * This file bootstraps the game application.
 * Engine, UI, and content modules will be initialized here.
 */

const app = document.getElementById('app');

if (app) {
  app.innerHTML = `
    <div style="border: 2px solid #0aa; padding: 2rem; text-align: center;">
      <h1 style="color: #0ff; margin-bottom: 1rem;">GAMEBOOK WEB</h1>
      <p>Project scaffold initialized.</p>
      <p style="margin-top: 1rem; color: #888;">
        Awaiting engine, UI, and content implementation.
      </p>
    </div>
  `;
}
