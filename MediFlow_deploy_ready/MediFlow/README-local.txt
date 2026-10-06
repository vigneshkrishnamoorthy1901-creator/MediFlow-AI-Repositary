Run the backend:
  1. Open Backend\.env and paste your Gemini API key after GEMINI_API_KEY=
  2. In PowerShell, run:
       cd C:\Users\<your-name>\Downloads\MediFlow_Updated\MediFlow\Backend
       npm install
       npm start
  3. Open http://localhost:5000

Get a Gemini API key at https://aistudio.google.com/apikey. Do not share the key
or put it in frontend files. The Backend\.env file is local and ignored by Git.
Prescription images and PDFs are sent to Google Gemini for direct analysis.
The app requires a working Gemini API key to read uploaded prescriptions.
Note: camera needs http://localhost (allowed) or HTTPS.
