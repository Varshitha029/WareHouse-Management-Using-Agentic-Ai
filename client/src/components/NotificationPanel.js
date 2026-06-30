import React from 'react';
import {
  Drawer,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Badge,
  Box,
  Chip,
  Divider
} from '@mui/material';
import {
  Close,
  Info,
  CheckCircle,
  Warning,
  Error,
  ClearAll
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';

const NotificationPanel = ({ open, onClose }) => {
  const { notifications, removeNotification, clearAllNotifications } = useSocket();

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'error':
        return <Error color="error" />;
      default:
        return <Info color="info" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'success':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'info';
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 400 } }
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Notifications
            {notifications.length > 0 && (
              <Badge badgeContent={notifications.length} color="primary" sx={{ ml: 1 }} />
            )}
          </Typography>
          <Box>
            {notifications.length > 0 && (
              <IconButton
                size="small"
                onClick={clearAllNotifications}
                title="Clear All"
                sx={{ mr: 1 }}
              >
                <ClearAll />
              </IconButton>
            )}
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
        </Box>

        <Divider />

        {notifications.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              No new notifications
            </Typography>
          </Box>
        ) : (
          <List sx={{ pt: 0 }}>
            {notifications.map((notification) => (
              <ListItem
                key={notification.id}
                alignItems="flex-start"
                sx={{
                  border: '1px solid',
                  borderColor: `${getTypeColor(notification.type)}.light`,
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: `${getTypeColor(notification.type)}.light`,
                  '&:hover': {
                    bgcolor: `${getTypeColor(notification.type)}.light`,
                    opacity: 0.8
                  }
                }}
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => removeNotification(notification.id)}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {getIcon(notification.type)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2" component="span">
                        {notification.title}
                      </Typography>
                      <Chip
                        label={notification.type}
                        size="small"
                        color={getTypeColor(notification.type)}
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="body2" color="text.primary" component="span" display="block">
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="span" display="block">
                        {formatTime(notification.timestamp)}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Drawer>
  );
};

export default NotificationPanel;