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

With the backend running on port 8000, the Vite development server proxies
`/api` requests to it. This keeps preview requests same-origin; set
`VITE_API_BASE_URL` only when connecting to a separately hosted backend.

## Deployment

- Deploy the backend on Render or Railway with root directory
  `earth-system-trend-detective-v1.2/backend`, build command
  `pip install -r requirements.txt`, start command
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, and health check `/health`.
  Set `PYTHON_VERSION` to `3.11` or newer. Set `CORS_ORIGINS` to the exact public
  frontend origin, such as `https://your-site.vercel.app`. For Vercel previews,
  optionally set `CORS_ORIGIN_REGEX` to `https://.*\.vercel\.app`. Add
  `GEMINI_API_KEY` here only if you want the assistant enabled; never put it in
  frontend environment variables.
- Deploy the frontend on Vercel with root directory
  `earth-system-trend-detective-v1.2/frontend`, build command `npm run build`,
  and output directory `dist`. Add the Vercel environment variable
  `VITE_API_BASE_URL` with the backend URL ending in `/api/v1`, for example
  `https://your-api.onrender.com/api/v1`, then redeploy. Vite's `/api` proxy is
  for local development only. `vercel.json` rewrites app routes to `index.html`
  so deep links such as `/investigate` work.

## Variables (8)

Temperature: skin temperature (TS), 2 m dew point (T2MDEW). Water: precipitation
(PRECTOTCORR), root-zone soil wetness (GWETROOT), snow cover fraction (FRSNO).
Atmosphere: 2 m specific humidity (QV2M), aerosol optical depth at 550 nm (AOD_55).
Energy: clear-sky surface shortwave irradiance (CLRSKY_SFC_SW_DWN, from 1984).
To add another, add an entry to DATASET_MAPPING in `nasa_service.py`; the dropdown
groups variables by `category` automatically. Run `python scripts/check_datasets.py`
after any change to confirm each code returns data and starts in the configured year.

## Features

- Trend Analyser: trend, change point (Pettitt), records and extremes, seasonal breakdown,
  data-quality badge, grounded assistant.
- Compare: (1) the same variable at two places on one chart, with an informal slope-interval
  check; (2) two variables at one place, with Pearson, Spearman, detrended correlation and a
  serial-correlation-adjusted p-value.
- One-click hotspots (Arctic, Siberia, Amazon, Sahel, Himalaya, Bodele, Delhi, Mediterranean,
  Atacama), each with a short story and a recommended variable. Edit `frontend/src/data/hotspots.ts`.
- Endpoints added: `POST /api/v1/analysis/compare` and `POST /api/v1/analysis/correlation`.

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
- Change point: Pettitt test on the same deseasonalised/annual series. It assumes independent
  observations, so serial correlation can make false detections more likely.
- Records: highest/lowest annual means (complete years only) and months; rank of the latest year.
- Data quality: share of valid months, longest gap, complete years, source breaks (solar, 2001)
  and mostly-zero series. Levels: good / fair / poor.
- Correlation: both series are used as anomalies; the p-value is adjusted with an effective
  sample size for autocorrelation; a detrended r separates shared trends from co-variation.
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


## v1.5 reliability updates

- Pettitt change points now require at least 10 observations on each side and report the exact detected month for monthly analyses. Their asymptotic p-values are explicitly labelled nominal and not corrected for serial dependence.
- Correlation's legacy `pearson_p_adjusted` response field is retained for compatibility, but the UI and interpretation describe it as a lag-1 effective-sample-size heuristic rather than a definitive autocorrelation correction.
- Data-quality reports include temporal continuity, duplicate-month counts, incomplete years excluded from annual means, and known source-break years. Duplicate monthly observations are averaged before annual aggregation.
- The assistant can receive recent conversation context, keeps backend statistics authoritative, and rejects generated numeric tokens not represented in the verified summary before falling back to a deterministic answer.
- The assistant endpoint has a dependency-free per-process rate limit (configurable with `ASSISTANT_RATE_LIMIT_PER_MINUTE`, default 12 requests/minute). Multi-worker deployments should also enforce a shared gateway-level limit.
