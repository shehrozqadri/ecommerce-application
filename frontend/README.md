# Ruhab Studio Frontend (Next.js Admin UI)

Modern admin interface scaffold inspired by Myntra-like color language.

## Included now
- Admin login page (`/admin/login`)
- Product management dashboard (`/admin/dashboard`)
  - Create product
  - List products
  - Edit product
  - Delete product
   - Upload multiple product images to Cloudinary in one go
   - Thumbnail preview and remove buttons in product form
   - Drag-and-drop upload area for quick image upload
   - Drag thumbnail reorder (first image is treated as primary)
   - Persists image `public_id` for backend media cleanup during update/delete
- JWT token storage and protected dashboard access

## Setup
1. Copy [frontend/.env.local.example](frontend/.env.local.example) to `.env.local`.
2. Install dependencies:
   - `npm install`
3. Run development server:
   - `npm run dev`

## Notes
- This UI uses backend endpoints under `${NEXT_PUBLIC_API_BASE_URL}`.
- Ensure FastAPI backend is running before using admin flows.
