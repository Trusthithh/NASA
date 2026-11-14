# Earth System Trend Detective

NASA Space Apps Challenge project: explore multi-decadal NASA Earth-science trends
(temperature, precipitation, root-zone soil moisture, aerosol optical depth) with
rigorous statistics and a grounded research assistant.

## Local setup

Backend (Python 3.11+):

    cd backend
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env
    uvicorn app.main:app --reload --port 8000
    pytest                              # unit tests
    python scripts/check_datasets.py    # live smoke test of all 4 POWER parameters

Frontend (Node 18+):

    cd frontend
    npm install
    cp .env.example .env
    npm run dev

## Deployment

- Backend on Render or Railway: root directory `backend`, build command
  `pip install -r requirements.txt`, start command
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check `/health`.
  Set PYTHON_VERSION to 3.11 or newer. Free tiers sleep, so the first request is slow.
- Frontend on Vercel: root directory `frontend`, build command `npm run build`,
  output directory `dist`. `vercel.json` rewrites all paths to index.html so deep
  links such as /investigate work. Set VITE_API_BASE_URL at build time.
- Add the Vercel domain to CORS_ORIGINS on the backend. For preview deployments set
  CORS_ORIGIN_REGEX, for example `https://.*\.vercel\.app`.

## Methodology

- Missing values (-999) become NaN and are never replaced by zero. POWER's YYYY13
  annual-mean record is ignored.
- Annual resolution uses means of complete 12-month years. Monthly resolution
  removes each calendar month's climatology first, so seasonality cannot create or
  hide a trend.
- Significance: Hamed-Rao modified Mann-Kendall (p < 0.05). Magnitude: Theil-Sen
  slope with a 95% interval, plus OLS with a t-based interval. Slopes are per year
  on a real decimal-year axis.
- Serial correlation is measured on residuals (lag-1 and Ljung-Box), not assumed.
- A non-significant result means insufficient evidence to reject "no trend", never
  proof of no change, and significance is never presented as proof of causation.
- The assistant is grounded on statistics the backend recomputes itself (cached);
  the client cannot supply or alter them.

## Notes

- Verify the four POWER parameters with `scripts/check_datasets.py` before a demo.
- Gemini: `google-genai` replaces the deprecated `google-generativeai`. Confirm the
  model name in AI_MODEL_NAME is still current.
- Globe: `frontend/public/textures/earth.jpg` is a bundled stylised Earth texture, so the
  globe looks like Earth offline. After it loads, the app tries to swap in a higher
  resolution texture (VITE_GLOBE_TEXTURE_URL first, then a public three.js Earth texture).
  Regenerate the bundled image with `python tools/generate_earth_texture.py`
  (needs pillow, numpy, scipy). Replace it with any equirectangular NASA Blue Marble
  image (lon -180..180 left to right) for a photographic look.
- Location flow: searching on the home page jumps straight to the Trend Analyser; clicking
  the globe selects a point (then "Open in Trend Analyser"). In the analyser, clicking the
  globe or searching updates the coordinates and re-runs the analysis. The selection is
  shared across pages and the menu's Trend Analyser link keeps it.
