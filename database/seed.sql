-- Optional sample services only; no accounts, passwords, or patient records.
INSERT INTO services (name, duration_minutes, price) VALUES
('Dental Checkup', 30, 15.00),
('Teeth Cleaning', 60, 35.00)
ON DUPLICATE KEY UPDATE name = VALUES(name);
