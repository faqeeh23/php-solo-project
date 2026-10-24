# Dental Appointment System

A dental appointment booking system built with React, PHP OOP, PDO, and MySQL/MariaDB.

## Features and roles

| Role | Capabilities |
| --- | --- |
| Patient | Register, sign in, browse services and available slots, book appointments, view and cancel their own future bookings |
| Doctor | Create their own slots, view their schedule and assigned bookings, confirm future pending bookings, complete confirmed bookings after their end time |
| Admin | Create doctor accounts, list doctors, monitor all bookings, cancel future pending or confirmed bookings |

Doctors control their availability. Admins cannot add slots or confirm appointments. Doctors can remove future slots only when they have no booking history; cancelled booking history is retained. All roles can sign out using the shared responsive navigation. Guests can browse the public services and availability API.

## Requirements

- XAMPP with Apache and MySQL/MariaDB; PHP 8.0+ with PDO MySQL and mbstring. The review script also needs PHP cURL.
- MySQL 8.0.16+ or MariaDB 10.2.1+ for generated columns and enforced CHECK constraints. Use InnoDB.
- Node.js compatible with Vite 8 (22.12+ or a supported newer LTS), and npm.

## Installation on XAMPP

1. Place the project at C:/xampp/htdocs/xampp/php-solo-project and start Apache and MySQL.
2. In phpMyAdmin, create an empty database named dental_system using utf8mb4_unicode_ci. Select it and import [database/schema.sql](database/schema.sql), then optionally [database/seed.sql](database/seed.sql) for two example services. The schema creates four tables and contains no accounts or personal records. It is intended for a fresh database; do not import over an existing installation.
3. Copy backend/config.example.php to backend/config.local.php if your local database settings differ. Set host, name, username, password, and timezone. The local file is ignored by Git. Alternatively configure DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, and APP_TIMEZONE in the Apache environment. Defaults target local XAMPP, an empty password, and Asia/Amman. PHP does not automatically load .env files. Restart Apache after changing its environment.
4. Install and start the frontend:

~~~powershell
cd frontend
npm ci
npm run dev
~~~

5. Open http://localhost:5173. Register a patient account. To bootstrap the first admin, promote that account in phpMyAdmin using its actual email:

~~~sql
UPDATE users SET role = 'admin' WHERE email = 'your-registered-email@example.com';
~~~

Sign in as admin, use Add Doctor to create the doctor's credentials, then sign in as that doctor to create availability. Sign in as a patient to book it. No predefined account passwords are shipped.

The proxy in frontend/vite.config.js sends /api to http://localhost/xampp/php-solo-project/backend/api.php. Update that target/path if Apache uses another port or the project folder changes. Open the app through Vite, rather than opening the HTML directly. npm run preview does not configure this development proxy; production hosting must route /api to PHP and serve React routes through index.html.

## Database and ERD

The four tables are users, services, appointment_slots, and appointments. See [ERD and normalization](docs/ERD.md) and the executable [schema](database/schema.sql).

Foreign keys retain referential integrity. A generated active_slot_id equals slot_id for every non-cancelled appointment and NULL for cancelled ones. Its unique index prevents two active bookings for the same slot, including simultaneous inserts, while allowing cancelled history and rebooking. Completed appointments remain non-cancelled and retain the slot.

Doctor and patient role restrictions are enforced by PHP; foreign keys alone only verify that a user exists. Slot overlap prevention uses a transaction and locks the doctor row, serializing additions through Appointment::addSlot(). Direct SQL inserts bypass that overlap rule.

## Architecture

React pages call frontend/src/api.js through the services re-export. ProtectedRoute verifies the server session before rendering a role's dashboard. PHP api.php dispatches actions, validates inputs, checks CSRF tokens, and refreshes the account role from the database. User, Appointment, and Admin encapsulate database operations. Database creates the PDO connection and injects it into those models via their constructors; this is dependency injection.

Prepared statements bind request values separately from SQL. Passwords are stored using password_hash and checked with password_verify. Session IDs regenerate at login. Sessions use HttpOnly and SameSite=Lax cookies; HTTPS requests receive Secure cookies. Each mutation obtains a session-bound CSRF token and sends X-CSRF-Token, including login, registration, and logout. Tokens from other sessions are rejected. Responses containing session data are not cached.

## API actions

All actions use /api?action=ACTION. Mutations use JSON and the X-CSRF-Token header. Obtain the token with GET csrf-token using the same session cookies.

| Method | Actions | Access |
| --- | --- | --- |
| GET | csrf-token, services, slots | Public |
| POST | register, login | Public with CSRF |
| GET | me | Authenticated |
| POST | logout | Session with CSRF |
| GET | my-appointments | Patient |
| POST | book, cancel | Patient |
| GET | doctor-appointments, doctor-slots | Doctor |
| POST | doctor-add-slot, doctor-delete-slot, doctor-update | Doctor |
| GET | admin-doctors, admin-appointments | Admin |
| POST | admin-add-doctor, admin-update | Admin |

The doctor ID for slot creation and deletion comes from the session. Clients cannot assign slots to another doctor. admin-update accepts cancellation only; doctor-update accepts confirmation/completion under the time and status rules.

## Verification

~~~powershell
cd frontend
npm run lint
npm run build
cd ..
C:/xampp/php/php.exe tests/final-review.php
~~~

The review script needs Apache, the configured database, a database user permitted to create/drop a temporary review database, and PHP cURL. It imports the schema into an isolated database, checks constraints, and exercises the HTTP API using temporary accounts in the configured app database. Its finally blocks delete only its own fixtures and temporary database. Existing bookings are not edited. Override REVIEW_API_URL in the process environment when Apache uses another URL.

See [review results and manual checklist](docs/FINAL_REVIEW.md). Browser redirects, responsive layouts, and screenshots require the manual checks listed there.

## Scope and deployment limits

This is an educational project. Payments, medical records, notifications, password reset, and login rate limiting are outside the implemented scope. Before public deployment, use HTTPS, dedicated database credentials, production routing and session configuration, and review operational security. Appointment strings in the UI are interpreted in the browser's timezone; use the clinic timezone (Asia/Amman by default) for this local submission. PHP and MySQL are configured to the clinic timezone on each connection. Do not commit local credentials, account exports, or personal records.
