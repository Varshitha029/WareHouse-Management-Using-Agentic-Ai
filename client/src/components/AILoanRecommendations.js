import React, { useState, useEffect, useCallback } from 'react';
import { Paper, Typography, Box, Alert, CircularProgress, Grid } from '@mui/material';
import { Psychology } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const AILoanRecommendations = ({ customerId }) => {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isFreshCustomer, setIsFreshCustomer] = useState(false);
  const { user } = useAuth();

  const fetchRecommendations = useCallback(async () => {
    if (!(customerId || user?._id)) return;
    try {
      setLoading(true);

      // Fresh customer check: if no loan history, show only fresher message.
      try {
        const loansResponse = await axios.get('/api/loans/my-loans');
        const loans = loansResponse?.data?.loans || [];
        if (Array.isArray(loans) && loans.length === 0) {
          setIsFreshCustomer(true);
          setRecommendations(null);
          return;
        }
      } catch (loanHistoryError) {
        // If history check fails, continue with existing AI behavior.
        setIsFreshCustomer(false);
      }

      setIsFreshCustomer(false);
      const response = await axios.post('/api/ai/loan-risk/assess', {
        customerId: customerId || user?._id,
        action: 'assess'
      });

      // Support both direct and wrapped response shapes:
      // 1) { success, data: {...}, message }
      // 2) { risk_score, ... }
      // 3) n8n webhook wrappers that may contain nested payloads
      const raw = response?.data || {};
      const payload = raw?.data || raw?.prediction || raw;

      setRecommendations({
        risk_score: payload?.risk_score,
        max_loan_recommended: payload?.max_loan_recommended ?? payload?.max_recommended_amount,
        recommendation: payload?.recommendation,
        risk_level: payload?.risk_level,
        reasoning: payload?.reasoning,
      });
    } catch (err) {
      // Silent fail - AI features are optional
      console.log('AI Loan recommendations unavailable');
    } finally {
      setLoading(false);
    }
  }, [customerId, user?._id]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  if (loading) {
    return (
      <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">Loading AI recommendations...</Typography>
      </Paper>
    );
  }

  if (isFreshCustomer) {
    return (
      <Paper sx={{ p: 2, border: '1px solid', borderColor: 'primary.light', bgcolor: 'primary.50' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Psychology color="primary" />
          <Typography variant="subtitle1" fontWeight="bold">AI Loan Insights</Typography>
        </Box>
        <Alert severity="info" icon={<Psychology />}>
          Customer is a fresher
        </Alert>
      </Paper>
    );
  }

  if (!recommendations) return null;

  return (
    <Paper sx={{ p: 2, border: '1px solid', borderColor: 'primary.light', bgcolor: 'primary.50' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Psychology color="primary" />
        <Typography variant="subtitle1" fontWeight="bold">AI Loan Insights</Typography>
      </Box>
      <Grid container spacing={2}>
        {recommendations.risk_score !== undefined && (
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">Risk Score</Typography>
              <Typography variant="caption" color="text.secondary">(higher is worse)</Typography>
              <Typography variant="h5" fontWeight="bold"
                color={recommendations.risk_score > 70 ? 'error.main' : recommendations.risk_score > 40 ? 'warning.main' : 'success.main'}>
                {recommendations.risk_score}/100
              </Typography>
            </Box>
          </Grid>
        )}
        {recommendations.max_loan_recommended && (
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">Max Recommended Loan</Typography>
              <Typography variant="h5" fontWeight="bold" color="info.main">
                ₹{recommendations.max_loan_recommended.toLocaleString()}
              </Typography>
            </Box>
          </Grid>
        )}
        {(recommendations.recommendation || recommendations.reasoning) && (
          <Grid item xs={12}>
            <Alert severity={recommendations.risk_score > 70 ? 'warning' : 'info'} icon={<Psychology />}>
              {recommendations.recommendation || recommendations.reasoning}
            </Alert>
          </Grid>
        )}
        {!recommendations.recommendation && recommendations.risk_level && (
          <Grid item xs={12}>
            <Alert severity={recommendations.risk_score > 70 ? 'warning' : 'info'} icon={<Psychology />}>
              AI assessed this profile as {recommendations.risk_level} risk.
            </Alert>
          </Grid>
        )}
      </Grid>
    </Paper>
  );
};

export default AILoanRecommendations;
