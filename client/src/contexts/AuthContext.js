import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  loading: true,
  error: null
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };
    case 'LOGIN_SUCCESS':
    case 'REGISTER_SUCCESS':
      localStorage.setItem('token', action.payload.token);
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
        error: null
      };
    case 'USER_LOADED':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        loading: false
      };
    case 'AUTH_ERROR':
    case 'LOGIN_FAIL':
    case 'REGISTER_FAIL':
    case 'LOGOUT':
      localStorage.removeItem('token');
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: action.payload
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    default:
      return state;
  }
};

// Set default axios headers - using x-auth-token for compatibility
const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['x-auth-token'] = token;
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['x-auth-token'];
    delete axios.defaults.headers.common['Authorization'];
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Set axios base URL (removed /api suffix as routes include it)
  axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  // Setup axios interceptor to always include auth token
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers['x-auth-token'] = token;
          config.headers['Authorization'] = `Bearer ${token}`;
          console.log('🔐 Auth token attached to request:', config.url);
        } else {
          const requestUrl = config.url || '';
          const isPublicAuthRequest = requestUrl.includes('/api/auth/login') || requestUrl.includes('/api/auth/register');
          if (!isPublicAuthRequest) {
            console.log('⚠️ No token found for request:', config.url);
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Setup response interceptor to handle 401 errors
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - let React Router handle redirect
          localStorage.removeItem('token');
          dispatch({ type: 'LOGOUT' });
          // Don't use window.location.href as it causes a full page reload
          // and resets all React state (including LanguageGate), creating a refresh loop.
          // ProtectedRoute will redirect to /login via React Router.
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptors on unmount
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Load user on app start
  useEffect(() => {
    if (state.token) {
      setAuthToken(state.token);
      loadUser();
    } else {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.token]);

  // Load user data
  const loadUser = async () => {
    try {
      const res = await axios.get('/api/auth/profile');
      dispatch({
        type: 'USER_LOADED',
        payload: res.data
      });
    } catch (error) {
      dispatch({
        type: 'AUTH_ERROR',
        payload: error.response?.data?.message || 'Authentication failed'
      });
    }
  };

  // Login user
  const login = async (credentials) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const res = await axios.post('/api/auth/login', credentials);
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: res.data
      });
      
      setAuthToken(res.data.token);
      return { success: true, user: res.data.user };
    } catch (error) {
      let message = error.response?.data?.message || 'Login failed';
      const hint = error.response?.data?.hint;
      
      // Include hint if available (e.g., MongoDB connection info)
      if (hint) {
        message = `${message}\n\n${hint}`;
      }
      
      dispatch({
        type: 'LOGIN_FAIL',
        payload: message
      });
      return { success: false, message };
    }
  };

  // Register user
  const register = async (userData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const res = await axios.post('/api/auth/register', userData);
      
      dispatch({
        type: 'REGISTER_SUCCESS',
        payload: res.data
      });
      
      setAuthToken(res.data.token);
      return { success: true };
    } catch (error) {
      let message = error.response?.data?.message || 'Registration failed';
      const hint = error.response?.data?.hint;
      
      // Include hint if available (e.g., MongoDB connection info)
      if (hint) {
        message = `${message}\n\n${hint}`;
      }
      
      dispatch({
        type: 'REGISTER_FAIL',
        payload: message
      });
      return { success: false, message };
    }
  };

  // Logout user
  const logout = () => {
    setAuthToken(null);
    dispatch({ type: 'LOGOUT' });
  };

  // Update profile
  const updateProfile = async (profileData) => {
    try {
      const res = await axios.put('/auth/profile', profileData);
      dispatch({
        type: 'USER_LOADED',
        payload: res.data.user
      });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Profile update failed';
      return { success: false, message };
    }
  };

  // Change password
  const changePassword = async (passwordData) => {
    try {
      await axios.post('/api/auth/change-password', passwordData);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Password change failed';
      return { success: false, message };
    }
  };

  // Clear errors
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    clearError,
    loadUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;