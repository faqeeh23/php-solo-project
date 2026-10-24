-- Dental Appointment System: schema only, no user data.
-- Import into an empty selected database. No DROP statements.

CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','doctor','patient') NOT NULL DEFAULT 'patient',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `services` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `duration_minutes` int(10) unsigned NOT NULL,
  `price` decimal(8,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  CONSTRAINT `CONSTRAINT_1` CHECK (`duration_minutes` > 0),
  CONSTRAINT `CONSTRAINT_2` CHECK (`price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `appointment_slots` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `doctor_id` int(10) unsigned NOT NULL,
  `slot_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `doctor_id` (`doctor_id`,`slot_date`,`start_time`),
  CONSTRAINT `appointment_slots_ibfk_1` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`),
  CONSTRAINT `CONSTRAINT_1` CHECK (`end_time` > `start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `appointments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` int(10) unsigned NOT NULL,
  `service_id` int(10) unsigned NOT NULL,
  `slot_id` int(10) unsigned NOT NULL,
  `status` enum('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `active_slot_id` int(10) unsigned GENERATED ALWAYS AS (case when `status` <> 'cancelled' then `slot_id` else NULL end) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_active_slot` (`active_slot_id`),
  KEY `service_id` (`service_id`),
  KEY `slot_id` (`slot_id`),
  KEY `idx_patient_status` (`patient_id`,`status`),
  CONSTRAINT `appointments_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`),
  CONSTRAINT `appointments_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`),
  CONSTRAINT `appointments_ibfk_3` FOREIGN KEY (`slot_id`) REFERENCES `appointment_slots` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
