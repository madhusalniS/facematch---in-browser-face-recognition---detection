# FaceMatch — In-Browser Face Recognition & Detection

FaceMatch is a client-side biometric web application that detects faces in uploaded images (and live webcam video) and classifies each face as **KNOWN** (with the person's name) or **UNKNOWN**.

All processing runs 100% in the user's web browser using WebGL / WASM acceleration. No photos, face crops, or embeddings are ever sent to an external server.

---

## How It Works

### 1. Face Detection & 68-Point Facial Landmarks
When an image or video frame is supplied:
- **Detector**: The app utilizes either **TinyFaceDetector** (fast, ~190KB weights, ideal for real-time webcam) or **SSD MobileNet v1** (deep neural net, high accuracy for complex group photos).
- **68-Point Mesh**: Once a face is detected, a 68-point facial landmark network locates critical anatomical points (jaw contours, eyes, nose bridge, lip contours).
- **Alignment**: The face is rotated, scaled, and affine-transformed to a standardized canonical orientation, ensuring invariant comparison regardless of head tilt.

### 2. 128-Dimensional Deep Metric Embedding
- An aligned face image is passed through a deep convolutional neural network (ResNet-34 based) trained on triplet loss.
- The network outputs a **128-dimensional unit vector** ($\mathbf{u} \in \mathbb{R}^{128}$).
- This vector maps human facial geometry into a continuous hypersphere space where identical identities cluster tightly together and distinct identities are separated.

### 3. Euclidean Distance Metric & Decision Threshold
To classify a face:
1. FaceMatch compares the query 128-D descriptor $\mathbf{q}$ against all enrolled identities in the local database.
2. For each enrolled person with reference photos $\{\mathbf{p}_1, \dots, \mathbf{p}_k\}$, the minimum Euclidean distance is calculated:
   $$d(\mathbf{q}, \mathbf{p}) = \sqrt{\sum_{i=0}^{127} (q_i - p_i)^2}$$
3. The closest enrolled person and minimum distance $d_{\min}$ are determined.
4. **Decision Rule**:
   - If $d_{\min} \le \text{Threshold}$ (default **0.50**): Labeled as **KNOWN** with person's name, green bounding box, and confidence score.
   - If $d_{\min} > \text{Threshold}$: Labeled as **UNKNOWN** with red bounding box.

#### Threshold Calibration Guide:
- **0.30 - 0.40 (Strict / High Security)**: Minimizes false positives. Suitable when avoiding mistaken identity is paramount.
- **0.50 (Default / Balanced)**: Optimal trade-off between false accepts and false rejects under varying ambient lighting.
- **0.60 - 0.70 (Permissive)**: Reduces false negatives for blurry, low-resolution, or angled images, with higher tolerance.

---

## Core Features

1. **Enroll Known People**
   - Register identities with 1 to 5 clear reference photos or direct webcam capture.
   - Strict validation: rejects photos with 0 faces or >1 faces with descriptive feedback.
   - Stored in browser's local **IndexedDB** (`enrolled_people` store).
   - Instant "Load Sample Profiles" button to test with demo personas (Elena, David, Maya).

2. **Recognize Faces in Images**
   - Drag-and-drop or upload test images (auto-resized to max 1280px to preserve performance).
   - Detects all faces simultaneously.
   - Canvas overlay: Green box + Name + Confidence % for KNOWN; Red box + "Unknown" for UNKNOWN.
   - Results panel: Total faces count, Known count, Unknown count, and interactive breakdown table with face crops, bounding box dimensions, and distance scores.

3. **Live Webcam Mode**
   - Real-time video processing (~5 fps) with live canvas annotations and active frame counter.
   - Front/rear camera switching and horizontal mirror toggle.

4. **Settings & Controls**
   - Adjustable threshold slider (0.30 to 0.70).
   - Choice of detector: TinyFaceDetector vs SSD MobileNet.
   - 68-point facial landmarks mesh overlay toggle.
   - "Clear all data" button with confirmation safety.

5. **Export**
   - Download the composite annotated image as **PNG**.
   - Download the recognition audit results as **CSV**.

---

## Privacy & Security

- **Zero Remote Uploads**: No image or biometric descriptor ever leaves the browser.
- **Local Persistence**: Enrolled profiles and descriptors are stored strictly in IndexedDB on the user's device.
- **Ethical Notice**: The application informs users to only enroll individuals who have granted explicit consent.
