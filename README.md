# 📦 Smart Object Detection (Mobile AI Pipeline)

## 🚀 Overview

This project is a real-time smart object detection system designed to run entirely on mobile devices using **Expo (React Native)** and a client-side optimized **YOLOv8** model.

The goal is to build a fast, intelligent detection pipeline that goes beyond basic object detection by introducing a multi-layer processing system:

> **Detect → Understand → Match → Learn**

This system must be:

- ⚡ **Real-time** (low latency)
- 📱 **Mobile-first** (runs on device)
- 🧠 **Intelligent** (context-aware)
- 🔁 **Self-improving** (learning from usage)

---

## 🎯 Objectives

You are required to build a system that:

- Detects objects from a live camera feed using YOLOv8
- Extracts additional information (text, color, etc.)
- Matches detected objects to structured data
- Assigns a confidence score to each match
- Handles unknown objects gracefully
- Learns from user corrections over time

---

## 🧱 System Architecture

The system is divided into **5 core layers**:

### 1️⃣ Detection Layer (YOLOv8 — Client Side)

**Responsibility:** Detect objects in real-time from camera frames

**Requirements:**
- Use a YOLOv8 model optimized for mobile
- Model must run on-device (no API calls)
- Use TensorFlow Lite / ONNX / compatible mobile runtime
- Process frames at ~10–30 FPS target

**Output Example:**
```json
{ "class": "bottle", "confidence": 0.87, "bbox": [x, y, width, height] }
```

---

### 2️⃣ Feature Extraction Layer

**Responsibility:** Enhance raw detections with additional signals.

**Extract:**
- 📝 OCR Text (from object region)
- 🎨 Dominant color
- 📐 Size / bounding box ratio
- 🧩 Shape hints (optional)

**Tools:**
- Expo Camera
- Lightweight OCR library (or mock if needed)
- Custom utilities for color extraction

**Output Example:**
```json
{ "class": "bottle", "ocr_text": "coca cola", "color": "red", "confidence": 0.87 }
```

---

### 3️⃣ Normalization Layer *(CORE LOGIC)*

**Responsibility:** Convert raw detection data into a standardized object identity

**Input:**
```json
{ "class": "bottle", "ocr_text": "coca cola", "color": "red" }
```

**Output:**
```json
{ "label": "soft_drink", "normalized_name": "cola", "confidence": 0.82 }
```

**Requirements:**
- Implement rule-based + similarity-based matching
- Use:
  - String similarity (OCR vs known labels)
  - Class mapping
  - Heuristic rules

---

### 4️⃣ Matching & Scoring Layer

**Responsibility:** Match normalized object to a known dataset

You must implement a **scoring system**:

```
score = OCR similarity (50%) + class match (20%) + color match (10%) + historical match (20%)
```

**Output:**
```json
{ "matched_item": "cola_500ml", "confidence": 0.91 }
```

**Rules:**
| Confidence | Action |
|---|---|
| ≥ 0.8 | Accept match |
| 0.5–0.8 | Return suggestions |
| < 0.5 | Mark as UNKNOWN |

---

### 5️⃣ Learning Layer (Persistence)

**Responsibility:** Improve system over time

**Behavior:**
- When user corrects a result:
  ```
  Detected → Wrong → User selects correct item → Save mapping
  ```

**Storage:**
- `AsyncStorage` (local)
- or lightweight local DB

**Goal:** System becomes more accurate with usage

---

## 📱 Frontend Requirements (Expo)

### 🎥 Camera Integration
- Use Expo Camera
- Show:
  - Live preview
  - Bounding boxes
  - Detected labels

### 🧠 Real-Time Processing
- Process frames every **200ms – 500ms** (NOT every frame)

### 🧾 UI Requirements

Display:
- Detected object
- Confidence score
- Matched item
- "Unknown" fallback

### 🧑‍💻 User Interaction

Allow:
- User to confirm detection
- User to correct detection
- Save correction for learning

---

## ⚙️ Technical Constraints

### ✅ Must Use
- Expo (React Native)
- Client-side YOLOv8 model
- No heavy backend dependency

### ❌ Avoid
- Cloud-based detection
- Blocking UI threads
- Large model sizes (>50MB ideally)

---

## 🧪 Testing Requirements

| Test | Requirement |
|---|---|
| **Detection** | Objects detected correctly |
| **Matching** | Correct mapping to known items |
| **Unknown Handling** | Unknown objects handled gracefully |
| **Performance** | No UI lag, smooth camera experience |
| **Learning** | Corrections improve future detection |

---

## 📂 Suggested Project Structure

```
src/
├── camera/
├── detection/
├── feature_extraction/
├── normalization/
├── matching/
├── learning/
├── utils/
└── components/
```

---

## 🔄 Development Workflow

### Branch Naming
```
feature/detection-layer
feature/normalization-engine
feature/matching-system
feature/learning-module
```

### Pull Requests Must Include:
- What was implemented
- How to test
- Screenshots (if UI)
- Edge cases handled

---

## 🎯 Definition of Done

A feature is complete when:

- ✅ Works on real device (Expo)
- ✅ No crashes or UI blocking
- ✅ Handles edge cases
- ✅ Code is clean and documented
- ✅ PR is reviewed and approved

---

## 💡 Important Notes

- Focus on **speed + simplicity** first
- Do NOT overcomplicate models
- The intelligence comes from **the pipeline**, not just detection
- Think in **systems**, not isolated functions

---

## 🚀 Final Goal

Build a system where:

> 📸 Camera sees object → system understands → returns meaningful result → improves over time

If done correctly, this becomes a foundation for intelligent real-time vision systems.
