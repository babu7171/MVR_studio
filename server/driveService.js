// driveService.js — Helper for Google Drive API operations
'use strict';

const { google } = require('googleapis');
const stream = require('stream');

let driveClient = null;

/**
 * Get or initialize the Google Drive API client
 */
function getDriveClient() {
  if (!driveClient) {
    const credentialsJson = process.env.GOOGLE_DRIVE_CREDENTIALS;
    if (!credentialsJson) {
      throw new Error('GOOGLE_DRIVE_CREDENTIALS environment variable is missing.');
    }
    try {
      const credentials = JSON.parse(credentialsJson);
      
      const privateKey = credentials.private_key
        ? credentials.private_key.replace(/\\n/g, '\n')
        : null;

      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/drive']
      });

      driveClient = google.drive({ version: 'v3', auth });
    } catch (err) {
      throw new Error(`Failed to initialize Google Drive client: ${err.message}`);
    }
  }
  return driveClient;
}

/**
 * Upload a file buffer directly to Google Drive
 * @param {Buffer} fileBuffer — The file data buffer
 * @param {string} fileName — The destination filename
 * @param {string} mimeType — File mime type (e.g. image/jpeg)
 * @returns {Promise<{fileId: string, url: string}>}
 */
async function uploadFileToDrive(fileBuffer, fileName, mimeType) {
  const drive = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const bufferStream = new stream.PassThrough();
  bufferStream.end(fileBuffer);

  const fileMetadata = {
    name: fileName,
    parents: folderId ? [folderId] : []
  };

  const media = {
    mimeType: mimeType,
    body: bufferStream
  };

  // 1. Upload the file to Google Drive
  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id'
  });

  const fileId = response.data.id;

  // 2. Set public permissions so anyone can view it
  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    }
  });

  // 3. Generate the direct public CDN image link
  // Format: https://lh3.googleusercontent.com/d/FILE_ID
  const cdnUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

  return {
    fileId,
    url: cdnUrl
  };
}

/**
 * Delete a file from Google Drive by its file ID
 * @param {string} fileId 
 */
async function deleteFileFromDrive(fileId) {
  if (!fileId) return;
  const drive = getDriveClient();
  await drive.files.delete({
    fileId: fileId
  });
}

/**
 * Helper to extract Google Drive File ID from a URL
 * @param {string} url 
 * @returns {string|null}
 */
function extractFileId(url) {
  if (!url) return null;
  
  // Format: https://lh3.googleusercontent.com/d/FILE_ID
  if (url.includes('googleusercontent.com/d/')) {
    const parts = url.split('/d/');
    return parts[parts.length - 1];
  }
  
  // Format: https://drive.google.com/file/d/FILE_ID/view
  if (url.includes('drive.google.com/')) {
    const parts = url.split('/d/');
    if (parts.length > 1) {
      return parts[1].split('/')[0];
    }
  }
  
  return null;
}

module.exports = {
  uploadFileToDrive,
  deleteFileFromDrive,
  extractFileId
};
