import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Link,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Divider
} from '@mui/material';
import { Visibility, VisibilityOff, Business, Person } from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';

const Login = () => {
  const [selectedRole, setSelectedRole] = useState('owner');
  const [formData, setFormData] = useState({
    login: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();



  const validateEmailOrUsername = (input) => {
    // If input contains @, treat it as email and validate
    if (input.includes('@')) {
      // Check if @ is not at the beginning or end
      const atIndex = input.indexOf('@');
      if (atIndex === 0 || atIndex === input.length - 1) {
        setEmailError('Invalid email format');
        return false;
      }
    }
    // If no @, treat as username - no validation needed
    setEmailError('');
    return true;
  };

  const validatePassword = (password) => {
    if (!password || password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // Clear errors when user types
    if (name === 'login') {
      setEmailError('');
    }
    if (name === 'password') {
      setPasswordError('');
    }
  };

  const handleRoleChange = (event, newRole) => {
    if (newRole !== null) {
      setSelectedRole(newRole);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate email or username
    if (!validateEmailOrUsername(formData.login)) {
      return;
    }

    // Validate password
    if (!validatePassword(formData.password)) {
      return;
    }

    setLoading(true);

    const result = await login(formData);
    
    if (result.success) {
      // Check if user data exists
      if (!result.user || !result.user.role) {
        setError('Login error: User data not received');
        setLoading(false);
        return;
      }
      
      // Navigate to role-specific dashboard based on the user's actual role
      const roleDashboard = {
        owner: '/owner-dashboard',
        customer: '/customer-dashboard'
      };
      navigate(roleDashboard[result.user.role], { replace: true });
    } else {
      setError(result.message || 'Invalid credentials');
    }
    
    setLoading(false);
  };

  return (
    <>
      <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%'
          }}
        >
          <Typography component="h1" variant="h4" gutterBottom>
            {t('common.appTitle')}
          </Typography>
          <Typography component="h2" variant="h5" color="primary" gutterBottom>
            {t('auth.signIn')}
          </Typography>

          {/* Role Selection Buttons */}
          <Box sx={{ width: '100%', mt: 3, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom align="center" sx={{ mb: 2 }}>
              {t('auth.selectLoginType')}
            </Typography>
            <ToggleButtonGroup
              value={selectedRole}
              exclusive
              onChange={handleRoleChange}
              aria-label="login role"
              fullWidth
              sx={{ mb: 2 }}
            >
              <ToggleButton value="owner" aria-label="owner login">
                <Business sx={{ mr: 1 }} />
                {t('auth.owner')}
              </ToggleButton>
              <ToggleButton value="customer" aria-label="customer login">
                <Person sx={{ mr: 1 }} />
                {t('auth.customer')}
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Divider sx={{ width: '100%', mb: 2 }} />

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="login"
              label={t('auth.emailOrUsername')}
              name="login"
              autoComplete="username"
              autoFocus
              value={formData.login}
              onChange={handleChange}
              disabled={loading}
              error={!!emailError}
              helperText={emailError || t('auth.enterEmailOrUsername')}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label={t('auth.password')}
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              error={!!passwordError}
              helperText={passwordError || t('auth.passwordRequirements')}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : `${t('auth.signIn')} ${t('common.as')} ${t(`auth.${selectedRole}`)}`}
            </Button>
            
            <Box sx={{ textAlign: 'center' }}>
              <Link component={RouterLink} to="/register" variant="body2">
                {t('auth.noAccount')} {t('auth.signUp')}
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
    </>
  );
};

export default Login;