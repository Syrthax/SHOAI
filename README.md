# Elah AI Copilot

## Run (Windows PowerShell)
```powershell
# Terminal 1 - backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env      # then put your FEATHERLESS_API_KEY in .env
uvicorn app.main:app --reload --port 8000

# Terminal 2 - frontend
cd frontend
npm install
npm run dev                 # open the URL shown (Chrome/Edge)
```
Import a short video via the left Asset panel, drag it to the timeline, then chat.

## Backend CLI (no browser needed)
Same planner and validation as the API, run against a JSON timeline (`backend/samples/timeline.json`).
```bash
cd backend
python cli.py                                   # interactive: request -> plan -> preview -> keep/discard/refine, /undo
python cli.py "remove the first 3 seconds"      # one-shot, prints before/after
python cli.py "add my name as a lower third" --json   # exactly what POST /api/plan returns
python cli.py --plan samples/plan.json          # offline: validate + preview a hand-written plan, no API key
```

Use Chrome or Edge (WebCodecs/WebGL2 required).
