# Ruhab Studio Backend (FastAPI)

Admin-first backend scaffold for ecommerce operations.

## Included now
- Admin bootstrap and login (JWT access token)
- Protected admin profile route
- Admin product CRUD routes
- MongoDB wiring with configurable collection names
- Environment-based settings

## Setup
1. Copy [backend/.env.example](backend/.env.example) to `.env` in this folder.
2. Create and activate a virtual environment.
3. Install dependencies:
   - `pip install -r requirements.txt`
4. Run API:
   - `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

## First admin flow
1. `POST /api/v1/admin/auth/bootstrap` (only works when no admin exists)
2. `POST /api/v1/admin/auth/login`
3. Use bearer token for `/api/v1/admin/products` endpoints

### Super admin behavior
- The first bootstrapped admin is created as `super_admin`.
- Only `super_admin` can manage other admins.

## Admin product endpoints
- `POST /api/v1/admin/products`
- `GET /api/v1/admin/products`
- `GET /api/v1/admin/products/{product_id}`
- `PUT /api/v1/admin/products/{product_id}`
- `DELETE /api/v1/admin/products/{product_id}`

## Admin management endpoints
- `GET /api/v1/admin/admins`
- `GET /api/v1/admin/admins/{admin_id}`
- `POST /api/v1/admin/admins`
- `PUT /api/v1/admin/admins/{admin_id}`
- `PATCH /api/v1/admin/admins/{admin_id}/deactivate`
- `DELETE /api/v1/admin/admins/{admin_id}`

## Admin media endpoints
- `POST /api/v1/admin/media/upload-image` (multipart form field name: `file`)
- `POST /api/v1/admin/media/upload-images` (multipart form field name: `files`, supports multiple)

### Media cleanup behavior
- Product `PUT` compares old vs new image `public_id` values and deletes removed Cloudinary assets.
- Product `DELETE` removes product images from Cloudinary before deleting the product record.
