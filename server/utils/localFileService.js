const multer = require('multer');
const path = require('path');
const fs = require('fs');

class LocalFileService {
    constructor() {
        this.uploadsDir = './uploads';
        this.ensureDirectoriesExist();
    }

    ensureDirectoriesExist() {
        const directories = [
            this.uploadsDir,
            path.join(this.uploadsDir, 'bills'),
            path.join(this.uploadsDir, 'vehicle-images'),
            path.join(this.uploadsDir, 'documents'),
            path.join(this.uploadsDir, 'receipts'),
            path.join(this.uploadsDir, 'warehouse-layouts'),
            path.join(this.uploadsDir, 'exports')
        ];

        directories.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`Created directory: ${dir}`);
            }
        });
    }

    getUploadMiddleware(folderPath = 'documents') {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const uploadPath = path.join(this.uploadsDir, folderPath);
                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
                cb(null, uniqueName);
            }
        });

        return multer({
            storage: storage,
            limits: {
                fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
            },
            fileFilter: (req, file, cb) => {
                // Allow common file types
                const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
                const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
                const mimetype = allowedTypes.test(file.mimetype);

                if (mimetype && extname) {
                    return cb(null, true);
                } else {
                    cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
                }
            }
        });
    }

    // Upload file directly
    async uploadFile(fileBuffer, fileName, folderPath = 'documents') {
        const uploadPath = path.join(this.uploadsDir, folderPath);
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        const filePath = path.join(uploadPath, fileName);
        
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, fileBuffer, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        success: true,
                        path: filePath,
                        url: `/uploads/${folderPath}/${fileName}`,
                        filename: fileName
                    });
                }
            });
        });
    }

    // Delete file
    async deleteFile(filePath) {
        return new Promise((resolve, reject) => {
            fs.unlink(filePath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ success: true, message: 'File deleted successfully' });
                }
            });
        });
    }

    // List files in folder
    async listFiles(folderPath = '') {
        const fullPath = path.join(this.uploadsDir, folderPath);
        
        return new Promise((resolve, reject) => {
            fs.readdir(fullPath, { withFileTypes: true }, (err, files) => {
                if (err) {
                    reject(err);
                } else {
                    const fileList = files
                        .filter(file => file.isFile())
                        .map(file => {
                            const filePath = path.join(fullPath, file.name);
                            const stats = fs.statSync(filePath);
                            return {
                                filename: file.name,
                                path: filePath,
                                url: `/uploads/${folderPath}/${file.name}`,
                                size: stats.size,
                                createdAt: stats.birthtime,
                                modifiedAt: stats.mtime
                            };
                        });
                    
                    resolve({
                        success: true,
                        files: fileList
                    });
                }
            });
        });
    }

    // Get file info
    async getFileInfo(filePath) {
        return new Promise((resolve, reject) => {
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    resolve({ success: false, message: 'File not found' });
                } else {
                    resolve({
                        success: true,
                        size: stats.size,
                        createdAt: stats.birthtime,
                        modifiedAt: stats.mtime,
                        isFile: stats.isFile(),
                        isDirectory: stats.isDirectory()
                    });
                }
            });
        });
    }

    // Create export directory
    getExportPath(filename) {
        const exportDir = path.join(this.uploadsDir, 'exports');
        return path.join(exportDir, filename);
    }
}

module.exports = new LocalFileService();