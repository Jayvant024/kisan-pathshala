-- Apply this one-time migration once. Catalog rows are inserted only when their
-- stable slugs are absent; no existing course or learner data is overwritten.
USE kisan_pathshala;

ALTER TABLE profiles
	ADD COLUMN avatar_url VARCHAR(1024) NULL;

ALTER TABLE courses
	ADD COLUMN price_paise BIGINT UNSIGNED NOT NULL DEFAULT 0,
	ADD COLUMN gst_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
	ADD COLUMN thumbnail_url VARCHAR(1024) NULL,
	ADD COLUMN instructor_name VARCHAR(255) NULL;

ALTER TABLE orders
	ADD COLUMN payment_screenshot_path VARCHAR(255) NULL;

ALTER TABLE enrollments
	ADD COLUMN last_accessed_lesson_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
	ADD COLUMN last_accessed_at DATETIME(6) NULL;

CREATE TABLE IF NOT EXISTS payment_review_events (
	id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	reviewer_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	decision VARCHAR(16) NOT NULL,
	review_note TEXT NULL,
	created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	PRIMARY KEY (id),
	KEY idx_payment_review_events_order (order_id, created_at),
	KEY idx_payment_review_events_reviewer (reviewer_id, created_at),
	CONSTRAINT fk_payment_review_events_order FOREIGN KEY (order_id)
		REFERENCES orders (id) ON DELETE RESTRICT,
	CONSTRAINT fk_payment_review_events_reviewer FOREIGN KEY (reviewer_id)
		REFERENCES profiles (id) ON DELETE RESTRICT,
	CONSTRAINT chk_payment_review_events_decision CHECK (decision IN ('approved', 'rejected'))
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO courses (
	id, slug, title_en, title_hi, description_en, description_hi, category,
	level, status, display_order, price_paise, gst_percent, thumbnail_url
)
SELECT UUID(), 'crop-doctor', 'Crop Doctor', 'क्रॉप डॉक्टर',
	'Practical crop diagnosis and prevention for healthier, more resilient fields.',
	'स्वस्थ और मजबूत फसलों के लिए रोग पहचान और रोकथाम की व्यावहारिक जानकारी।',
	'Crop health', 'beginner', 'published', 1, 149900, 0,
	'/images/crops/crop-doctor.jpg'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM courses WHERE slug = 'crop-doctor');

INSERT INTO courses (
	id, slug, title_en, title_hi, description_en, description_hi, category,
	level, status, display_order, price_paise, gst_percent, thumbnail_url
)
SELECT UUID(), 'bk-banana-farming-sutra', 'BK Banana Farming SUTRA', 'बीके केला खेती सूत्र',
	'A structured guide to planning, growing and managing a productive banana crop.',
	'केले की बेहतर खेती की योजना, उत्पादन और प्रबंधन के लिए क्रमबद्ध मार्गदर्शन।',
	'Fruit crops', 'beginner', 'published', 2, 299900, 0,
	'/images/crops/banana.jpg'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM courses WHERE slug = 'bk-banana-farming-sutra');

INSERT INTO courses (
	id, slug, title_en, title_hi, description_en, description_hi, category,
	level, status, display_order, price_paise, gst_percent, thumbnail_url
)
SELECT UUID(), 'bk-papaya-farming-sutra', 'BK Papaya Farming SUTRA', 'बीके पपीता खेती सूत्र',
	'Learn the key decisions behind establishing and caring for a papaya orchard.',
	'पपीते के बाग की स्थापना और देखभाल के जरूरी पहलुओं को सीखें।',
	'Fruit crops', 'beginner', 'published', 3, 299900, 0,
	'/images/crops/papaya.jpg'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM courses WHERE slug = 'bk-papaya-farming-sutra');

INSERT INTO courses (
	id, slug, title_en, title_hi, description_en, description_hi, category,
	level, status, display_order, price_paise, gst_percent, thumbnail_url
)
SELECT UUID(), 'bk-anar-farming-sutra', 'BK Anar (Pomegranate) Farming SUTRA', 'बीके अनार खेती सूत्र',
	'A field-focused learning path for establishing and managing pomegranate crops.',
	'अनार की फसल की स्थापना और प्रबंधन के लिए खेत-केंद्रित सीख।',
	'Fruit crops', 'beginner', 'published', 4, 399900, 0,
	'/images/crops/pomegranate.jpg'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM courses WHERE slug = 'bk-anar-farming-sutra');

INSERT INTO courses (
	id, slug, title_en, title_hi, description_en, description_hi, category,
	level, status, display_order, price_paise, gst_percent, thumbnail_url
)
SELECT UUID(), 'bk-sugarcane-farming-sutra', 'BK Sugarcane Farming SUTRA', 'बीके गन्ना खेती सूत्र',
	'Plan and manage a sugarcane crop with practical, season-aware guidance.',
	'मौसम के अनुसार व्यावहारिक मार्गदर्शन से गन्ने की फसल की योजना और प्रबंधन करें।',
	'Field crops', 'beginner', 'published', 5, 399900, 0,
	'/images/crops/sugarcane.jpg'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM courses WHERE slug = 'bk-sugarcane-farming-sutra');

INSERT INTO courses (
	id, slug, title_en, title_hi, description_en, description_hi, category,
	level, status, display_order, price_paise, gst_percent, thumbnail_url
)
SELECT UUID(), 'farm-manager', 'Farm Manager', 'फार्म मैनेजर',
	'Build the planning, record-keeping and decision-making skills used to run a farm.',
	'खेत संचालन के लिए योजना, रिकॉर्ड रखने और निर्णय लेने के कौशल विकसित करें।',
	'Farm management', 'intermediate', 'published', 6, 1499900, 0,
	'/images/crops/farm-manager.jpg'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM courses WHERE slug = 'farm-manager');

INSERT INTO courses (
	id, slug, title_en, title_hi, description_en, description_hi, category,
	level, status, display_order, price_paise, gst_percent, thumbnail_url
)
SELECT UUID(), 'green-gurukulam', 'Green Gurukulam', 'ग्रीन गुरुकुलम',
	'An in-depth agricultural learning program for building practical farm knowledge.',
	'व्यावहारिक कृषि ज्ञान विकसित करने के लिए विस्तृत सीखने का कार्यक्रम।',
	'Farm management', 'intermediate', 'published', 7, 2500000, 18,
	'/images/crops/green-gurukulam.jpg'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM courses WHERE slug = 'green-gurukulam');