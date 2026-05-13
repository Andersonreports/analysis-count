1. Open `script.google.com` and create a new Apps Script project bound to the same Google account that can edit the sheet.
2. Copy the contents of [Code.gs](/abs/path/c:/Users/ander_j/Desktop/analysis-count/google-apps-script/Code.gs) into the project.
3. Deploy it as a `Web app`.
4. Set access to `Anyone` or `Anyone with the link` so the dashboard can call it.
5. Copy the deployed web app URL.
6. Paste that URL into `SHEET_API_URL` in [index.html](/abs/path/c:/Users/ander_j/Desktop/analysis-count/index.html).

After that:

- Page load will fetch fresh data from the live sheet.
- `Save Changes` in the add-count modal will write back to the selected year/month.
- The dashboard will refresh itself from the updated sheet response.
