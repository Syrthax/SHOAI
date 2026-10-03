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

Use Chrome or Edge (WebCodecs/WebGL2 required).
