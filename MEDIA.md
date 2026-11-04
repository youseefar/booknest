# Property video storage

Property videos are stored in Cloudinary using server-side signed uploads. Set
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in
the deployment environment. Keep the API secret private; it is never sent to
the browser. If these values are not configured, property listings without a
video continue to work and video-management actions are unavailable.

Uploads accept MP4, MOV, and WebM files up to 50 MB. New and replacement
uploads are validated before they are stored. Existing property documents and
their image URLs are preserved; the application does not provide image
uploads.

Cloudinary assets no longer referenced by a property are processed through
the `CloudinaryVideoCleanup` MongoDB collection. The cleanup worker starts
when the application connects to MongoDB and has Cloudinary credentials.
Failed deletions are retried. Assets are checked against property records
before deletion to avoid removing a video that is still in use.
