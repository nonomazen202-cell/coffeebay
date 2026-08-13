import type { CollectionConfig } from 'payload';
import { isAdmin } from './access';
import { put, del } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

export const Media: CollectionConfig = {
  slug: 'media',
  timestamps: true,
  access: {
    read: () => true, // Publicly readable
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  upload: {
    // On Vercel, the project directory is read-only, so we use the writeable /tmp folder.
    // Locally, we use the standard 'media' folder.
    staticDir: process.env.BLOB_READ_WRITE_TOKEN ? '/tmp' : 'media',
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 300,
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
    mimeTypes: ['image/*'],
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if ((operation === 'create' || operation === 'update') && req.file) {
          const file = req.file as unknown as {
            filename?: string;
            name?: string;
            buffer?: Buffer;
            data?: Buffer;
            arrayBuffer?: () => Promise<ArrayBuffer>;
            mimetype?: string;
            mimeType?: string;
            type?: string;
          };
          
          const token = process.env.BLOB_READ_WRITE_TOKEN;

          // If token exists, we handle the upload to Vercel Blob
          if (token) {
            // 1. Resolve file buffer
            let fileBuffer: Buffer | null = null;
            if (typeof file.arrayBuffer === 'function') {
              fileBuffer = Buffer.from(await file.arrayBuffer());
            } else if (file.buffer) {
              fileBuffer = file.buffer;
            } else if (file.data) {
              fileBuffer = file.data;
            }

            if (!fileBuffer) {
              throw new Error('Uploaded file data buffer is empty or could not be read.');
            }

            // 2. Resolve filename and content type
            const filename = data.filename || file.filename || file.name || 'image.jpg';
            const mimeType = data.mimeType || file.mimeType || file.mimetype || file.type || 'image/jpeg';

            try {
              // 3. Upload the main file to Vercel Blob
              const mainBlob = await put(`media/${filename}`, fileBuffer, {
                access: 'public',
                contentType: mimeType,
                token,
              });
              
              // Set the Vercel Blob CDN URL directly on the document data object.
              // Payload's core upload hook runs BEFORE user-defined hooks, so
              // mutating data.url here will be saved directly to the database.
              data.url = mainBlob.url;

              // 4. Upload generated image sizes to Vercel Blob from the writeable staticDir (/tmp)
              if (data.sizes) {
                const staticDir = '/tmp';
                for (const sizeKey of Object.keys(data.sizes)) {
                  const sizeData = data.sizes[sizeKey];
                  if (sizeData && sizeData.filename) {
                    const localFilePath = path.join(staticDir, sizeData.filename);
                    if (fs.existsSync(localFilePath)) {
                      const sizeBuffer = fs.readFileSync(localFilePath);
                      const sizeBlob = await put(`media/${sizeData.filename}`, sizeBuffer, {
                        access: 'public',
                        contentType: mimeType,
                        token,
                      });
                      
                      // Map the size URL directly to the Vercel Blob CDN URL
                      data.sizes[sizeKey].url = sizeBlob.url;

                      // Clean up the local size file immediately
                      try {
                        fs.unlinkSync(localFilePath);
                      } catch (e) {
                        console.error(`Failed to delete local size file: ${localFilePath}`, e);
                      }
                    }
                  }
                }
              }
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              console.error('Failed to upload media to Vercel Blob:', err);
              throw new Error(`Vercel Blob Upload Failed: ${errorMessage}`);
            }
          }
        }
        return data;
      },
    ],
    afterChange: [
      async ({ doc, operation }) => {
        if (operation === 'create' || operation === 'update') {
          const token = process.env.BLOB_READ_WRITE_TOKEN;

          // Clean up temporary main file from /tmp after Payload writes it
          if (token && doc.filename) {
            const staticDir = '/tmp';
            const localFilePath = path.join(staticDir, doc.filename);
            if (fs.existsSync(localFilePath)) {
              try {
                fs.unlinkSync(localFilePath);
              } catch (e) {
                console.error(`Failed to delete local main file: ${localFilePath}`, e);
              }
            }
          }
        }
      },
    ],
    afterDelete: [
      async ({ doc }) => {
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        if (token) {
          const urlsToDelete: string[] = [];
          
          // Add main file URL
          if (doc.url && doc.url.startsWith('http')) {
            urlsToDelete.push(doc.url);
          }
          
          // Add size file URLs
          if (doc.sizes) {
            for (const sizeKey of Object.keys(doc.sizes)) {
              const sizeData = doc.sizes[sizeKey];
              if (sizeData && sizeData.url && sizeData.url.startsWith('http')) {
                urlsToDelete.push(sizeData.url);
              }
            }
          }

          // Delete all URLs from Vercel Blob in a single call
          if (urlsToDelete.length > 0) {
            try {
              await del(urlsToDelete, { token });
            } catch (e) {
              console.error('Failed to delete files from Vercel Blob:', e);
            }
          }
        }
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
};
