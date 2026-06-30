import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Folder,
  Refresh,
  Download,
  Visibility,
  Upload,
  Description,
  Receipt,
  Assignment,
  Delete,
  Add
} from '@mui/icons-material';
import axios from 'axios';

const DocumentVault = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadCategory, setUploadCategory] = useState('other');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const documentCategories = [
    { value: 'storage_agreement', label: 'Storage Agreement', icon: <Assignment />, color: '#1976d2' },
    { value: 'rent_receipt', label: 'Rent Receipt', icon: <Receipt />, color: '#2e7d32' },
    { value: 'loan_agreement', label: 'Loan Agreement', icon: <Description />, color: '#9c27b0' },
    { value: 'emi_receipt', label: 'EMI Receipt', icon: <Receipt />, color: '#ed6c02' },
    { value: 'quality_report', label: 'Quality Report', icon: <Description />, color: '#0288d1' },
    { value: 'invoice', label: 'Invoice', icon: <Receipt />, color: '#d32f2f' },
    { value: 'other', label: 'Other', icon: <Description />, color: '#757575' }
  ];

  const fetchDocuments = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/files/my-documents', {
        headers: { 'x-auth-token': token }
      });
      setDocuments(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch documents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleRefresh = () => {
    fetchDocuments();
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size exceeds 10MB limit');
        return;
      }
      setUploadFile(file);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      alert('Please select a file');
      return;
    }

    try {
      setUploading(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('document', uploadFile);
      formData.append('category', uploadCategory);
      formData.append('description', uploadDescription);

      await axios.post('/api/files/upload-document', formData, {
        headers: {
          'x-auth-token': token,
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadDialogOpen(false);
      setUploadFile(null);
      setUploadCategory('other');
      setUploadDescription('');
      fetchDocuments();
    } catch (err) {
      alert('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (documentId, filename) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/files/download/${documentId}`, {
        headers: { 'x-auth-token': token },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to download document');
    }
  };

  const handleView = async (documentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/files/view/${documentId}`, {
        headers: { 'x-auth-token': token },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      window.open(url, '_blank');
    } catch (err) {
      alert('Failed to view document');
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/files/documents/${documentId}`, {
        headers: { 'x-auth-token': token }
      });
      fetchDocuments();
    } catch (err) {
      alert('Failed to delete document');
    }
  };

  const getCategoryInfo = (category) => {
    return documentCategories.find(c => c.value === category) || documentCategories[documentCategories.length - 1];
  };

  const getDocumentsByCategory = (category) => {
    return documents.filter(doc => doc.category === category);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Folder sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Document Vault
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<Upload />}
            onClick={() => setUploadDialogOpen(true)}
          >
            Upload Document
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Store and access all your warehouse-related documents in one secure place. Maximum file size: 10MB.
      </Alert>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Total Documents
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {documents.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Receipts
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {getDocumentsByCategory('rent_receipt').length + getDocumentsByCategory('emi_receipt').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Agreements
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {getDocumentsByCategory('storage_agreement').length + getDocumentsByCategory('loan_agreement').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Reports
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {getDocumentsByCategory('quality_report').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Documents by Category */}
      {documentCategories.map((category) => {
        const categoryDocs = getDocumentsByCategory(category.value);
        if (categoryDocs.length === 0) return null;

        return (
          <Card key={category.value} sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                {category.icon}
                <Typography variant="h6" fontWeight="bold">
                  {category.label}
                </Typography>
                <Chip label={categoryDocs.length} size="small" />
              </Box>
              <Divider sx={{ mb: 2 }} />
              <List>
                {categoryDocs.map((doc, index) => (
                  <React.Fragment key={doc._id}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <Typography variant="body1" fontWeight="bold">
                            {doc.filename || doc.description || 'Untitled Document'}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" color="textSecondary">
                              Uploaded: {new Date(doc.uploadDate).toLocaleDateString()} • 
                              Size: {(doc.size / 1024).toFixed(2)} KB
                            </Typography>
                            {doc.description && (
                              <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                                {doc.description}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="View">
                          <IconButton
                            edge="end"
                            onClick={() => handleView(doc._id)}
                            sx={{ mr: 1 }}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download">
                          <IconButton
                            edge="end"
                            onClick={() => handleDownload(doc._id, doc.filename)}
                            sx={{ mr: 1 }}
                          >
                            <Download />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            edge="end"
                            onClick={() => handleDelete(doc._id)}
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < categoryDocs.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        );
      })}

      {documents.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Folder sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No documents uploaded yet
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Upload your first document to get started
            </Typography>
            <Button
              variant="contained"
              startIcon={<Upload />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Upload Document
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Upload />
            <Typography variant="h6">Upload Document</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            select
            label="Document Category"
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          >
            {documentCategories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </TextField>
          <TextField
            label="Description (Optional)"
            value={uploadDescription}
            onChange={(e) => setUploadDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />
          <Button
            variant="outlined"
            component="label"
            fullWidth
            startIcon={<Add />}
          >
            {uploadFile ? uploadFile.name : 'Select File'}
            <input
              type="file"
              hidden
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
          </Button>
          {uploadFile && (
            <Alert severity="success" sx={{ mt: 2 }}>
              File selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(2)} KB)
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={!uploadFile || uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentVault;
