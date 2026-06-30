import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box
} from '@mui/material';
import { Language, Translate } from '@mui/icons-material';

const languages = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' }
];

const LanguageSelector = ({ onSelect, open }) => {
  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ 
        textAlign: 'center', 
        background: 'linear-gradient(135deg, #1976d2, #42a5f5)',
        color: 'white',
        py: 3
      }}>
        <Language sx={{ fontSize: 40, mb: 1 }} />
        <Box component="span" sx={{ display: 'block', fontWeight: 'bold', fontSize: '1.5rem' }}>
          Select Language
        </Box>
        <Box component="span" sx={{ display: 'block', opacity: 0.9, mt: 0.5, fontSize: '0.875rem' }}>
          Choose your preferred language
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <List sx={{ py: 1 }}>
          {languages.map((lang) => (
            <ListItem key={lang.code} disablePadding>
              <ListItemButton 
                onClick={() => onSelect(lang.code)}
                sx={{
                  py: 2,
                  px: 3,
                  '&:hover': {
                    backgroundColor: 'primary.light',
                    color: 'white',
                    '& .MuiListItemText-secondary': {
                      color: 'rgba(255,255,255,0.7)'
                    }
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 48 }}>
                  <Typography variant="h5">{lang.flag}</Typography>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body1" fontWeight="600">
                      {lang.name}
                    </Typography>
                  }
                  secondary={lang.nativeName}
                />
                <Translate color="action" />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
};

export default LanguageSelector;
