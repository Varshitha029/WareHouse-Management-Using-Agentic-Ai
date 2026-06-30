import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemText,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button
} from '@mui/material';
import { School, PlayCircle, Description, ExpandMore, Quiz } from '@mui/icons-material';
import axios from 'axios';

const TrainingKnowledgeBase = () => {
  const [resources, setResources] = useState({
    videos: [],
    guides: [],
    faqs: []
  });

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/workers/training-resources', {
          headers: { 'x-auth-token': token }
        });
        setResources(response.data);
      } catch (err) {
        console.error('Failed to fetch training resources');
        // Set default data
        setResources({
          videos: [
            { title: 'How to operate weigh bridge', duration: '5 mins', completed: false },
            { title: 'Grain quality inspection guide', duration: '8 mins', completed: false },
            { title: 'Safety protocols', duration: '10 mins', completed: true }
          ],
          guides: [
            { title: 'Weigh Bridge Operation Manual', pages: 12 },
            { title: 'Quality Inspection Standards', pages: 8 },
            { title: 'Emergency Procedures', pages: 6 }
          ],
          faqs: [
            { question: 'How to handle overweight vehicles?', answer: 'First check for measurement errors, then inform supervisor and customer.' },
            { question: 'What to do if payment fails?', answer: 'Record the transaction manually and generate offline receipt.' },
            { question: 'Emergency contact numbers?', answer: 'Supervisor: 9876543210, Warehouse Owner: 9876543211, Fire: 101, Ambulance: 108' }
          ]
        });
      }
    };
    fetchResources();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        <School sx={{ verticalAlign: 'middle', mr: 1 }} />
        Training & Knowledge Base
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Videos</Typography>
              <Typography variant="h4" fontWeight="bold">{resources.videos.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Guides</Typography>
              <Typography variant="h4" fontWeight="bold">{resources.guides.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Training Progress</Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {Math.round((resources.videos.filter(v => v.completed).length / resources.videos.length) * 100)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            <PlayCircle sx={{ verticalAlign: 'middle', mr: 1 }} />
            Video Tutorials
          </Typography>
          <List>
            {resources.videos.map((video, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={video.title}
                  secondary={`Duration: ${video.duration}`}
                />
                {video.completed ? (
                  <Chip label="Completed" color="success" size="small" />
                ) : (
                  <Button variant="outlined" size="small">Watch</Button>
                )}
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            <Description sx={{ verticalAlign: 'middle', mr: 1 }} />
            PDF Guides
          </Typography>
          <List>
            {resources.guides.map((guide, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={guide.title}
                  secondary={`${guide.pages} pages`}
                />
                <Button variant="outlined" size="small">Download</Button>
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            <Quiz sx={{ verticalAlign: 'middle', mr: 1 }} />
            Frequently Asked Questions
          </Typography>
          {resources.faqs.map((faq, index) => (
            <Accordion key={index}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography fontWeight="bold">{faq.question}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography>{faq.answer}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </CardContent>
      </Card>
    </Box>
  );
};

export default TrainingKnowledgeBase;
