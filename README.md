# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).

## Jeopardy Google Sheets Integration

The Jeopardy page fetches data from a Google Sheet. To configure it:

1. Copy `.env.example` to `.env`.
2. Set `VITE_GOOGLE_SHEETS_API_KEY` to your Google Cloud API key.
3. Set `VITE_JEOPARDY_SPREADSHEET_ID` to your spreadsheet ID.
4. Ensure your spreadsheet is shared so anyone with the link can view it (or the API key has access).
5. The default range is `Sheet1!A1:F6`. The first row is used for category titles, and subsequent rows for questions.
   - Use the format `Question | Answer` in cells to include both.
