# MIT BG REMOVER | Mahaguru Institute of Technology

> **Bulk Student Portrait Matting & Biometric ID Card Studio**  
> 100% In-Browser AI • Private & Serverless • Ready for Vercel 1-Click Deployment

---

## 🌟 Key Features

1. **In-Browser Client-Side AI (BRIA RMBG-1.4)**:
   - Uses WebGPU and WebAssembly (WASM) hardware acceleration.
   - Zero server upload: Student photos never leave the user's browser (maximum privacy).
   - Can process 100+ photos in a single batch without server timeouts or payload limits.

2. **Official Mahaguru Institute of Technology Branding**:
   - Institutional banner, terracotta maroon (`#963816`), MIT royal blue (`#0052CC`), and saffron amber (`#F59E0B`).
   - Distinctive typography: `Cinzel`, `Montserrat`, `Plus Jakarta Sans`, and `JetBrains Mono`.

3. **Streamlined Dimensions (Strictly 2 Options)**:
   - **Passport Size Photo Dimension (`35 × 45 mm`)**: Standard ISO 35:45 at 300 DPI (`413 × 531 px`).
   - **Custom Dimension**: Width, Height, Units (`mm`/`in`/`px`), and DPI (`300`, `150`, `96`).

4. **Automatic Biometric Face Centering**:
   - Detects head crown from alpha channel.
   - Calculates facial midline to center the head horizontally.
   - Applies standard 10% headroom above crown.
   - Frames shoulders and chest to standard ID proportions.

5. **Explicit Post-Removal Recropper**:
   - Interactive modal on every student card.
   - Draggable & resizable crop box with corner handles (`nw`, `ne`, `sw`, `se`).
   - Quick aspect ratio locks: Passport (35:45), Square (1:1), and Freeform.
   - "Auto Center Face" button and live caliper dimension readout.
   - Instant lossless canvas recropping.

6. **Bulk Downloads**:
   - **Download All as ZIP**: Direct client-side ZIP archive generation using `JSZip`.
   - **Download All as Photos**: Sequential batch photo download.
   - Single photo direct download.

---

## 🚀 Local Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

---

## 🌐 Deploy to Vercel

### Method 1: Git Push (Automatic Deployment)
1. Commit and push your code to your GitHub repository:
   ```bash
   git add .
   git commit -m "Deploy Mahaguru ID Studio"
   git push origin main
   ```
2. In [Vercel](https://vercel.com/new), import your `agri` repository.
3. Vercel automatically detects the Vite framework and runs `npm run build`.
4. Click **Deploy**!

### Method 2: Vercel CLI
```bash
npx vercel
```
