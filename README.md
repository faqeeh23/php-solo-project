# Dental Appointment System

A dental booking app built with **React, Vite, PHP OOP, PDO, and MySQL/MariaDB**.

## Features

| Role | What they can do |
| --- | --- |
| Patient | Browse services, book visits, and cancel their own future appointments |
| Doctor | Manage their own available slots, confirm bookings, and complete visits |
| Admin | Add doctors, view all appointments, and cancel future bookings |

Includes session authentication, role-based access, CSRF protection, and double-booking prevention.

## Requirements

- XAMPP: Apache, PHP 8.0+ with PDO MySQL and mbstring, and MySQL 8.0.16+ or MariaDB 10.2.1+.
- Node.js 22.12+ compatible with Vite 8, and npm.

## Setup

1. Place the project in `C:/xampp/htdocs/xampp/php-solo-project`.
2. Start **Apache** and **MySQL** in XAMPP.
3. In phpMyAdmin, create an empty `dental_system` database. Import [schema.sql](database/schema.sql), then [seed.sql](database/seed.sql) to add sample services.
4. If needed, copy `backend/config.example.php` to `backend/config.local.php` and update the database settings. Keep this local file out of Git.
5. Start the frontend:

```powershell
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173**.

If your project path or Apache port differs, update the proxy in `frontend/vite.config.js`.

## Create the first admin

Register an account, then run this in phpMyAdmin using your registered email:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

Sign in as admin and select **Add Doctor**. Doctors can then sign in and add slots for patients to book. No default account passwords are included.

## Checks

Run from the project root:

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
C:/xampp/php/php.exe tests/final-review.php
```

The integration test needs Apache, PHP cURL, sample services, and permission to create/drop a temporary database. It creates and removes its own test data.

## Documentation

- [Database ERD and design notes](docs/ERD.md)
- [Final review and submission checklist](docs/FINAL_REVIEW.md)

Educational project; public deployment needs HTTPS and production configuration. Clinic timezone defaults to **Asia/Amman**; use the same timezone in your browser.
