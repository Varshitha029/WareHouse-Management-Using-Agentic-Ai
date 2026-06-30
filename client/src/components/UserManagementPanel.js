import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Avatar,
  Grid,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Alert,
  CircularProgress,
  Tooltip,
  Button
} from '@mui/material';
import {
  Search,
  PersonOff,
  CheckCircle,
  Email,
  Phone,
  LocationOn,
  Block,
  PersonAdd,
  Download
} from '@mui/icons-material';
import axios from 'axios';

const UserManagementPanel = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState({
    owners: [],
    customers: [],
    all: []
  });
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    byRole: { owners: 0, customers: 0 }
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/users/all');
      setUsers(response.data.users);
      setStats(response.data.stats);
      setError('');
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      const response = await axios.put(`/api/users/${userId}/toggle-status`);
      setSuccess(response.data.message);
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Failed to update user status');
      setTimeout(() => setError(''), 3000);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'owner':
        return 'error';
      case 'customer':
        return 'primary';
      case 'worker':
        return 'success';
      default:
        return 'default';
    }
  };

  const getUsersForTab = () => {
    let userList = [];
    switch (activeTab) {
      case 0:
        userList = users.all || [];
        break;
      case 1:
        userList = users.owners || [];
        break;
      case 2:
        userList = users.customers || [];
        break;
      default:
        userList = users.all || [];
    }

    if (searchTerm) {
      return userList.filter(user =>
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.profile?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.profile?.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return userList;
  };

  const handleExport = async () => {
    try {
      const response = await axios.get('/api/exports/users-excel', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      setError('Failed to export users to Excel');
      setTimeout(() => setError(''), 3000);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Users
              </Typography>
              <Typography variant="h4">
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Users
              </Typography>
              <Typography variant="h4" color="success.main">
                {stats.active}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Customers
              </Typography>
              <Typography variant="h4" color="primary.main">
                {stats.byRole.customers}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Panel */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            User Management
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleExport}
          >
            Export Excel
          </Button>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label={`All Users (${users.all?.length || 0})`} />
            <Tab label={`Owners (${users.owners?.length || 0})`} />
            <Tab label={`Customers (${users.customers?.length || 0})`} />
          </Tabs>
        </Box>

        {/* Search */}
        <TextField
          fullWidth
          placeholder="Search by username, email, or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 3 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
        />

        {/* Users Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Role</TableCell>
                {activeTab === 2 && <TableCell>Active Storage</TableCell>}
                {activeTab === 2 && <TableCell>Total Spent</TableCell>}
                <TableCell>Status</TableCell>
                <TableCell>Date Joined</TableCell>
                <TableCell>Left Date</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {getUsersForTab().map((user) => (
                <TableRow key={user._id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: getRoleColor(user.role) + '.main' }}>
                        {user.username?.[0]?.toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {user.profile?.firstName} {user.profile?.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{user.username}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Email fontSize="small" color="action" />
                        <Typography variant="caption">{user.email}</Typography>
                      </Box>
                      {user.profile?.phone && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Phone fontSize="small" color="action" />
                          <Typography variant="caption">{user.profile.phone}</Typography>
                        </Box>
                      )}
                      {user.profile?.address && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LocationOn fontSize="small" color="action" />
                          <Typography variant="caption">
                            {user.profile.address.city}, {user.profile.address.state}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.role.toUpperCase()}
                      color={getRoleColor(user.role)}
                      size="small"
                    />
                  </TableCell>
                  {activeTab === 2 && (
                    <TableCell>
                      <Typography variant="body2">
                        {user.stats?.activeAllocations || 0}
                      </Typography>
                    </TableCell>
                  )}
                  {activeTab === 2 && (
                    <TableCell>
                      <Typography variant="body2">
                        ₹{user.stats?.totalSpent || 0}
                      </Typography>
                    </TableCell>
                  )}
                  <TableCell>
                    <Chip
                      icon={user.isActive ? <CheckCircle /> : <PersonOff />}
                      label={user.isActive ? 'Active' : 'Inactive'}
                      color={user.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(user.createdAt).toLocaleDateString('en-IN')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {!user.isActive && user.role === 'customer' 
                        ? (user.updatedAt ? new Date(user.updatedAt).toLocaleDateString('en-IN') : 'N/A')
                        : user.role === 'customer' ? 'Active' : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={user.isActive ? 'Deactivate User' : 'Activate User'}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleStatus(user._id, user.isActive)}
                        color={user.isActive ? 'error' : 'success'}
                      >
                        <Block />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {getUsersForTab().length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <PersonAdd sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No users found
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default UserManagementPanel;
