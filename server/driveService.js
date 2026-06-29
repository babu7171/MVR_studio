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
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    // 1. Try OAuth2 User authentication first (avoids service account zero quota limits)
    if (clientId && clientSecret && refreshToken) {
      try {
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        driveClient = google.drive({ version: 'v3', auth: oauth2Client });
        console.log('☁️ Google Drive client initialized using OAuth2 User Refresh Token');
        return driveClient;
      } catch (oauthErr) {
        console.warn('⚠️ Failed to initialize Google Drive OAuth2 User client:', oauthErr.message);
      }
    }

    // 2. Fallback to Service Account JWT authentication
    const credentialsJson = process.env.GOOGLE_DRIVE_CREDENTIALS;
    if (credentialsJson) {
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
        console.log('☁️ Google Drive client initialized using Service Account JWT');
        return driveClient;
      } catch (err) {
        throw new Error(`Failed to initialize Google Drive Service Account client: ${err.message}`);
      }
    }

    throw new Error('Neither Google OAuth2 User credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) nor Service Account credentials (GOOGLE_DRIVE_CREDENTIALS) are configured.');
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
 * Upload a file from disk directly to Google Drive (with optional subfolder mapping)
 * @param {string} filePath — The absolute path to the file on disk
 * @param {string} fileName — The destination filename
 * @param {string} mimeType — File mime type (e.g. image/jpeg)
 * @param {string} [subfolderName] — Optional subfolder name to organize media
 * @returns {Promise<{fileId: string, url: string}>}
 */
async function uploadFileToDrive(filePath, fileName, mimeType, subfolderName = null) {
  const drive = getDriveClient();
  let folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (folderId && subfolderName) {
    try {
      folderId = await getOrCreateSubfolder(folderId, subfolderName);
    } catch (err) {
      console.warn(`Failed to get or create subfolder '${subfolderName}':`, err.message);
    }
  }

  const fs = require('fs');
  const media = {
    mimeType: mimeType,
    body: fs.createReadStream(filePath)
  };

  const fileMetadata = {
    name: fileName,
    parents: folderId ? [folderId] : []
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

/**
 * List all backup files in the Google Drive folder
 * @returns {Promise<Array<{id: string, name: string, createdTime: string}>>}
 */
async function listBackupsInDrive() {
  const drive = getDriveClient();
  let folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  
  if (folderId) {
    try {
      folderId = await getOrCreateSubfolder(folderId, 'backups');
    } catch (err) {
      console.warn('Failed to find backups folder, searching globally in app folder:', err.message);
    }
  }

  const query = folderId 
    ? `'${folderId}' in parents and name contains 'mvr_studio_backup_' and trashed = false`
    : `name contains 'mvr_studio_backup_' and trashed = false`;

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name, createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 20
  });

  return response.data.files || [];
}

/**
 * Download a file from Google Drive and save it to disk
 * @param {string} fileId
 * @param {string} destPath
 * @returns {Promise<void>}
 */
async function downloadFileFromDrive(fileId, destPath) {
  const drive = getDriveClient();
  const fs = require('fs');
  const dest = fs.createWriteStream(destPath);
  
  const response = await drive.files.get(
    { fileId: fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return new Promise((resolve, reject) => {
    response.data
      .on('end', () => {
        resolve();
      })
      .on('error', err => {
        reject(err);
      })
      .pipe(dest);
  });
}

module.exports = {
  uploadFileToDrive,
  deleteFileFromDrive,
  extractFileId,
  listBackupsInDrive,
  downloadFileFromDrive
};
