import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Typography,
    Alert,
    CircularProgress,
    IconButton
} from '@mui/material';
import {
    Close as CloseIcon,
    Email as EmailIcon,
    Send as SendIcon
} from '@mui/icons-material';
import axios from 'axios';

const TEN_DIGIT_PHONE_REGEX = /^\d{10}$/;

const CustomerContactForm = ({ open, onClose }) => {
    const [formData, setFormData] = useState({
        customerName: '',
        customerEmail: '',
        phone: '',
        message: ''
    });
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState({ show: false, type: '', message: '' });

    const handleChange = (e) => {
        const { name, value } = e.target;
        const normalizedValue = name === 'phone' ? value.replace(/\D/g, '').slice(0, 10) : value;
        setFormData(prev => ({
            ...prev,
            [name]: normalizedValue
        }));
    };

    const showAlert = (type, message) => {
        setAlert({ show: true, type, message });
        setTimeout(() => {
            setAlert({ show: false, type: '', message: '' });
        }, 5000);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        if (!formData.customerName.trim()) {
            showAlert('error', 'Please enter your name');
            return;
        }
        
        if (!formData.customerEmail.trim()) {
            showAlert('error', 'Please enter your email');
            return;
        }
        
        if (!formData.message.trim()) {
            showAlert('error', 'Please enter your message');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.customerEmail)) {
            showAlert('error', 'Please enter a valid email address');
            return;
        }

        if (formData.phone && !TEN_DIGIT_PHONE_REGEX.test(formData.phone)) {
            showAlert('error', 'Phone number must be exactly 10 digits');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post('/api/contact/customer-message', formData);
            
            if (response.data.success) {
                showAlert('success', 'Message sent successfully! We will get back to you soon.');
                
                // Reset form after successful submission
                setTimeout(() => {
                    setFormData({
                        customerName: '',
                        customerEmail: '',
                        phone: '',
                        message: ''
                    });
                    onClose();
                }, 2000);
            } else {
                showAlert('error', response.data.message || 'Failed to send message');
            }
        } catch (error) {
            console.error('Contact form error:', error);
            showAlert('error', error.response?.data?.message || 'Failed to send message. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setFormData({
                customerName: '',
                customerEmail: '',
                phone: '',
                message: ''
            });
            setAlert({ show: false, type: '', message: '' });
            onClose();
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2 }
            }}
        >
            <DialogTitle sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                color: 'white',
                mb: 0
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EmailIcon />
                    <Typography variant="h6">Contact Us</Typography>
                </Box>
                <IconButton 
                    onClick={handleClose} 
                    disabled={loading}
                    sx={{ color: 'white' }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <form onSubmit={handleSubmit}>
                <DialogContent sx={{ pt: 3 }}>
                    {alert.show && (
                        <Alert 
                            severity={alert.type} 
                            sx={{ mb: 2 }}
                            onClose={() => setAlert({ show: false, type: '', message: '' })}
                        >
                            {alert.message}
                        </Alert>
                    )}

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Have questions or need assistance? Send us a message and we'll get back to you as soon as possible.
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <TextField
                            name="customerName"
                            label="Your Name"
                            value={formData.customerName}
                            onChange={handleChange}
                            fullWidth
                            required
                            disabled={loading}
                            variant="outlined"
                        />

                        <TextField
                            name="customerEmail"
                            label="Your Email"
                            type="email"
                            value={formData.customerEmail}
                            onChange={handleChange}
                            fullWidth
                            required
                            disabled={loading}
                            variant="outlined"
                            helperText="We'll use this to respond to your message"
                        />

                        <TextField
                            name="phone"
                            label="Phone Number (Optional)"
                            value={formData.phone}
                            onChange={handleChange}
                            fullWidth
                            disabled={loading}
                            variant="outlined"
                            inputProps={{ maxLength: 10, inputMode: 'numeric', pattern: '[0-9]*' }}
                        />

                        <TextField
                            name="message"
                            label="Your Message"
                            value={formData.message}
                            onChange={handleChange}
                            fullWidth
                            required
                            disabled={loading}
                            variant="outlined"
                            multiline
                            rows={4}
                            placeholder="Tell us how we can help you..."
                        />
                    </Box>
                </DialogContent>

                <DialogActions sx={{ p: 3, pt: 1 }}>
                    <Button 
                        onClick={handleClose}
                        disabled={loading}
                        color="inherit"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                        sx={{ minWidth: 120 }}
                    >
                        {loading ? 'Sending...' : 'Send Message'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default CustomerContactForm;