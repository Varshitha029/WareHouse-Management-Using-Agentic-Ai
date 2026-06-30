import React, { useState, useEffect, useCallback } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Badge,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  useMediaQuery,
  Box,
  Chip,
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications,
  AccountCircle,
  Dashboard,
  LocalShipping,
  Warehouse,
  People,
  Payment,
  ExitToApp,
  Settings,
  Grain,
  Work,
  Assessment
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useTranslation } from '../i18n/LanguageContext';
import NotificationPanel from './NotificationPanel';
import axios from 'axios';

const Navbar = () => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [occupancyData, setOccupancyData] = useState({
    totalSections: 0,
    occupiedSections: 0,
    totalBags: 0,
    totalWeight: 0,
    occupancyPercentage: 0
  });
  
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const { user, logout } = useAuth();
  const { notifications } = useSocket();

  const fetchOccupancyData = useCallback(async () => {
    try {
      const response = await axios.get('/api/warehouse/occupancy');
      setOccupancyData(response.data);
    } catch (error) {
      // Silently handle error - occupancy endpoint might not be accessible yet
      if (error.response?.status !== 404) {
        console.error('Error fetching occupancy data:', error);
      }
    }
  }, []);

  // Format date and time
  const formatDateTime = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const formattedHours = String(hours).padStart(2, '0');
    
    return {
      date: `${day}/${month}/${year}`,
      time: `${formattedHours}:${minutes}:${seconds} ${ampm}`
    };
  };

  useEffect(() => {
    // Update time every second
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user?.role === 'owner') {
      fetchOccupancyData();
      // Refresh occupancy data every 30 seconds
      const interval = setInterval(fetchOccupancyData, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchOccupancyData]);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleProfileMenuClose();
  };

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const menuItems = [
    { text: t('dashboard.ownerDashboard'), icon: <Settings />, path: '/owner-dashboard', roles: ['owner'] },
    { text: t('common.weighbridge'), icon: <Dashboard />, path: '/weigh-bridge', roles: ['owner'] },
    { text: 'AI Evaluation', icon: <Assessment />, path: '/evaluation', roles: ['owner'] },
    { text: t('dashboard.customerDashboard'), icon: <AccountCircle />, path: '/customer-dashboard', roles: ['customer'] },
    { text: t('common.profile'), icon: <AccountCircle />, path: '/profile', roles: ['customer'] }
  ];

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user?.role)
  );

  const DrawerContent = () => (
    <div style={{ width: 250 }}>
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="h6" color="primary">
          Warehouse MS
        </Typography>
      </Box>
      <Divider />
      <List>
        {filteredMenuItems.map((item) => (
          <ListItem
            button
            key={item.text}
            onClick={() => {
              navigate(item.path);
              if (isMobile) setDrawerOpen(false);
            }}
            selected={location.pathname === item.path}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={toggleDrawer}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {user?.role === 'owner' ? t('common.appTitle') + ' - ' + t('auth.owner') : t('common.appTitle') + ' - ' + t('auth.customer')}
          </Typography>

          {/* Real-time Date and Time Display */}
          {!isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 3 }}>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                bgcolor: 'rgba(255,255,255,0.1)', 
                px: 2, 
                py: 0.5, 
                borderRadius: 1 
              }}>
                <Typography variant="body2" fontWeight="bold" sx={{ letterSpacing: 0.5 }}>
                  {formatDateTime(currentDateTime).date}
                </Typography>
                <Typography variant="caption" sx={{ letterSpacing: 1 }}>
                  {formatDateTime(currentDateTime).time}
                </Typography>
              </Box>
            </Box>
          )}

          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {filteredMenuItems.map((item) => (
                <Button
                  key={item.text}
                  color="inherit"
                  onClick={() => navigate(item.path)}
                  sx={{
                    backgroundColor: location.pathname === item.path ? 'rgba(255,255,255,0.1)' : 'transparent'
                  }}
                >
                  {item.text}
                </Button>
              ))}
            </Box>
          )}

          <IconButton
            color="inherit"
            onClick={() => setNotificationOpen(true)}
          >
            <Badge badgeContent={notifications.length} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          <IconButton
            edge="end"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.username?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={() => {
              navigate('/profile');
              handleProfileMenuClose();
            }}>
              <AccountCircle sx={{ mr: 1 }} />
              {t('common.profile')}
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ExitToApp sx={{ mr: 1 }} />
              {t('common.logout')}
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={toggleDrawer}
      >
        <DrawerContent />
      </Drawer>

      <NotificationPanel
        open={notificationOpen}
        onClose={() => setNotificationOpen(false)}
      />
    </>
  );
};

export default Navbar;