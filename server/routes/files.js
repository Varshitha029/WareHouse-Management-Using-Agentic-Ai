const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const localFileService = require('../utils/localFileService');

// @route   POST /api/files/upload
// @desc    Upload file to local storage
// @access  Private
router.post('/upload', auth, (req, res) => {
    const upload = localFileService.getUploadMiddleware('bills');
    
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('File upload error:', err);
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // File uploaded successfully
        const fileInfo = {
            success: true,
            file: {
                filename: req.file.filename,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                url: `/uploads/bills/${req.file.filename}`,
                path: req.file.path,
                uploadedBy: req.user.id,
                uploadDate: new Date()
            }
        };

        res.json(fileInfo);
    });
});

// @route   POST /api/files/upload/vehicle-image
// @desc    Upload vehicle image
// @access  Private
router.post('/upload/vehicle-image', auth, (req, res) => {
    const upload = localFileService.getUploadMiddleware('vehicle-images');
    
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error('Vehicle image upload error:', err);
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image uploaded'
            });
        }

        const imageInfo = {
            success: true,
            image: {
                filename: req.file.filename,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                url: `/uploads/vehicle-images/${req.file.filename}`,
                path: req.file.path,
                uploadedBy: req.user.id,
                uploadDate: new Date()
            }
        };

        res.json(imageInfo);
    });
});

// @route   POST /api/files/upload/document
// @desc    Upload document (receipt, invoice, etc.)
// @access  Private
router.post('/upload/document', auth, (req, res) => {
    const upload = localFileService.getUploadMiddleware('documents');
    
    upload.single('document')(req, res, (err) => {
        if (err) {
            console.error('Document upload error:', err);
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No document uploaded'
            });
        }

        const documentInfo = {
            success: true,
            document: {
                filename: req.file.filename,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                url: `/uploads/documents/${req.file.filename}`,
                path: req.file.path,
                uploadedBy: req.user.id,
                uploadDate: new Date()
            }
        };

        res.json(documentInfo);
    });
});

// @route   DELETE /api/files/delete
// @desc    Delete file from local storage
// @access  Private
router.delete('/delete', auth, async (req, res) => {
    try {
        const { filePath } = req.body;
        
        await localFileService.deleteFile(filePath);

        res.json({
            success: true,
            message: 'File deleted successfully'
        });

    } catch (error) {
        console.error('File deletion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete file'
        });
    }
});

// @route   GET /api/files/list/:folder?
// @desc    List files in a folder
// @access  Private
router.get('/list/:folder?', auth, async (req, res) => {
    try {
        const { folder } = req.params;
        
        const result = await localFileService.listFiles(folder || '');

        res.json(result);

    } catch (error) {
        console.error('File listing error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list files'
        });
    }
});

// @route   GET /api/files/info
// @desc    Get file information
// @access  Private
router.get('/info', auth, async (req, res) => {
    try {
        const { filePath } = req.query;
        
        const fileInfo = await localFileService.getFileInfo(filePath);

        res.json(fileInfo);

    } catch (error) {
        console.error('File info error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get file information'
        });
    }
});

module.exports = router;