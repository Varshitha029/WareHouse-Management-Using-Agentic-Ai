# Warehouse Management System

A comprehensive grain warehouse management system built with the MERN stack.

## Project Structure

```
warehouse-management-system/
 client/              # React frontend
    public/
    src/
       components/  # Reusable UI components
       contexts/    # React Context (Auth, Socket)
       pages/       # Page components
       App.js       # Main app component
    package.json
 server/              # Express backend
    models/          # MongoDB models
    routes/          # API routes
    middleware/      # Auth & validation middleware
    utils/           # Helper functions
    uploads/         # File storage
    server.js        # Express server
    package.json
 .env                 # Environment variables
 package.json         # Root package (runs both servers)
```

## Quick Start

1. **Install dependencies:**
```bash
npm run install-all
```

2. **Configure environment:**
   - Update `.env` file with your MongoDB connection string

3. **Run the application:**
```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## Available Scripts

- `npm run dev` - Run both frontend and backend
- `npm run server` - Run backend only
- `npm run client` - Run frontend only
- `npm run install-all` - Install all dependencies

## Tech Stack

- **Frontend**: React 19, Material-UI v7, Socket.IO Client
- **Backend**: Node.js, Express, MongoDB, Socket.IO
- **Authentication**: JWT, bcrypt

## License

MIT
