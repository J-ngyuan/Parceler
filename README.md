# Parceler — College Parcel Management System

A web-based parcel tracking system for college residential communities. Delivery drivers log incoming parcels, residents are notified instantly via email and Telegram, and a specified countdown timer enforces collection deadlines. Admins get a real-time dashboard to manage everything.

---

## Features

- Delivery drivers log parcels with tracking number and optional photo
- Residents notified instantly via email and Telegram DM
- Specified countdown timer per parcel, with warning reminder at 2 days
- Real-time admin dashboard with live updates
- Role-based access: Admin, Driver, Resident

---

## Prerequisites

Make sure you have the following installed before starting:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [PostgreSQL](https://www.postgresql.org/download/) (v14 or higher)
- A Gmail account (for email notifications)
- A Telegram bot token from [@BotFather](https://t.me/BotFather) (optional)

---

## Setup

### 1. Clone or download the project

Place the project folder somewhere on your machine. You should have:

```
parceler/
├── backend/
└── frontend/
```

### 2. Install dependencies

Open a terminal and run:

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 3. Set up the database

Open pgAdmin or run the following in a terminal (adjust the path to your PostgreSQL installation):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE parceler;"
```

Then update `DATABASE_URL` in `backend/.env` to match (see step 4).

### 4. Configure environment variables

Open `backend/.env` and fill in the values:

```env
DATABASE_URL=postgresql://postgres:YOUR_PG_PASSWORD@localhost:5432/parceler
JWT_SECRET=any_long_random_string
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_FROM="Parceler <your@gmail.com>"
TELEGRAM_BOT_TOKEN=your_token_from_botfather
FRONTEND_URL=http://localhost:5173
PORT=3000
```

**Notes:**
- Replace `YOUR_PG_PASSWORD` with your PostgreSQL password
- `JWT_SECRET` can be any random string, e.g. `parceler_secret_2024`
- `EMAIL_PASS` must be a Gmail **App Password**, not your normal password — generate one at [Google Account → Security → App Passwords](https://myaccount.google.com/apppasswords) (requires 2-Step Verification to be enabled)
- `TELEGRAM_BOT_TOKEN` is optional — leave it blank to disable Telegram notifications

### 5. Run the database migration

```bash
cd backend
npx prisma migrate dev --name init
```

This creates all the required tables in your database.

### 6. Create the admin account

```bash
cd backend
node seed-admin.mjs
```

This creates the default admin login:
- **Email:** admin@gmail.com
- **Password:** 1234

### 7. Start the backend

```bash
cd backend
npm run dev
```

You should see: `Server running on port 3000`

### 8. Start the frontend

Open a **second terminal**:

```bash
cd frontend
npm run dev
```

You should see: `Local: http://localhost:5173`

---

## Usage

Open `http://localhost:5173` in your browser.

### First-time setup

1. Log in as admin (`admin@gmail.com` / `1234`)
2. Click **+ Create User** to create a driver account
3. Residents can self-register at `/register`

### Logging a parcel (Driver)

1. Log in as a driver
2. Search for the resident by name
3. Enter the tracking number
4. Optionally attach a photo of the parcel
5. Click **Log Parcel** — the resident is notified automatically

### Collecting a parcel (Resident)

1. Log in and go to **My Parcels**
2. Click **Mark Collected** when you pick up your parcel

### Linking Telegram (Resident)

1. Log in and go to **My Parcels**
2. Click **Get Link Code**
3. Open Telegram, find your bot, and send: `/link YOUR_CODE`

---

## Project Structure

```
parceler/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   ├── src/
│   │   ├── index.js            # Express app entry point
│   │   ├── lib/                # Prisma client
│   │   ├── middleware/         # JWT auth middleware
│   │   ├── routes/             # API routes (auth, parcels, users)
│   │   ├── services/           # Email, Telegram, notifications
│   │   └── jobs/               # Daily expiry check (node-cron)
│   ├── uploads/                # Uploaded parcel photos
│   ├── .env                    # Environment variables
│   └── package.json
└── frontend/
    ├── src/
    │   ├── pages/              # Login, Register, Dashboards
    │   ├── components/         # Navbar, ParcelCard, CountdownTimer
    │   └── lib/                # Axios instance, auth helpers
    └── package.json
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS, TanStack Query |
| Backend | Node.js, Express |
| Database | PostgreSQL, Prisma ORM |
| Real-time | Socket.io |
| Notifications | Nodemailer (email), Telegram Bot API |
| Scheduling | node-cron |
| File uploads | multer |
