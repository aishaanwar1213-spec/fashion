# Glamora – Beauty & Style, Your Way
**Setup:** install Node.js 18+, then in this folder run:
1. `npm install`
2. copy `.env.example` to `.env` and set `ADMIN_PASSWORD` (+ SMTP details for real emails; optional `ANTHROPIC_API_KEY` for AI chatbot)
3. `npm start` → open http://localhost:3000
**Admin:** click "Login" in the header (default password `admin123` if none set). **Data** is stored in `data.json`.
**Gmail emails:** turn on 2-step verification, create an App Password, put it in `SMTP_PASS`.
Without SMTP details orders still save; the success page says email isn't configured.
