# BrandGuard AI — Pre-Publication Marketing Governance & Compliance

> 🌐 **Official Live Production URL**: [https://brand-guard-ai-9wao.vercel.app](https://brand-guard-ai-9wao.vercel.app)  
> 🚀 **Direct Review & Upload Form**: [https://brand-guard-ai-9wao.vercel.app/reviews/new](https://brand-guard-ai-9wao.vercel.app/reviews/new)  
> 📊 **Review History & Audit Logs**: [https://brand-guard-ai-9wao.vercel.app/reviews](https://brand-guard-ai-9wao.vercel.app/reviews)

An automated, end-to-end multi-modal marketing governance engine designed to audit creative assets against regulatory guidelines, factual claims, and authorized digital assets before publication.

Built for the Hackathon.

---

## 🚀 Key Capabilities

- **Multi-Modal Vision & OCR Analysis**: Extracts and inspects visual layouts, disclaimers, fonts, and text hierarchy from marketing creatives using Tesseract OCR and Sharp.
- **Cross-Modal Consistency & Fact-Checking**: Validates marketing claims against enterprise truth bases and authorized claims libraries.
- **Rule Engine & Scoring**: Deterministic compliance checks covering missing disclaimers, prohibited terminology, font size ratios, and mandatory disclosures.
- **Remediation & Apply Fix**: Automatic generation of compliant creative variants with side-by-side visual diff and re-evaluation.
- **Executive Audit Reports**: Real binary PDF report generation (`pdfkit` / `pdf-lib`) and RFC 8259 structured JSON export with digital cryptographic-grade governance trails.
- **Audit Data Storage**: Robust persistence across reviews, rules, enterprise truth facts, and authorized asset registries.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack, React 19)
- **Styling**: Tailwind CSS, Lucide Icons
- **Image Processing & OCR**: Sharp, Tesseract.js
- **PDF & Export Engine**: PDFKit, PDF-Lib
- **Data & Persistence**: Audit Data Storage (Supabase PostgreSQL / Local Fallback)

---

## 📦 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file with the following variables:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key (optional, engine features robust deterministic fallbacks)
```

### 3. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to explore BrandGuard AI.

### 4. Build for Production
```bash
npm run build
npm run start
```

---

## 🧪 Testing & Verification
```bash
# Run acceptance test suite
npx tsx scripts/test-user-acceptance-suite.ts

# Run PDF report generation suite
npx tsx scripts/test-pdf-export-suite.ts
```
