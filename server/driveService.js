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
 * Helper to get or create a subfolder inside a parent folder on Google Drive
 * @param {string} parentFolderId 
 * @param {string} folderName 
 * @returns {Promise<string>} Folder ID
 */
async function getOrCreateSubfolder(parentFolderId, folderName) {
  const drive = getDriveClient();
  
  // 1. Search for existing folder with the given name inside parent folder
  const escapedName = folderName.replace(/'/g, "\\'");
  const query = `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed = false`;
  
  const response = await drive.files.list({
    q: query,
    fields: 'files(id)',
    spaces: 'drive'
  });
  
  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id;
  }
  
  // 2. Create the folder if not found
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  };
  
  const folder = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id'
  });
  
  // Make the folder publicly readable so files placed inside inherit proper permissions
  try {
    await drive.permissions.create({
      fileId: folder.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
  } catch (permErr) {
    console.warn(`Failed to set folder permissions for '${folderName}':`, permErr.message);
  }
  
  return folder.data.id;
}

/**
 * Upload a file buffer directly to Google Drive (with optional subfolder mapping)
 * @param {Buffer} fileBuffer — The file data buffer
 * @param {string} fileName — The destination filename
 * @param {string} mimeType — File mime type (e.g. image/jpeg)
 * @param {string} [subfolderName] — Optional subfolder name to organize media
 * @returns {Promise<{fileId: string, url: string}>}
 */
async function uploadFileToDrive(fileBuffer, fileName, mimeType, subfolderName = null) {
  const drive = getDriveClient();
  let folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (folderId && subfolderName) {
    try {
      folderId = await getOrCreateSubfolder(folderId, subfolderName);
    } catch (err) {
      console.warn(`Failed to get or create subfolder '${subfolderName}':`, err.message);
    }
  }

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
